// Run with: node tests/authSession.test.cjs
// Execute the real TypeScript modules with deferred native/network boundaries.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const axios = require('axios');
const ts = require('typescript');
const { MutationObserver, QueryClient, QueryObserver } = require('@tanstack/react-query');

const root = path.resolve(__dirname, '..');
const compiled = new Map();
const clients = new Set();
test.afterEach(() => {
  for (const client of clients) client.clear();
  clients.clear();
});
const account = (id, suffix = '') => ({
  user: { id, email: `${id}@example.test` },
  accessToken: `${id}-access${suffix}`,
  refreshToken: `${id}-refresh${suffix}`,
});
const responseFor = ({ user, accessToken, refreshToken }) => ({
  data: { data: { user, token: { accessToken, refreshToken } } },
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const observe = promise => promise.then(
  value => ({ status: 'fulfilled', value }),
  reason => ({ status: 'rejected', reason }),
);
const tick = () => new Promise(resolve => setImmediate(resolve));
const until = async predicate => {
  for (let i = 0; i < 20; i++) {
    if (predicate()) return;
    await tick();
  }
  assert.ok(predicate(), 'Expected asynchronous boundary was not reached');
};

function harness({ saved = 'A-refresh', signedIn = true } = {}) {
  let disk = saved;
  let activeStorage = 0;
  let maxActiveStorage = 0;
  const storage = [], refreshes = [], requests = [], toasts = [], navigation = [], registrations = [], logs = [];
  const holds = { get: [], set: [], delete: [] };
  const mutationHolds = [];
  const holdNext = kind => {
    const started = deferred(), finished = deferred();
    holds[kind].push({ started, finished });
    return { started: started.promise, release: finished.resolve, fail: finished.reject };
  };
  const nativeStorage = async (kind, key, value) => {
    assert.equal(key, 'refresh_token');
    storage.push({ kind, value });
    const readValue = disk;
    const hold = holds[kind].shift();
    maxActiveStorage = Math.max(maxActiveStorage, ++activeStorage);
    try {
      if (hold) {
        hold.started.resolve();
        await hold.finished.promise;
      }
      if (kind === 'get') return readValue;
      disk = kind === 'set' ? value : null;
    } finally {
      activeStorage--;
    }
  };
  const modules = new Map();
  const router = {
    push: destination => navigation.push(['push', destination]),
    replace: destination => navigation.push(['replace', destination]),
  };
  const onMutationStart = async () => {
    const hold = mutationHolds.shift();
    if (hold) {
      hold.started.resolve();
      await hold.finished.promise;
    }
  };
  const external = {
    axios,
    zustand: require('zustand'),
    'expo-secure-store': {
      getItemAsync: key => nativeStorage('get', key),
      setItemAsync: (key, value) => nativeStorage('set', key, value),
      deleteItemAsync: key => nativeStorage('delete', key),
    },
    '@tanstack/react-query': { QueryClient, useQuery: options => options, useMutation: options => {
      const observer = new MutationObserver(queryClient, options);
      return { ...options, mutateAsync: variables => observer.mutate(variables) };
    } },
    'expo-router': { useRouter: () => router },
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) {
      compiled.set(file, ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText);
    }
    const module = { exports: {} };
    modules.set(file, module);
    vm.runInNewContext(compiled.get(file), {
      module, exports: module.exports, setTimeout, clearTimeout, URLSearchParams,
      process: { env: { EXPO_PUBLIC_BASE_URL: 'https://api.example.test' } },
      console: Object.fromEntries(['log', 'warn', 'error'].map(name => [name, (...args) => logs.push(args)])),
      require: id => {
        if (file === 'services/authSession.ts' && id === 'axios') return { post: (url, body, config) => {
          const pending = deferred();
          refreshes.push({ url, body, config, ...pending });
          return pending.promise;
        } };
        if (id === '@/stores/toastStore') return { useToastStore: Object.assign(
          select => select({ showToast: (...args) => toasts.push(args) }),
          { getState: () => ({ showToast: (...args) => toasts.push(args) }) },
        ) };
        if (file.startsWith('hooks/') && id === '@/stores/authStore') {
          return { useAuthStore: select => select(load('stores/authStore.ts').useAuthStore.getState()) };
        }
        if (file === 'hooks/useAuth.ts' && id === './useNotification') {
          return { useNotification: () => ({ registerNotification: { mutate: payload => registrations.push(payload) } }) };
        }
        if (Object.hasOwn(external, id)) return external[id];
        const relative = id.startsWith('@/') ? id.slice(2) : path.posix.join(path.posix.dirname(file), id);
        assert.ok(id.startsWith('@/') || id.startsWith('.'), `Unexpected module: ${id}`);
        return load(`${relative}.ts`);
      },
    }, { filename: file });
    return module.exports;
  }
  const queryClient = load('services/queryClient.ts').queryClient;
  queryClient.getMutationCache().config.onMutate = onMutationStart;
  clients.add(queryClient);
  const store = load('stores/authStore.ts').useAuthStore;
  if (signedIn) store.setState({ user: account('A').user, accessToken: account('A').accessToken });
  store.getState().setPushNotificationToken('synthetic-push-token');
  const session = load('services/authSession.ts');
  const api = load('services/api.ts').default;
  const ok = (config, data = {}) => ({ status: 200, statusText: 'OK', config, headers: {}, data });
  const unauthorized = config => new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, {}, {
    status: 401, statusText: 'Unauthorized', config, headers: {}, data: {},
  });
  let adapter = config => Promise.resolve(ok(config));
  api.defaults.adapter = config => {
    requests.push(config);
    return adapter(config);
  };
  return {
    store, session, api, queryClient, refreshes, storage, requests, toasts, navigation, registrations, logs, holdNext,
    holdNextMutation: () => {
      const started = deferred(), finished = deferred();
      mutationHolds.push({ started, finished });
      return { started: started.promise, release: finished.resolve };
    },
    get disk() { return disk; }, get maxActiveStorage() { return maxActiveStorage; },
    auth: () => load('hooks/useAuth.ts').useAuth(),
    restoreUser: () => load('utility/restoreUser.ts').restoreUser(),
    lookup: (...args) => load('hooks/useLookup.ts').useLookup(...args),
    regions: (...args) => load('hooks/useGetLocations.ts').useGetLocations(...args),
    cities: (...args) => load('hooks/useGetLocations.ts').useCities(...args),
    setAdapter: value => { adapter = value; }, ok, unauthorized,
    requireRefresh: () => { adapter = async config => {
      if (!config._retry) throw unauthorized(config);
      return ok(config, { protected: true });
    }; },
  };
}

