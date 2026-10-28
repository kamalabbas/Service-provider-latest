// Run with: node --test tests/*.test.cjs
// Guide 18: notice validation, event routing, deep links, dedup across transports and the hub lifecycle.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// A fake hub: tests drive start results, events, reconnects and closes.
const hubs = [];
class FakeHub {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.handlers = {};
    this.state = 'Disconnected';
    this.starts = 0;
    this.stops = 0;
    this.startResult = null;
    hubs.push(this);
  }
  on(name, handler) { this.handlers[name] = handler; }
  onreconnecting(handler) { this.reconnecting = handler; }
  onreconnected(handler) { this.reconnected = handler; }
  onclose(handler) { this.closed = handler; }
  async start() {
    this.starts += 1;
    if (this.startResult) throw this.startResult;
    this.state = 'Connected';
  }
  async stop() { this.stops += 1; this.state = 'Disconnected'; }
}
const signalr = {
  HubConnectionBuilder: class {
    withUrl(url, options) { this.url = url; this.options = options; return this; }
    withAutomaticReconnect(delays) { this.delays = delays; return this; }
    configureLogging() { return this; }
    build() { return new FakeHub(this.url, this.options); }
  },
  HubConnectionState: { Disconnected: 'Disconnected', Connected: 'Connected' },
  LogLevel: { Error: 4 },
};

const appStateListeners = [];
const reactNative = { AppState: { currentState: 'active', addEventListener: (_, listener) => {
  appStateListeners.push(listener);
  return { remove: () => appStateListeners.splice(appStateListeners.indexOf(listener), 1) };
} } };

const invalidated = [];
const toasts = [];
let refreshResult = 'refreshed-token';
let refreshCalls = 0;
const timers = [];
const fakeSetTimeout = (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; };
const fakeClearTimeout = timer => { const index = timers.indexOf(timer); if (index >= 0) timers.splice(index, 1); };
const runTimers = async () => {
  while (timers.length) timers.shift().callback();
  await new Promise(resolve => setImmediate(resolve));
};

const env = { EXPO_PUBLIC_SIGNALR_URL: 'https://signalr.example.test/hubs/notifications' };
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const sandbox = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module: sandbox, exports: sandbox.exports, Promise, setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
    process: { env }, decodeURIComponent, atob, Buffer,
    require: id => {
      if (id === '@microsoft/signalr') return signalr;
      if (id === 'react-native') return reactNative;
      if (id === 'zustand') return require('zustand');
      if (id === '@/services/queryClient') return { queryClient: { invalidateQueries: async ({ queryKey }) => { invalidated.push(queryKey); }, clear: () => {}, cancelQueries: async () => {}, removeQueries: () => {} } };
      if (id === '@/services/authSession') return {
        getSessionGeneration: () => generation,
        refreshAccessToken: async () => { refreshCalls += 1; return refreshResult; },
      };
      if (id === '@/stores/toastStore') return { useToastStore: { getState: () => ({ showToast: (...args) => toasts.push(args) }) } };
      if (id === 'expo-notifications') return {};
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, sandbox.exports);
  return sandbox.exports;
}

