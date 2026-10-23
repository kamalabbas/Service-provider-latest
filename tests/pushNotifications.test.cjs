// Run with: node --test tests/*.test.cjs
// Real notification service/Zustand stores with controlled native boundaries.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { notifications, response } = require('./helpers/notifications.cjs');

const root = path.resolve(__dirname, '..'), compiled = new Map(), runtimes = new Set();
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const denied = { status: 'denied', granted: false, canAskAgain: false };

function harness(options = {}) {
  const native = notifications(options), modules = new Map(), warnings = [], stops = [];
  let generation = 0;
  const external = {
    zustand: require('zustand'),
    '@tanstack/react-query': require('@tanstack/react-query'),
    '@/services/authSession': { getSessionGeneration: () => generation },
    'expo-notifications': native.Notifications,
    'expo-constants': native.Constants,
    'expo-device': native.Device,
    'react-native': { Platform: { OS: options.platform ?? 'ios' }, AppState: native.AppState },
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText);
    const module = { exports: {} };
    modules.set(file, module);
    vm.runInNewContext(compiled.get(file), {
      module, exports: module.exports, Promise,
      process: { env: { EXPO_PUBLIC_BASE_URL: options.noBackend ? '' : 'https://api.example.test' } },
      console: { warn: message => warnings.push(message) },
      require: id => {
        if (Object.hasOwn(external, id)) return external[id];
        assert.ok(id.startsWith('@/'), `Unexpected import: ${id}`);
        return load(`${id.slice(2)}.ts`);
      },
    }, { filename: file });
    return module.exports;
  }
  const service = load('services/pushNotifications.ts');
  const auth = load('stores/authStore.ts').useAuthStore;
  const store = load('stores/notificationStore.ts').useNotificationStore;
  const h = {
    native, auth, store, service, warnings,
    start() { const stop = service.startPushNotifications(); stops.push(stop); return stop; },
    session(id, advance = true) {
      if (advance) generation++;
      auth.setState({ user: id === null ? null : { id, email: `${id}@example.test` }, accessToken: id === null ? null : `token-${id}` });
    },
    cleanup() { stops.forEach(stop => stop()); load('services/queryClient.ts').queryClient.clear(); },
  };
  runtimes.add(h);
  return h;
}
test.afterEach(() => { for (const h of runtimes) h.cleanup(); runtimes.clear(); });

for (const platform of ['android', 'ios']) {
  test(`${platform}: startup acquires before login and reuses the token across accounts/restoration`, async () => {
    const h = harness({ platform });
    h.start();
    await tick();
    assert.equal(h.auth.getState().user, undefined);
    assert.equal(h.auth.getState().pushNotificationToken, 'synthetic-expo-token');
    assert.equal(h.store.getState().tokenStatus, 'available');
    if (platform === 'android') {
      assert.equal(h.native.calls[1][0], 'channel');
      assert.ok(h.native.calls.findIndex(([name]) => name === 'channel') < h.native.calls.findIndex(([name]) => name === 'permission'));
    }
    h.session(1, false); // Restored session keeps its generation.
    h.session(null);
    h.session(2);
    await tick();
    assert.equal(h.native.count('expoToken'), 1);
    assert.equal(h.native.count('requestPermission'), 0);
    assert.equal(h.auth.getState().user.id, 2);
  });
}

test('token acquisition remains single-flight across login, logout, switching, and root remounts', async () => {
  const pending = deferred();
  const h = harness({ getToken: () => pending.promise });
  const stop = h.start();
  await tick();
  h.session(1);
  h.session(null);
  h.session(2);
  stop();
  h.start();
  assert.equal(h.native.count('expoToken'), 1);
  pending.resolve({ data: 'device-token-after-switch' });
  await tick();
  assert.equal(h.auth.getState().user.id, 2);
  assert.equal(h.auth.getState().pushNotificationToken, 'device-token-after-switch');
  assert.equal(h.native.maxima.received, 1);
  assert.equal(h.native.maxima.response, 1);
  assert.equal(h.native.maxima.token, 1);
});