test('normal login persists credentials and normal logout clears the session', async () => {
  const h = harness({ saved: null, signedIn: false });
  const generation = await h.session.setAuthenticatedSession(account('A'));
  assert.equal(generation, h.session.getSessionGeneration());
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.store.getState().accessToken, 'A-access');
  await h.session.clearSession();
  assert.equal(h.disk, null);
  assert.equal(h.store.getState().user, null);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.store.getState().pushNotificationToken, 'synthetic-push-token');
});

test('concurrent 401s share one refresh and replay with the refreshed token', async () => {
  const h = harness();
  h.requireRefresh();
  const pending = Promise.all([h.api.get('/one'), h.api.post('/two', { value: 1 }), h.api.get('/three')]);
  await until(() => h.refreshes.length === 1);
  assert.equal(h.requests.length, 3);
  assert.equal(h.refreshes[0].body.refreshToken, 'A-refresh');
  assert.equal(h.refreshes[0].config.timeout, 60000);
  h.refreshes[0].resolve(responseFor(account('A', '-new')));
  const results = await pending;
  assert.ok(results.every(result => result.data.protected));
  assert.equal(h.refreshes.length, 1);
  assert.equal(h.requests.length, 6);
  assert.ok(h.requests.slice(3).every(config => config.headers.get('Authorization') === 'Bearer A-access-new'));
  assert.equal(h.disk, 'A-refresh-new');
  assert.equal(h.store.getState().accessToken, 'A-access-new');
});