let generation = 1;
const events = load('utility/liveEvents.ts');
const live = load('services/liveNotifications.ts');
const { useAuthStore } = load('stores/authStore.ts');
const { useNotificationStore } = load('stores/notificationStore.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));

const jwt = exp => `h.${Buffer.from(JSON.stringify({ sub: '1', exp })).toString('base64url')}.s`;
const user = (id, accessLevel = 'full') => ({ id, accessLevel, roles: [], permissions: [], profileCompletionRequired: accessLevel === 'profile_setup', email: 'a@b.c' });
const signIn = (id = '1', token = jwt(Math.floor(Date.now() / 1000) + 3600), accessLevel = 'full') =>
  useAuthStore.setState({ accessToken: token, user: user(id, accessLevel) });
const signOut = () => useAuthStore.setState({ accessToken: null, user: null });
const notice = (eventId, type = 'inspection.accept', data = { inspectionId: 101 }) =>
  ({ eventId, type, title: 'Inspection updated', body: 'Your inspection was accepted.', data, occurredAtUtc: '2026-10-18T12:00:00Z' });

test.beforeEach(() => {
  invalidated.length = 0;
  toasts.length = 0;
  timers.length = 0;
  refreshCalls = 0;
  refreshResult = 'refreshed-token';
});

test('notices: validated, plain text, unknown shapes dropped; Expo data unwrapped', () => {
  assert.deepEqual(plain(events.normalizeLiveNotice(notice('e1'))), notice('e1'));
  assert.equal(events.normalizeLiveNotice({ type: 'quote.issued' }), null, 'Needs an event ID');
  assert.equal(events.normalizeLiveNotice({ eventId: 'e', type: 'quote' }), null, 'Needs a dotted type');
  assert.equal(events.normalizeLiveNotice('nope'), null);
  assert.deepEqual(plain(events.normalizeLiveNotice({ eventId: 'e', type: 'future.thing', data: [1] })).data, {});
  const push = events.normalizePushNotice({ title: 'New reply', body: null, data: { eventId: 'e2', type: 'support.admin_replied', data: { ticketId: 7 } } });
  assert.deepEqual(plain(push), { eventId: 'e2', type: 'support.admin_replied', title: 'New reply', body: '', data: { ticketId: 7 }, occurredAtUtc: null });
  assert.equal(events.normalizePushNotice({ data: {} }), null, 'Ordinary pushes are ignored');
});

test('affected queries: per feature, scoped to the account; unknown types refetch nothing', () => {
  assert.deepEqual(plain(events.affectedQueryKeys('inspection.accept', '1')), [['inspections', '1'], ['clients', '1']]);
  assert.deepEqual(plain(events.affectedQueryKeys('quote.pdf_replaced', '1')), [['quotes', '1']]);
  assert.deepEqual(plain(events.affectedQueryKeys('card-request.accepted', '1')), [['card-requests', '1'], ['cards', '1']]);
  assert.deepEqual(plain(events.affectedQueryKeys('card.dispatched', '1')), [['cards', '1'], ['card-requests', '1']]);
  assert.deepEqual(plain(events.affectedQueryKeys('support.closed', '1')), [['support', '1']]);
  assert.deepEqual(plain(events.affectedQueryKeys('announcement.retired', '1')), [['announcements', '1']]);
  assert.deepEqual(plain(events.affectedQueryKeys('issue-report.status-changed', '1')), []);
  assert.deepEqual(plain(events.affectedQueryKeys('brand-new.event', '1')), []);
});

test('query roots match the hooks\' key roots', () => {
  const hooks = fs.readdirSync(path.join(__dirname, '..', 'hooks')).map(file => fs.readFileSync(path.join(__dirname, '..', 'hooks', file), 'utf8')).join('\n');
  const roots = new Set([...hooks.matchAll(/all: \(accountId: string \| null\) => \["([^"]+)", accountId\]/g)].map(match => match[1]));
  for (const root of events.ALL_LIVE_ROOTS) assert.ok(roots.has(root), `${root} is a real query-key root`);
});

test('deep links: permitted screens only, IDs validated, nothing during setup except support', () => {
  const member = user('1');
  assert.deepEqual(plain(events.routeForNotice(notice('a'), member, false)), { pathname: '/(dashboard)/(inspections)/[id]', params: { id: '101' } });
  assert.deepEqual(plain(events.routeForNotice(notice('a', 'quote.issued', { quoteId: '5' }), member, false)), { pathname: '/(dashboard)/(quotes)/[id]', params: { id: '5' } });
  assert.deepEqual(plain(events.routeForNotice(notice('a', 'card.dispatched', { cardId: 3 }), member, false)).pathname, '/(dashboard)/(menu)/card');
  assert.deepEqual(plain(events.routeForNotice(notice('a', 'price-item-request.approved', { requestId: 4 }), member, false)).pathname, '/(dashboard)/(menu)/price-request');
  assert.deepEqual(plain(events.routeForNotice(notice('a', 'announcement.published', { announcementId: 9 }), member, false)).pathname, '/(dashboard)/(menu)/announcement');
  assert.deepEqual(plain(events.routeForNotice(notice('a', 'support.admin_replied', { ticketId: 7 }), member, true)), { pathname: '/(setup)/support-ticket', params: { id: '7' } });
  assert.equal(events.routeForNotice(notice('a'), member, true), null, 'Setup sessions only reach support');
  assert.equal(events.routeForNotice(notice('a', 'issue-report.status-changed', { reportId: 2 }), member, false), null, 'No SuperAdmin-only link');
  assert.equal(events.routeForNotice(notice('a', 'quote.issued', { quoteId: -1 }), member, false), null);
  assert.equal(events.routeForNotice(notice('a', 'quote.issued', { quoteId: '1; drop' }), member, false), null);
  assert.equal(events.routeForNotice(notice('a'), null, false), null);
});

test('seen events are bounded', () => {
  const seen = new events.SeenEvents(2);
  assert.equal(seen.add('a'), true);
  assert.equal(seen.add('a'), false);
  seen.add('b');
  seen.add('c');
  assert.equal(seen.add('a'), true, 'Oldest evicted');
});

test('hub lifecycle: connects with the current token, dedupes, debounces refetch and toasts', async () => {
  generation = 1;
  signIn('1');
  const stop = live.startLiveNotifications();
  await flush();
  const hub = hubs.at(-1);
  assert.equal(hub.url, env.EXPO_PUBLIC_SIGNALR_URL, 'No user ID in the URL');
  assert.equal(hub.state, 'Connected');
  assert.equal(useNotificationStore.getState().live, 'live');
  assert.equal(await hub.options.accessTokenFactory(), useAuthStore.getState().accessToken);
  await runTimers();
  assert.ok(invalidated.some(key => key[0] === 'support' && key[1] === '1'), 'Refetch after connect');

  invalidated.length = 0;
  hub.handlers.notificationReceived(notice('e1'));
  hub.handlers.notificationReceived(notice('e1'));
  hub.handlers.notificationReceived(notice('e2', 'inspection.complete'));
  hub.handlers.notificationReceived({ junk: true });
  hub.handlers.notificationReceived(notice('e3', 'unknown.future'));
  assert.equal(timers.length, 1, 'One debounced flush');
  await runTimers();
  assert.deepEqual(plain(invalidated), [['inspections', '1'], ['clients', '1']]);
  assert.equal(toasts.length, 3, 'Duplicates and malformed notices are ignored');
  assert.equal(toasts[0][0], 'Inspection updated: Your inspection was accepted.');

  // A foreground push for an event already received live is not handled twice.
  invalidated.length = 0;
  useNotificationStore.setState({ notification: { request: { content: { title: 't', body: 'b', data: { eventId: 'e1', type: 'inspection.accept', data: {} } } } } });
  useNotificationStore.setState({ notification: { request: { content: { title: 't', body: 'b', data: { eventId: 'p1', type: 'quote.issued', data: { quoteId: 1 } } } } } });
  await runTimers();
  assert.deepEqual(plain(invalidated), [['quotes', '1']]);
  assert.equal(toasts.length, 3, 'Pushes show the OS banner, not a toast');

  hub.reconnecting();
  assert.equal(useNotificationStore.getState().live, 'reconnecting');
  invalidated.length = 0;
  hub.reconnected();
  await runTimers();
  assert.equal(useNotificationStore.getState().live, 'live');
  assert.ok(invalidated.length > 0, 'Refetch after reconnect');
  stop();
  await flush();
  assert.equal(hub.stops, 1);
  assert.equal(useNotificationStore.getState().live, 'off');
});

test('token near expiry is refreshed through the auth service, never captured', async () => {
  signIn('1', jwt(Math.floor(Date.now() / 1000) + 10));
  assert.equal(await live.getValidAccessToken(), 'refreshed-token');
  assert.equal(refreshCalls, 1);
  signIn('1', jwt(Math.floor(Date.now() / 1000) + 3600));
  assert.equal(await live.getValidAccessToken(), useAuthStore.getState().accessToken);
  assert.equal(refreshCalls, 1);
  signOut();
  refreshResult = null;
  await assert.rejects(live.getValidAccessToken(), /No signed-in session/);
});

test('sign-out and account switch stop the old connection; old handlers are ignored', async () => {
  generation = 2;
  signIn('1');
  const stop = live.startLiveNotifications();
  await flush();
  const first = hubs.at(-1);
  signOut();
  await flush();
  assert.equal(first.stops, 1);
  assert.equal(useNotificationStore.getState().live, 'off');

  generation = 3;
  signIn('2');
  await flush();
  const second = hubs.at(-1);
  assert.notEqual(second, first);
  assert.equal(second.state, 'Connected');
  await runTimers();
  toasts.length = 0;
  first.handlers.notificationReceived(notice('old'));
  assert.equal(toasts.length, 0, 'The replaced connection is ignored');
  second.handlers.notificationReceived(notice('old'));
  assert.equal(toasts.length, 1, 'Seen IDs are cleared per account');
  stop();
  await flush();
});

test('failed starts and final closes retry with backoff while signed in; resume reconnects', async () => {
  generation = 4;
  signIn('5');
  const failing = new Error('negotiate failed');
  const originalStart = FakeHub.prototype.start;
  FakeHub.prototype.start = async function () { this.starts += 1; throw failing; };
  const stop = live.startLiveNotifications();
  await flush();
  const hub = hubs.at(-1);
  assert.equal(useNotificationStore.getState().live, 'retrying');
  assert.deepEqual(timers.map(timer => timer.delay), [2000]);
  FakeHub.prototype.start = originalStart;
  await runTimers();
  await flush();
  assert.equal(hub.state, 'Connected');
  assert.equal(useNotificationStore.getState().live, 'live');

  hub.state = 'Disconnected';
  hub.closed(new Error('token expired'));
  assert.equal(useNotificationStore.getState().live, 'retrying');
  timers.length = 0;
  // Coming back to the foreground reconnects at once and refetches.
  appStateListeners.forEach(listener => listener('active'));
  await flush();
  assert.equal(hub.state, 'Connected');

  signOut();
  await flush();
  assert.equal(useNotificationStore.getState().live, 'off');
  hub.closed();
  assert.equal(timers.filter(timer => timer.delay >= 2000).length, 0, 'No retry after sign-out');
  stop();
  await flush();
});

test('setup sessions connect too (support notices); no hub URL means no connection', async () => {
  generation = 5;
  signIn('6', undefined, 'profile_setup');
  const stop = live.startLiveNotifications();
  await flush();
  assert.equal(hubs.at(-1).state, 'Connected');
  stop();
  await flush();

  const count = hubs.length;
  delete env.EXPO_PUBLIC_SIGNALR_URL;
  const none = live.startLiveNotifications();
  await flush();
  assert.equal(hubs.length, count);
  assert.equal(useNotificationStore.getState().live, 'off');
  none();
  env.EXPO_PUBLIC_SIGNALR_URL = 'https://signalr.example.test/hubs/notifications';
});