test('multiple owners share listeners; final cleanup ignores stale callbacks even after remount', async () => {
  const h = harness();
  const first = h.start(), second = h.start();
  await tick();
  for (const kind of ['received', 'response', 'token', 'appState']) assert.equal(h.native.active(kind), 1);
  first(); first();
  assert.equal(h.native.active('received'), 1);
  second();
  for (const kind of ['received', 'response', 'token', 'appState']) assert.equal(h.native.active(kind), 0);
  h.start();
  h.native.history.received[0](response('stale').notification);
  h.native.history.response[0](response('stale'));
  assert.equal(h.store.getState().notification, null);
  assert.equal(h.store.getState().pendingResponse, null);
  assert.equal(h.native.count('expoToken'), 1);
});

test('permission prompt happens before authentication, once, and denial leaves listeners usable', async () => {
  const h = harness({ permission: { status: 'undetermined', granted: false, canAskAgain: true } });
  const stop = h.start();
  await tick();
  assert.equal(h.native.count('requestPermission'), 1);
  assert.equal(h.native.count('expoToken'), 0);
  assert.equal(h.store.getState().tokenStatus, 'denied');
  assert.equal(h.auth.getState().user, undefined);
  stop(); h.start();
  h.session(1);
  await tick();
  assert.equal(h.native.count('requestPermission'), 1);
  h.native.emit('received', response().notification);
  assert.ok(h.store.getState().notification);
  assert.deepEqual(h.warnings, []);
});

test('denial without canAskAgain never prompts and iOS provisional authorization is accepted', async () => {
  const deniedRuntime = harness({ permission: denied });
  deniedRuntime.start();
  await tick();
  assert.equal(deniedRuntime.native.count('requestPermission'), 0);
  const provisional = harness({ permission: { ...denied, ios: { status: 3 } } });
  provisional.start();
  await tick();
  assert.equal(provisional.store.getState().tokenStatus, 'available');
  assert.equal(provisional.native.count('requestPermission'), 0);
});