test('session restoration still shares a refresh and restores saved credentials', async () => {
  const h = harness({ signedIn: false });
  const pending = Promise.all([h.restoreUser(), h.restoreUser()]);
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-restored')));
  await pending;
  assert.equal(h.refreshes.length, 1);
  assert.equal(h.disk, 'A-refresh-restored');
  assert.equal(h.store.getState().accessToken, 'A-access-restored');
});

for (const outcome of ['success', 'failure']) {
  test(`old refresh ${outcome} after logout cannot restore credentials or replay requests`, async () => {
    const h = harness();
    h.requireRefresh();
    const pending = observe(h.api.get('/protected'));
    await until(() => h.refreshes.length === 1);
    await h.session.clearSession();
    if (outcome === 'success') h.refreshes[0].resolve(responseFor(account('A', '-stale')));
    else h.refreshes[0].reject(new Error('Old refresh failed'));
    assert.equal((await pending).status, 'rejected');
    assert.equal(h.requests.length, 1);
    assert.equal(h.disk, null);
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.session.isRefreshBlocked(), false);
    assert.equal(h.toasts.length, 0);
    assert.equal(h.storage.filter(op => op.kind === 'set').length, 0);
  });

  test(`old refresh ${outcome} after another account logs in cannot change that session`, async () => {
    const h = harness();
    h.requireRefresh();
    const pending = observe(h.api.get('/account-A'));
    await until(() => h.refreshes.length === 1);
    await h.session.setAuthenticatedSession(account('B'));
    if (outcome === 'success') h.refreshes[0].resolve(responseFor(account('A', '-stale')));
    else h.refreshes[0].reject(new Error('Old refresh failed'));
    assert.equal((await pending).status, 'rejected');
    assert.equal(h.requests.length, 1);
    assert.equal(h.store.getState().user.id, 'B');
    assert.equal(h.store.getState().accessToken, 'B-access');
    assert.equal(h.disk, 'B-refresh');
    assert.equal(h.session.isRefreshBlocked(), false);
    assert.equal(h.toasts.length, 0);
    assert.equal(h.storage.filter(op => op.kind === 'delete').length, 0);
  });
}

test('a refresh waiting on an old stored-token read cannot start after a new login', async () => {
  const h = harness();
  const read = h.holdNext('get');
  const refresh = h.session.refreshAccessToken();
  await read.started;
  const login = h.session.setAuthenticatedSession(account('B'));
  read.release();
  assert.equal(await refresh, null);
  await login;
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().user.id, 'B');
});

test('a delayed refresh-token write completes before the logout deletion', async () => {
  const h = harness();
  h.requireRefresh();
  const write = h.holdNext('set');
  const request = observe(h.api.get('/protected'));
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-rotated')));
  await write.started;
  const logout = h.session.clearSession();
  await tick();
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 0);
  write.release();
  await logout;
  assert.equal((await request).status, 'rejected');
  assert.equal(h.disk, null);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.requests.length, 1);
  assert.equal(h.maxActiveStorage, 1);
});

for (const writeFails of [false, true]) {
  test(`a delayed old credential write ${writeFails ? 'failure' : 'success'} cannot overwrite a newer login`, async () => {
    const h = harness();
    const write = h.holdNext('set');
    const refresh = h.session.refreshAccessToken();
    await until(() => h.refreshes.length === 1);
    h.refreshes[0].resolve(responseFor(account('A', '-rotated')));
    await write.started;
    const login = h.session.setAuthenticatedSession(account('B'));
    assert.equal(h.store.getState().accessToken, 'B-access');
    if (writeFails) write.fail(new Error('Old native write failed'));
    else write.release();
    assert.equal(await refresh, null);
    await login;
    assert.equal(h.disk, 'B-refresh');
    assert.equal(h.store.getState().accessToken, 'B-access');
    assert.equal(h.session.isRefreshBlocked(), false);
    assert.equal(h.maxActiveStorage, 1);
  });
}

test('a delayed old failure deletion cannot clear a newer login or delete its credentials last', async () => {
  const h = harness();
  const deletion = h.holdNext('delete');
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].reject(new Error('Refresh failed'));
  await deletion.started;
  const login = h.session.setAuthenticatedSession(account('B'));
  deletion.release();
  assert.equal(await refresh, null);
  await login;
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().user.id, 'B');
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.maxActiveStorage, 1);
});

test('queued writes are skipped if their session was replaced before native storage starts', async () => {
  const h = harness();
  let login;
  const unsubscribe = h.store.subscribe(state => {
    if (state.accessToken === 'A-access-rotated') {
      unsubscribe();
      login = h.session.setAuthenticatedSession(account('B'));
    }
  });
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-rotated')));
  assert.equal(await refresh, null);
  await login;
  assert.equal(h.disk, 'B-refresh');
  assert.deepEqual(h.storage.filter(op => op.kind === 'set').map(op => op.value), ['B-refresh']);
});

for (const outcome of ['success', 'failure']) {
  test(`an old refresh ${outcome} finalizer cannot detach a newer shared refresh`, async () => {
    const h = harness();
    const oldRefresh = h.session.refreshAccessToken();
    await until(() => h.refreshes.length === 1);
    await h.session.setAuthenticatedSession(account('B'));
    const newRefresh = h.session.refreshAccessToken();
    await until(() => h.refreshes.length === 2);
    if (outcome === 'success') h.refreshes[0].resolve(responseFor(account('A', '-stale')));
    else h.refreshes[0].reject(new Error('Old refresh failed'));
    assert.equal(await oldRefresh, null);
    const concurrent = h.session.refreshAccessToken();
    await tick();
    assert.equal(h.refreshes.length, 2);
    h.refreshes[1].resolve(responseFor(account('B', '-new')));
    assert.deepEqual(await Promise.all([newRefresh, concurrent]), ['B-access-new', 'B-access-new']);
    assert.equal(h.disk, 'B-refresh-new');
  });
}

test('a stale restore read cannot clear or block a newer login', async () => {
  const h = harness({ saved: null, signedIn: false });
  const read = h.holdNext('get');
  const restore = h.restoreUser();
  await read.started;
  const login = h.session.setAuthenticatedSession(account('B'));
  read.release();
  await Promise.all([restore, login]);
  assert.equal(h.store.getState().user.id, 'B');
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.refreshes.length, 0);
});

test('a restore waiting on storage cannot resurrect a session after logout', async () => {
  const h = harness({ signedIn: false });
  const read = h.holdNext('get');
  const restore = h.restoreUser();
  await read.started;
  const logout = h.session.clearSession();
  read.release();
  await Promise.all([restore, logout]);
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.disk, null);
  assert.equal(h.store.getState().accessToken, null);
});

test('an old restore finalizer cannot detach a newer restore operation', async () => {
  const h = harness({ signedIn: false });
  const oldRestore = h.restoreUser();
  await until(() => h.refreshes.length === 1);
  await h.session.setAuthenticatedSession(account('B'));
  const newRestore = h.restoreUser();
  await until(() => h.refreshes.length === 2);
  h.refreshes[0].resolve(responseFor(account('A', '-stale')));
  await oldRestore;
  const reads = h.storage.filter(op => op.kind === 'get').length;
  const concurrent = h.restoreUser();
  await tick();
  assert.equal(h.storage.filter(op => op.kind === 'get').length, reads);
  h.refreshes[1].resolve(responseFor(account('B', '-new')));
  await Promise.all([newRestore, concurrent]);
  assert.equal(h.disk, 'B-refresh-new');
});

test('a late 401 from the previous account cannot refresh or replay under the new account', async () => {
  const h = harness();
  const reply = deferred();
  h.setAdapter(() => reply.promise);
  const pending = observe(h.api.get('/account-A'));
  assert.equal(h.requests.length, 1);
  const originalError = h.unauthorized(h.requests[0]);
  await h.session.setAuthenticatedSession(account('B'));
  reply.reject(originalError);
  const result = await pending;
  assert.equal(result.reason, originalError);
  assert.equal(h.requests.length, 1);
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.toasts.length, 0);
});