for (const options of [{ noBackend: true }, { physical: false }, { expoGo: true }, { missingProject: true }]) {
  test(`unsupported/unconfigured environment: ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    h.start();
    await tick();
    assert.equal(await h.service.refreshPushToken(), null);
    assert.equal(h.native.count('expoToken'), 0);
    assert.equal(h.native.count('requestPermission'), 0);
    assert.equal(h.store.getState().tokenStatus, 'unavailable');
    if (options.noBackend) assert.equal(h.native.active('received'), 0);
  });
}

for (const failure of ['channelError', 'permissionError', 'requestError', 'getToken', 'emptyToken']) {
  test(`${failure} is contained without a rejected startup operation or token leakage`, async () => {
    const h = harness({ platform: 'android',
      ...(failure === 'getToken' ? { getToken: async () => { throw new Error('Sensitive native details'); } } :
        failure === 'emptyToken' ? { getToken: async () => ({ data: '' }) } : { [failure]: true }),
      ...(failure === 'requestError' ? { permission: { ...denied, canAskAgain: true } } : {}),
    });
    h.start();
    await tick();
    assert.equal(h.store.getState().tokenStatus, 'error');
    assert.equal(h.auth.getState().pushNotificationToken, null);
    assert.deepEqual(h.warnings, ['Could not acquire the Expo push token.']);
    assert.equal(h.native.active('received'), 1);
  });
}

test('foregrounding retries failure and detects permission changes without prompting or refetching a valid token', async () => {
  let fail = true;
  const h = harness({ getToken: async () => {
    if (fail) throw new Error('Offline');
    return { data: 'recovered-token' };
  } });
  h.start(); await tick();
  fail = false;
  h.native.emit('appState', 'active'); await tick();
  assert.equal(h.auth.getState().pushNotificationToken, 'recovered-token');
  h.native.emit('appState', 'active'); await tick();
  assert.equal(h.native.count('expoToken'), 2);
  h.native.setPermission(denied);
  h.native.emit('appState', 'active'); await tick();
  assert.equal(h.auth.getState().pushNotificationToken, null);
  assert.equal(h.store.getState().tokenStatus, 'denied');
  h.native.setPermission({ status: 'granted', granted: true });
  h.native.emit('appState', 'active'); await tick();
  assert.equal(h.store.getState().tokenStatus, 'available');
  assert.equal(h.native.count('requestPermission'), 0);
});

test('native token rotation during acquisition publishes only the latest result and ignores duplicate events', async () => {
  const pending = deferred();
  let calls = 0;
  const h = harness({ getToken: async () => ++calls === 1 ? pending.promise : { data: 'rotated-expo-token' } });
  h.start(); await tick();
  const token = { type: 'ios', data: 'rotated-native-token' };
  h.native.emit('token', token);
  h.native.emit('token', token);
  pending.resolve({ data: 'obsolete-expo-token' });
  await tick();
  assert.equal(h.auth.getState().pushNotificationToken, 'rotated-expo-token');
  assert.equal(calls, 2);
  assert.equal(h.native.calls.filter(([kind]) => kind === 'expoToken')[1][1].devicePushToken, token);
  h.native.emit('token', token); await tick();
  assert.equal(calls, 2);
});

test('foreground presentation flags are preserved and foreground data clears when the account changes', async () => {
  const h = harness();
  h.start(); h.session(1);
  assert.deepEqual({ ...await h.native.handler.handleNotification() }, {
    shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true,
  });
  const notification = response().notification;
  h.native.emit('received', notification);
  assert.equal(h.store.getState().notification, notification);
  h.session(2);
  assert.equal(h.store.getState().notification, null);
  await tick();
});

test('cold-start tap waits for readiness and restoration, is deduplicated, and is handed off once without interpreting data', async () => {
  const tap = response('cold', { url: '/not-a-service-provider-route', userId: 'untrusted' });
  const h = harness({ lastResponse: tap });
  const stop = h.start();
  h.native.emit('response', tap);
  assert.equal(h.service.takeNotificationResponse(false), null);
  assert.equal(h.service.takeNotificationResponse(true), null, 'No session yet');
  h.session(1, false);
  assert.equal(h.service.takeNotificationResponse(false), null);
  assert.equal(h.service.takeNotificationResponse(true), tap);
  assert.equal(h.service.takeNotificationResponse(true), null);
  stop(); h.start();
  h.native.emit('response', tap);
  assert.equal(h.service.takeNotificationResponse(true), null);
  assert.equal(h.native.count('clearResponse'), 1);
  await tick();
});

test('open-app taps and queued responses cannot cross logout, account switching, or explicit-login generations', async () => {
  const h = harness();
  h.start();
  h.native.emit('response', response('pre-login'));
  h.session(1);
  assert.equal(h.service.takeNotificationResponse(true), null);
  h.native.emit('response', response('account-1'));
  h.session(null);
  h.session(2);
  assert.equal(h.service.takeNotificationResponse(true), null);
  const tap = response('account-2');
  h.native.emit('response', tap);
  assert.equal(h.service.takeNotificationResponse(true), tap);
  await tick();
});

test('response read/clear failures do not remove live listeners or repeat a consumed tap', async () => {
  const h = harness({ lastResponseError: true, clearResponseError: true });
  h.start(); h.session(1);
  const tap = response();
  h.native.emit('response', tap);
  assert.equal(h.service.takeNotificationResponse(true), tap);
  assert.equal(h.service.takeNotificationResponse(true), null);
  assert.equal(h.native.active('response'), 1);
  assert.equal(h.warnings.length, 2);
  await tick();
});

test('partial listener setup failure cleans up subscriptions and a later remount can retry', async () => {
  const options = { listenerError: 'response' };
  const h = harness(options);
  const stop = h.start();
  assert.equal(h.native.active('received'), 0);
  stop();
  assert.deepEqual(h.warnings, ['Could not start notification listeners.']);
  delete options.listenerError;
  h.start();
  assert.equal(h.native.active('received'), 1);
  assert.equal(h.native.active('response'), 1);
  await tick();
});

test('account changes while the root is unmounted clear previous notification data on remount', async () => {
  const h = harness();
  h.session(1);
  const stop = h.start();
  h.native.emit('received', response('previous-account').notification);
  h.native.emit('response', response('previous-account'));
  stop();
  h.session(2);
  h.start();
  assert.equal(h.store.getState().notification, null);
  assert.equal(h.store.getState().pendingResponse, null);
  await tick();
});