test('a session transition after refresh resolves but before retry is consumed prevents replay', async () => {
  const h = harness();
  h.requireRefresh();
  const originalRefresh = h.session.refreshAccessToken;
  h.session.refreshAccessToken = async () => {
    const token = await originalRefresh();
    await h.session.setAuthenticatedSession(account('B'));
    return token;
  };
  const pending = observe(h.api.get('/account-A'));
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-new')));
  assert.equal((await pending).status, 'rejected');
  assert.equal(h.requests.length, 1);
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.toasts.length, 0);
});

test('dispatch rejects a retry bound to a superseded generation without sending it', async () => {
  const h = harness();
  const generation = h.session.getSessionGeneration();
  await h.session.setAuthenticatedSession(account('B'));
  const result = await observe(h.api.get('/account-A', { _retry: true, _sessionGeneration: generation }));
  assert.equal(result.status, 'rejected');
  assert.ok(axios.isCancel(result.reason));
  assert.equal(h.requests.length, 0);
  assert.equal(h.toasts.length, 0);
});

test('active-session refresh failures retain blocking, local cleanup, and one expiry toast', async () => {
  const h = harness();
  h.requireRefresh();
  const pending = Promise.all([observe(h.api.get('/one')), observe(h.api.get('/two'))]);
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].reject(new Error('Refresh failed'));
  const results = await pending;
  assert.ok(results.every(result => result.reason.message === 'Refresh failed'));
  assert.equal(h.disk, null);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.session.isRefreshBlocked(), true);
  assert.equal(h.toasts.length, 1);
  await observe(h.api.get('/three'));
  assert.equal(h.refreshes.length, 1);
});

test('logout invalidates refresh immediately, and a delayed server logout cannot clear a newer login', async () => {
  const h = harness();
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  const logoutReply = deferred();
  h.setAdapter(() => logoutReply.promise);
  const logout = h.auth().logoutAndGoToLogin();
  assert.equal(h.session.isRefreshBlocked(), true);
  await until(() => h.requests.length === 1);
  assert.equal(h.requests[0].headers.get('Authorization'), 'Bearer A-access');
  assert.equal(JSON.parse(h.requests[0].data).refreshToken, 'A-refresh');
  h.refreshes[0].resolve(responseFor(account('A', '-stale')));
  assert.equal(await refresh, null);
  assert.equal(h.disk, 'A-refresh');
  await h.session.setAuthenticatedSession(account('B'));
  logoutReply.resolve(h.ok(h.requests[0]));
  await logout;
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().user.id, 'B');
  assert.equal(h.navigation.length, 0);
});

test('normal logout still informs the server, clears credentials, and navigates to login', async () => {
  const h = harness();
  await h.auth().logoutAndGoToLogin();
  assert.equal(h.requests.length, 1);
  assert.equal(JSON.parse(h.requests[0].data).refreshToken, 'A-refresh');
  assert.equal(h.disk, null);
  assert.equal(h.store.getState().accessToken, null);
  assert.deepEqual(h.navigation, [['replace', '/(auth)']]);
});

test('a queued logout mutation cannot dispatch against a newer account', async () => {
  const h = harness();
  const mutation = h.holdNextMutation();
  const logout = h.auth().logoutAndGoToLogin();
  await mutation.started;
  await h.session.setAuthenticatedSession(account('B'));
  mutation.release();
  await logout;
  assert.equal(h.requests.length, 0);
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().user.id, 'B');
  assert.equal(h.navigation.length, 0);
});

test('login and both email-verification callbacks still persist sessions and register push tokens', async () => {
  const h = harness({ saved: null, signedIn: false });
  const auth = h.auth();
  for (const mutation of [auth.loginMutation, auth.verifyEmailMutation, auth.verifyNewEmailMutation]) {
    await mutation.onSuccess(responseFor(account('B')).data);
    assert.equal(h.disk, 'B-refresh');
    assert.equal(h.store.getState().user.id, 'B');
  }
  assert.equal(h.registrations.length, 3);
});

test('a login awaiting persistence cannot unblock logout or register stale push credentials', async () => {
  const h = harness({ saved: null, signedIn: false });
  const auth = h.auth();
  const write = h.holdNext('set');
  const login = auth.loginMutation.onSuccess(responseFor(account('A')).data);
  await write.started;
  const logoutReply = deferred();
  h.setAdapter(() => logoutReply.promise);
  const logout = auth.logoutAndGoToLogin();
  assert.equal(h.session.isRefreshBlocked(), true);
  write.release();
  await login;
  await until(() => h.requests.length === 1);
  assert.equal(h.session.isRefreshBlocked(), true);
  assert.equal(h.registrations.length, 0);
  logoutReply.resolve(h.ok(h.requests[0]));
  await logout;
  assert.equal(h.disk, null);
});

test('logout removes account A query/mutation caches before account B logs in', async () => {
  const h = harness();
  h.queryClient.setQueryData(['private-profile'], { owner: 'A' });
  h.queryClient.setQueryData(['shared-lookups'], { label: 'Shared' });
  const mutation = new MutationObserver(h.queryClient, { mutationFn: async () => ({ privateOwner: 'A' }) });
  await mutation.mutate({ privateOwner: 'A' });
  assert.equal(h.queryClient.getMutationCache().getAll().length, 1);
  await h.auth().logoutAndGoToLogin();
  assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
  assert.equal(h.queryClient.getMutationCache().getAll().length, 0);
  await h.session.setAuthenticatedSession(account('B'));
  assert.equal(h.queryClient.getQueryData(['private-profile']), undefined);
  assert.equal(h.queryClient.getQueryData(['shared-lookups']), undefined);
});

for (const consumesSignal of [false, true]) {
  test(`late A results cannot overwrite B's identical query key (${consumesSignal ? 'with' : 'without'} abort support)`, async () => {
    const h = harness();
    const replyA = deferred();
    let signalA;
    const pendingA = observe(h.queryClient.fetchQuery({
      queryKey: ['private-profile'],
      queryFn: context => {
        if (consumesSignal) signalA = context.signal;
        return replyA.promise;
      },
    }));
    await h.session.setAuthenticatedSession(account('B'));
    if (consumesSignal) assert.equal(signalA.aborted, true);
    assert.equal((await pendingA).status, 'rejected');
    await h.queryClient.fetchQuery({ queryKey: ['private-profile'], queryFn: async () => ({ owner: 'B' }) });
    replyA.resolve({ owner: 'A' });
    await tick();
    assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'B');
  });
}

test('same-account refresh preserves private/shared caches, mutation records, and pending queries', async () => {
  const h = harness();
  h.queryClient.setQueryData(['private-profile'], { owner: 'A' });
  h.queryClient.setQueryData(['shared-lookups'], { label: 'Shared' });
  const mutation = new MutationObserver(h.queryClient, { mutationFn: async () => ({ owner: 'A' }) });
  await mutation.mutate({ owner: 'A' });
  const records = h.queryClient.getMutationCache().getAll();
  const reply = deferred();
  let signal;
  const pending = h.queryClient.fetchQuery({ queryKey: ['private-details'], queryFn: context => {
    signal = context.signal;
    return reply.promise;
  } });
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-new')));
  assert.equal(await refresh, 'A-access-new');
  assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'A');
  assert.equal(h.queryClient.getQueryData(['shared-lookups']).label, 'Shared');
  assert.deepEqual(h.queryClient.getMutationCache().getAll(), records);
  assert.equal(signal.aborted, false);
  reply.resolve({ owner: 'A' });
  assert.equal((await pending).owner, 'A');
});

test('first login also clears anonymous/public data and active anonymous queries', async () => {
  const h = harness({ saved: null, signedIn: false });
  h.queryClient.setQueryData(['shared-lookups'], { label: 'Anonymous' });
  const reply = deferred();
  let signal;
  const pending = observe(h.queryClient.fetchQuery({ queryKey: ['public-pending'], queryFn: context => {
    signal = context.signal;
    return reply.promise;
  } }));
  await h.session.setAuthenticatedSession(account('A'));
  assert.equal(signal.aborted, true);
  assert.equal((await pending).status, 'rejected');
  reply.resolve({ label: 'Anonymous' });
  await tick();
  assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
});

test('restoration without a saved session clears cached data even before an identity is known', async () => {
  const h = harness({ saved: null, signedIn: false });
  h.queryClient.setQueryData(['shared-lookups'], { label: 'Previous' });
  await h.restoreUser();
  assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
});

for (const signedIn of [false, true]) {
  test(`direct clearAuth also clears caches (${signedIn ? 'authenticated' : 'startup'} state)`, () => {
    const h = harness({ signedIn });
    h.queryClient.setQueryData(['cached-data'], { owner: 'Previous' });
    h.store.getState().clearAuth();
    assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
  });
}

test('expiration cancels active private queries immediately and delayed deletion cannot cancel B queries', async () => {
  const h = harness();
  const replyA = deferred(), replyB = deferred();
  let signalA, signalB;
  const pendingA = observe(h.queryClient.fetchQuery({ queryKey: ['private-details'], queryFn: context => {
    signalA = context.signal;
    return replyA.promise;
  } }));
  const deletion = h.holdNext('delete');
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].reject({ response: { status: 401, data: { title: 'INVALID_REFRESH_TOKEN' } } });
  await deletion.started;
  assert.equal(signalA.aborted, true);
  assert.equal((await pendingA).status, 'rejected');
  assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
  const login = h.session.setAuthenticatedSession(account('B'));
  const pendingB = h.queryClient.fetchQuery({ queryKey: ['private-details'], queryFn: context => {
    signalB = context.signal;
    return replyB.promise;
  } });
  deletion.release();
  await Promise.all([refresh, login]);
  assert.equal(signalB.aborted, false);
  replyA.resolve({ owner: 'A' });
  replyB.resolve({ owner: 'B' });
  await pendingB;
  await tick();
  assert.equal(h.queryClient.getQueryData(['private-details']).owner, 'B');
});

for (const outcome of ['success', 'failure']) {
  test(`a stale refresh ${outcome} cannot clear or cancel the new account's cache`, async () => {
    const h = harness();
    const refresh = h.session.refreshAccessToken();
    await until(() => h.refreshes.length === 1);
    await h.session.setAuthenticatedSession(account('B'));
    h.queryClient.setQueryData(['private-profile'], { owner: 'B' });
    const replyB = deferred();
    let signalB;
    const pendingB = h.queryClient.fetchQuery({ queryKey: ['private-details'], queryFn: context => {
      signalB = context.signal;
      return replyB.promise;
    } });
    if (outcome === 'success') h.refreshes[0].resolve(responseFor(account('A', '-stale')));
    else h.refreshes[0].reject(new Error('Old refresh failed'));
    await refresh;
    assert.equal(signalB.aborted, false);
    assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'B');
    replyB.resolve({ owner: 'B' });
    await pendingB;
  });
}

test('logout clears immediately and its delayed server completion cannot clear B caches', async () => {
  const h = harness();
  h.queryClient.setQueryData(['private-profile'], { owner: 'A' });
  const reply = deferred();
  h.setAdapter(() => reply.promise);
  const logout = h.auth().logoutAndGoToLogin();
  assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
  await until(() => h.requests.length === 1);
  await h.session.setAuthenticatedSession(account('B'));
  h.queryClient.setQueryData(['private-profile'], { owner: 'B' });
  reply.resolve(h.ok(h.requests[0]));
  await logout;
  assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'B');
  assert.equal(h.navigation.length, 0);
});

test('queries started during logout storage cleanup are removed before logout completes', async () => {
  const h = harness();
  const deletion = h.holdNext('delete');
  const logout = h.session.clearSession();
  await deletion.started;
  h.queryClient.setQueryData(['private-profile'], { owner: 'A' });
  deletion.release();
  await logout;
  assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
});

const retainedQueries = [
  ['lookups', h => h.lookup(['domain'], '/lookups')],
  ['regions', h => h.regions(['country'], '/regions')],
  ['cities', h => h.cities('lb', 1, 2, '/cities')],
];

for (const [name, optionsFor] of retainedQueries) {
  test(`${name} keys isolate identities and mounted observers do not reuse A data for B`, async () => {
    const h = harness();
    const optionsA = { ...optionsFor(h), enabled: false, gcTime: Infinity };
    const dataA = { owner: 'A', data: { cities: [{ owner: 'A' }] } };
    h.queryClient.setQueryData(optionsA.queryKey, dataA);
    const observer = new QueryObserver(h.queryClient, optionsA);
    const unsubscribe = observer.subscribe(() => {});
    try {
      assert.deepEqual(observer.getCurrentResult().data, name === 'cities' ? dataA.data.cities : dataA);
      await h.session.setAuthenticatedSession(account('B'));
      const optionsB = { ...optionsFor(h), enabled: false, gcTime: Infinity };
      assert.notDeepEqual(optionsA.queryKey, optionsB.queryKey);
      observer.setOptions(optionsB);
      assert.equal(observer.getCurrentResult().data, undefined);
      const dataB = { owner: 'B', data: { cities: [{ owner: 'B' }] } };
      h.queryClient.setQueryData(optionsB.queryKey, dataB);
      assert.equal(h.queryClient.getQueryData(optionsA.queryKey), undefined);
      assert.equal(h.queryClient.getQueryData(optionsB.queryKey).owner, 'B');
      assert.deepEqual(observer.getCurrentResult().data, name === 'cities' ? dataB.data.cities : dataB);
    } finally {
      unsubscribe();
    }
  });

  test(`${name} cancellation reaches Axios and its late response cannot repopulate B's cache`, async () => {
    const h = harness();
    const replyA = deferred(), replyB = deferred();
    h.setAdapter(config => config.headers.get('Authorization') === 'Bearer A-access' ? replyA.promise : replyB.promise);
    const optionsA = { ...optionsFor(h), gcTime: Infinity };
    const pendingA = observe(h.queryClient.fetchQuery({ ...optionsA, retry: false }));
    await until(() => h.requests.length === 1);
    const configA = h.requests[0];
    assert.equal(configA.signal.aborted, false);
    await h.session.setAuthenticatedSession(account('B'));
    assert.equal(configA.signal.aborted, true);
    assert.equal((await pendingA).status, 'rejected');
    const optionsB = { ...optionsFor(h), gcTime: Infinity };
    const pendingB = h.queryClient.fetchQuery({ ...optionsB, retry: false });
    await until(() => h.requests.length === 2);
    const configB = h.requests[1];
    assert.equal(configB.signal.aborted, false);
    replyA.resolve(h.ok(configA, { owner: 'A' }));
    replyB.resolve(h.ok(configB, { owner: 'B' }));
    await pendingB;
    await tick();
    assert.equal(h.queryClient.getQueryData(optionsA.queryKey), undefined);
    assert.equal(h.queryClient.getQueryData(optionsB.queryKey).owner, 'B');
  });
}

test('an old mutation completion cannot repopulate cleared mutation records or remove B records', async () => {
  const h = harness();
  const replyA = deferred(), replyB = deferred();
  const mutationA = new MutationObserver(h.queryClient, { mutationFn: () => replyA.promise });
  const pendingA = mutationA.mutate({ owner: 'A' });
  await tick();
  await h.session.setAuthenticatedSession(account('B'));
  assert.equal(h.queryClient.getMutationCache().getAll().length, 0);
  const mutationB = new MutationObserver(h.queryClient, { mutationFn: () => replyB.promise });
  const pendingB = mutationB.mutate({ owner: 'B' });
  await tick();
  replyA.resolve({ owner: 'A' });
  await pendingA;
  const records = h.queryClient.getMutationCache().getAll();
  assert.equal(records.length, 1);
  assert.equal(records[0].state.variables.owner, 'B');
  replyB.resolve({ owner: 'B' });
  await pendingB;
  assert.equal(records[0].state.data.owner, 'B');
});
