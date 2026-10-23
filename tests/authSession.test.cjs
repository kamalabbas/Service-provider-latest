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
const mutationSubscriptions = new Set();
test.afterEach(() => {
  for (const unsubscribe of mutationSubscriptions) unsubscribe();
  mutationSubscriptions.clear();
  for (const client of clients) client.clear();
  clients.clear();
});
const account = (id, suffix = '') => ({
  user: { id, email: `${id}@example.test` },
  accessToken: `${id}-access${suffix}`,
  refreshToken: `${id}-refresh${suffix}`,
});
const responseFor = ({ user, accessToken, refreshToken }) => ({
  data: { success: true, data: { user, token: { accessToken, refreshToken } } },
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

const policyRecord = state => JSON.stringify({ version: 1, state });
function harness({ saved = 'A-refresh', signedIn = true, policy = policyRecord('allowed'), persistence = { token: saved, policy }, scheduleTimeout = setTimeout } = {}) {
  let activeStorage = 0;
  let maxActiveStorage = 0;
  const storage = [], refreshes = [], requests = [], toasts = [], navigation = [], registrations = [], logs = [];
  const policyStorage = [], storageEvents = [];
  const holds = { get: [], set: [], delete: [], policyGet: [], policySet: [] };
  const mutationHolds = [], forms = [];
  const holdNext = kind => {
    const started = deferred(), finished = deferred();
    holds[kind].push({ started, finished });
    return {
      started: started.promise, release: finished.resolve, fail: finished.reject,
      failAfterEffect: error => finished.resolve(error),
      skipEffect: () => finished.resolve({ skipEffect: true }),
    };
  };
  const nativeStorage = async (kind, key, value) => {
    assert.equal(key, 'refresh_token');
    storage.push({ kind, value });
    storageEvents.push({ kind, value });
    const readValue = persistence.token;
    const hold = holds[kind].shift();
    maxActiveStorage = Math.max(maxActiveStorage, ++activeStorage);
    try {
      let failureAfterEffect;
      if (hold) {
        hold.started.resolve();
        failureAfterEffect = await hold.finished.promise;
      }
      if (failureAfterEffect?.skipEffect) return;
      if (kind === 'get') return readValue;
      persistence.token = kind === 'set' ? value : null;
      if (failureAfterEffect) throw failureAfterEffect;
    } finally {
      activeStorage--;
    }
  };
  const policyStorageOperation = async (kind, uri, value) => {
    assert.equal(uri, 'file:///app-private/documents/session-restore-policy.json');
    policyStorage.push({ kind, value });
    storageEvents.push({ kind, value });
    const previous = persistence.policy;
    const hold = holds[kind].shift();
    maxActiveStorage = Math.max(maxActiveStorage, ++activeStorage);
    try {
      let failureAfterEffect;
      if (hold) { hold.started.resolve(); failureAfterEffect = await hold.finished.promise; }
      if (failureAfterEffect?.skipEffect) return;
      if (kind === 'policyGet') {
        if (previous === null) throw new Error('No restore policy');
        return previous;
      }
      persistence.policy = value;
      if (failureAfterEffect) throw failureAfterEffect;
    } finally { activeStorage--; }
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
    'expo-file-system/legacy': {
      documentDirectory: 'file:///app-private/documents/',
      readAsStringAsync: uri => policyStorageOperation('policyGet', uri),
      writeAsStringAsync: (uri, value) => policyStorageOperation('policySet', uri, value),
    },
    '@tanstack/react-query': { QueryClient, useQuery: options => options, useMutation: options => {
      const observer = new MutationObserver(queryClient, options);
      mutationSubscriptions.add(observer.subscribe(() => {}));
      return { ...options, mutateAsync: (variables, callbacks) => observer.mutate(variables, callbacks),
        mutate: (variables, callbacks) => { void observer.mutate(variables, callbacks).catch(() => {}); },
      };
    } },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({ email: 'A@example.test', forgotPasswordToken: 'synthetic-reset-token' }), Link: 'Link' },
    react: require('react'),
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { StyleSheet: { create: styles => styles }, View: 'View' },
    'react-native-keyboard-aware-scroll-view': { KeyboardAwareScrollView: 'KeyboardAwareScrollView' },
    '@/hooks/useThemeColor': { useThemeColor: () => '#fff' },
    '@/hooks/usePushNotification': { __esModule: true, default: () => {} },
    '@hookform/resolvers/yup': require('@hookform/resolvers/yup'),
    yup: require('yup'),
    'react-hook-form': {
      Controller: 'Controller',
      useForm: options => {
        const form = { values: options.defaultValues, errors: {} };
        forms.push(form);
        return { control: {}, formState: { errors: form.errors }, handleSubmit: submit => async () => {
          const result = await options.resolver(form.values, {}, { criteriaMode: 'all', fields: {} });
          Object.assign(form.errors, result.errors);
          if (Object.keys(result.errors).length === 0) await submit(result.values);
        } };
      },
    },
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) {
      compiled.set(file, ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      }).outputText);
    }
    const module = { exports: {} };
    modules.set(file, module);
    vm.runInNewContext(compiled.get(file), {
      module, exports: module.exports, setTimeout: scheduleTimeout, clearTimeout, URL, URLSearchParams,
      process: { env: { EXPO_PUBLIC_BASE_URL: 'https://api.example.test' } },
      console: Object.fromEntries(['log', 'warn', 'error'].map(name => [name, (...args) => logs.push(args)])),
      require: id => {
        if (file === 'services/authSession.ts' && id === 'axios') return { post: (url, body, config) => {
          const pending = deferred();
          refreshes.push({ url, body, config, ...pending });
          return pending.promise;
        } };
        if (id === '@/stores/toastStore') return { useToastStore: Object.assign(
          select => {
            const state = { showToast: (...args) => toasts.push(args) };
            return select ? select(state) : state;
          },
          { getState: () => ({ showToast: (...args) => toasts.push(args) }) },
        ) };
        if (file.startsWith('hooks/') && id === '@/stores/authStore') {
          const authStore = load('stores/authStore.ts').useAuthStore;
          return { useAuthStore: Object.assign(select => select(authStore.getState()), authStore) };
        }
        if (file === 'hooks/useAuth.ts' && id === './useNotification') {
          return { useNotification: () => ({ registerNotification: { mutate: payload => registrations.push(payload) } }) };
        }
        if (file.startsWith('app/') && id === '@/stores/authStore') {
          return { useAuthStore: select => select(load('stores/authStore.ts').useAuthStore.getState()) };
        }
        if (id.startsWith('@/components/')) {
          const name = path.posix.basename(id);
          return { [name]: name };
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
    store, session, api, queryClient, refreshes, storage, requests, toasts, navigation, registrations, logs, holdNext, forms,
    apiHelpers: () => load('services/api.ts'),
    errorInfo: (...args) => load('services/apiError.ts').toAppError(...args),
    authServices: () => load('services/authService.ts'),
    notification: () => load('hooks/useNotification.ts').useNotification(),
    screen: name => load(`app/(auth)/${name}.tsx`).default(),
    holdNextMutation: () => {
      const started = deferred(), finished = deferred();
      mutationHolds.push({ started, finished });
      return { started: started.promise, release: finished.resolve };
    },
    get disk() { return persistence.token; }, get policy() { return persistence.policy; },
    get maxActiveStorage() { return maxActiveStorage; },
    policyStorage, storageEvents, persistence,
    restart: () => harness({ signedIn: false, persistence }),
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
  const generation = h.session.getSessionGeneration();
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
  assert.equal(h.session.getSessionGeneration(), generation);
});

test('session restoration still shares a refresh and restores saved credentials', async () => {
  const h = harness({ signedIn: false });
  const generation = h.session.getSessionGeneration();
  const pending = Promise.all([h.restoreUser(), h.restoreUser()]);
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-restored')));
  await pending;
  assert.equal(h.refreshes.length, 1);
  assert.equal(h.disk, 'A-refresh-restored');
  assert.equal(h.store.getState().accessToken, 'A-access-restored');
  assert.equal(h.session.getSessionGeneration(), generation);
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
    assert.equal(h.session.isRefreshBlocked(), true);
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
    assert.equal(h.store.getState().accessToken, null);
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

test('a delayed logout deletion cannot clear a newer login or delete its credentials last', async () => {
  const h = harness();
  const deletion = h.holdNext('delete');
  const logout = h.session.clearSession();
  await deletion.started;
  const unsubscribe = h.store.subscribe(state => {
    if (state.user?.id === 'B') h.queryClient.setQueryData(['private-profile'], { owner: 'B' });
  });
  const login = h.session.setAuthenticatedSession(account('B'));
  deletion.release();
  await Promise.all([logout, login]);
  unsubscribe();
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().user.id, 'B');
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.maxActiveStorage, 1);
  assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'B');
});

test('queued writes are skipped if their session was replaced before native storage starts', async () => {
  const h = harness();
  const read = h.holdNext('get');
  const refresh = h.session.refreshAccessToken();
  await read.started;
  const replacedLogin = h.session.setAuthenticatedSession(account('A', '-replaced'));
  const login = h.session.setAuthenticatedSession(account('B'));
  read.release();
  assert.equal(await refresh, null);
  assert.equal(await replacedLogin, null);
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

test('concurrent failed requests share one refresh, preserve credentials, and allow a later request to recover', async () => {
  const h = harness();
  const generation = h.session.getSessionGeneration();
  h.requireRefresh();
  const pending = Promise.all([observe(h.api.get('/one')), observe(h.api.get('/two'))]);
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].reject(new Error('Refresh failed'));
  const results = await pending;
  assert.ok(results.every(result => result.status === 'rejected' && result.reason.response.status === 401));
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.store.getState().user, null);
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.toasts.length, 0, 'Superseded requests must not produce session side effects');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  assert.equal(h.requests.length, 2);
  await tick();
  assert.equal(h.refreshes.length, 1);
  const recovery = h.api.get('/three');
  await until(() => h.refreshes.length === 2);
  assert.equal(h.requests[2].headers.get('Authorization'), undefined);
  assert.equal(h.refreshes[1].body.refreshToken, 'A-refresh');
  h.refreshes[1].resolve(responseFor(account('A', '-recovered')));
  assert.equal((await recovery).data.protected, true);
  assert.equal(h.requests.length, 4);
  assert.equal(h.requests[3].headers.get('Authorization'), 'Bearer A-access-recovered');
  assert.equal(h.disk, 'A-refresh-recovered');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
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
  assert.equal(h.disk, null);
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

test('logout snapshots the latest device token at invocation and cannot pick up later token changes', async () => {
  const h = harness();
  const auth = h.auth();
  h.store.getState().setPushNotificationToken('latest-device-token');
  const read = h.holdNext('get');
  const logout = auth.logoutUser();
  await read.started;
  h.store.getState().setPushNotificationToken('later-device-token');
  read.release();
  await logout;
  assert.equal(h.requests.length, 1);
  assert.equal(JSON.parse(h.requests[0].data).expoPushToken, 'latest-device-token');
  assert.equal(h.store.getState().pushNotificationToken, 'later-device-token');
  assert.equal(h.registrations.length, 0);
});

test('login and both email-verification callbacks persist sessions without automatic push registration', async () => {
  const h = harness({ saved: null, signedIn: false });
  h.setAdapter(async config => h.ok(config, responseFor(account('B')).data));
  const auth = h.auth();
  for (const mutation of [auth.loginMutation, auth.verifyEmailMutation, auth.verifyNewEmailMutation]) {
    await mutation.mutateAsync({ email: 'B@example.test', password: 'synthetic', otp: '123456' });
    assert.equal(h.disk, 'B-refresh');
    assert.equal(h.store.getState().user.id, 'B');
  }
  assert.equal(h.registrations.length, 0);
  assert.ok(h.requests.every(request => request.url !== '/PushNotification/Register'));
});

test('a login awaiting persistence cannot unblock logout or register stale push credentials', async () => {
  const h = harness({ saved: null, signedIn: false });
  const auth = h.auth();
  h.setAdapter(async config => h.ok(config, responseFor(account('A')).data));
  const write = h.holdNext('set');
  const login = observe(auth.loginMutation.mutateAsync({ email: 'A@example.test', password: 'synthetic' }));
  await write.started;
  const logoutReply = deferred();
  h.setAdapter(() => logoutReply.promise);
  const logout = auth.logoutAndGoToLogin();
  assert.equal(h.session.isRefreshBlocked(), true);
  write.release();
  assert.equal((await login).status, 'rejected');
  await until(() => h.requests.length === 2);
  assert.equal(h.session.isRefreshBlocked(), true);
  assert.equal(h.registrations.length, 0);
  logoutReply.resolve(h.ok(h.requests[1]));
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

test('failed refresh cancels active private queries without deleting credentials or affecting later B queries', async () => {
  const h = harness();
  const replyA = deferred(), replyB = deferred();
  let signalA, signalB;
  const pendingA = observe(h.queryClient.fetchQuery({ queryKey: ['private-details'], queryFn: context => {
    signalA = context.signal;
    return replyA.promise;
  } }));
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].reject({ response: { status: 401, data: { title: 'INVALID_REFRESH_TOKEN' } } });
  assert.equal(await refresh, null);
  assert.equal(signalA.aborted, true);
  assert.equal((await pendingA).status, 'rejected');
  assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 0);
  await h.session.setAuthenticatedSession(account('B'));
  const pendingB = h.queryClient.fetchQuery({ queryKey: ['private-details'], queryFn: context => {
    signalB = context.signal;
    return replyB.promise;
  } });
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

const recoverableRefreshFailures = [
  ['offline', pending => pending.reject(new axios.AxiosError('Network Error', 'ERR_NETWORK'))],
  ['timeout', pending => pending.reject(new axios.AxiosError('Timeout', 'ECONNABORTED'))],
  ...[400, 401, 403, 429, 500, 503].map(status => [
    `HTTP ${status}`, pending => pending.reject({ response: { status, data: {} } }),
  ]),
  ['unverified invalid-token title', pending => pending.reject({ response: {
    status: 401, data: { title: 'INVALID_REFRESH_TOKEN' },
  } })],
  ['unverified invalid-token detail', pending => pending.reject({ response: {
    status: 400, data: { detail: 'INVALID_REFRESH_TOKEN' },
  } })],
  ['unverified revocation text', pending => pending.reject({ response: {
    status: 401, data: { detail: 'Refresh token has been revoked.' },
  } })],
  ['generic authorization code', pending => pending.reject({ response: {
    status: 401, data: { code: 'NOT_AUTHORISED' },
  } })],
  ['unknown error', pending => pending.reject(new Error('Refresh could not complete'))],
  ['empty success body', pending => pending.resolve({ data: null })],
  ['success missing tokens', pending => pending.resolve({ data: { data: { user: account('A').user } } })],
  ['success missing user', pending => {
    const response = responseFor(account('A'));
    delete response.data.data.user;
    pending.resolve(response);
  }],
  ['non-string access token', pending => pending.resolve(responseFor({ ...account('A'), accessToken: 123 }))],
  ['non-string refresh token', pending => pending.resolve(responseFor({ ...account('A'), refreshToken: {} }))],
  ['explicit unsuccessful response with token fields', pending => {
    const response = responseFor(account('A', '-must-not-apply'));
    response.data.success = false;
    pending.resolve(response);
  }],
];

for (const [name, complete] of recoverableRefreshFailures) {
  test(`${name}: preserve credentials, clear access/caches, and allow later recovery`, async () => {
    const h = harness();
    h.queryClient.setQueryData(['private-profile'], { owner: 'A' });
    const mutation = new MutationObserver(h.queryClient, { mutationFn: async () => ({ owner: 'A' }) });
    await mutation.mutate({ owner: 'A' });
    const generation = h.session.getSessionGeneration();
    const refresh = h.session.refreshAccessToken();
    await until(() => h.refreshes.length === 1);
    complete(h.refreshes[0]);
    assert.equal(await refresh, null);
    assert.equal(h.disk, 'A-refresh');
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.store.getState().user, null);
    assert.equal(h.session.isRefreshBlocked(), false);
    assert.equal(h.session.getSessionGeneration(), generation + 1);
    assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
    assert.equal(h.queryClient.getMutationCache().getAll().length, 0);
    assert.equal(h.storage.filter(op => op.kind !== 'get').length, 0);
    await tick();
    assert.equal(h.refreshes.length, 1, 'A failed refresh must not retry itself');

    const recovery = h.session.refreshAccessToken();
    await until(() => h.refreshes.length === 2);
    assert.equal(h.refreshes[1].body.refreshToken, 'A-refresh');
    h.refreshes[1].resolve(responseFor(account('A', '-recovered')));
    assert.equal(await recovery, 'A-access-recovered');
    assert.equal(h.disk, 'A-refresh-recovered');
    assert.equal(h.store.getState().accessToken, 'A-access-recovered');
    assert.equal(h.session.getSessionGeneration(), generation + 1);
  });
}

test('failed startup restoration completes signed out and a later explicit restore can recover', async () => {
  const h = harness({ signedIn: false });
  const generation = h.session.getSessionGeneration();
  const restore = h.restoreUser();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].reject(new axios.AxiosError('Network Error', 'ERR_NETWORK'));
  await restore;
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.store.getState().user, null);
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  await tick();
  assert.equal(h.refreshes.length, 1);
  const recovery = h.restoreUser();
  await until(() => h.refreshes.length === 2);
  h.refreshes[1].resolve(responseFor(account('A', '-recovered')));
  await recovery;
  assert.equal(h.store.getState().accessToken, 'A-access-recovered');
  assert.equal(h.disk, 'A-refresh-recovered');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
});

test('a failed startup SecureStore read preserves credentials and can be retried', async () => {
  const h = harness({ signedIn: false });
  const generation = h.session.getSessionGeneration();
  const read = h.holdNext('get');
  const restore = h.restoreUser();
  await read.started;
  read.fail(new Error('SecureStore temporarily unavailable'));
  await restore;
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.store.getState().user, null);
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  const recovery = h.restoreUser();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-recovered')));
  await recovery;
  assert.equal(h.disk, 'A-refresh-recovered');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
});

test('failed refresh-token persistence clears in-memory access without deleting the stored token', async () => {
  const h = harness();
  const generation = h.session.getSessionGeneration();
  const publishedTokens = [];
  const unsubscribe = h.store.subscribe(state => publishedTokens.push(state.accessToken));
  const write = h.holdNext('set');
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-rotated')));
  await write.started;
  assert.equal(h.store.getState().accessToken, 'A-access');
  write.fail(new Error('SecureStore write failed'));
  assert.equal(await refresh, null);
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.store.getState().user, null);
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 0);
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  assert.equal(publishedTokens.includes('A-access-rotated'), false);
  const recovery = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 2);
  assert.equal(h.refreshes[1].body.refreshToken, 'A-refresh');
  h.refreshes[1].resolve(responseFor(account('A', '-recovered')));
  assert.equal(await recovery, 'A-access-recovered');
  assert.equal(h.disk, 'A-refresh-recovered');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  assert.equal(h.maxActiveStorage, 1);
  unsubscribe();
});

test('a missing stored token never grants access, deletes storage, or makes a network refresh', async () => {
  const h = harness({ saved: null });
  const generation = h.session.getSessionGeneration();
  assert.equal(await h.session.refreshAccessToken(), null);
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.store.getState().user, null);
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 0);
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  await h.restoreUser();
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.session.getSessionGeneration(), generation + 2);
});

for (const trigger of ['restore', 'protected request']) {
  test(`a delayed pre-failure 401 cannot interfere with recovery through ${trigger}`, async () => {
    const h = harness();
    const generation = h.session.getSessionGeneration();
    const oldReply = deferred();
    h.setAdapter(async config => {
      if (config.url === '/old-request') return oldReply.promise;
      if (!config._retry) throw h.unauthorized(config);
      return h.ok(config, { recovered: true });
    });
    const oldRequest = observe(h.api.get('/old-request'));
    const oldConfig = h.requests[0];
    assert.equal(oldConfig._sessionGeneration, generation);

    const failedRefresh = h.session.refreshAccessToken();
    await until(() => h.refreshes.length === 1);
    h.refreshes[0].reject(new axios.AxiosError('Network Error', 'ERR_NETWORK'));
    assert.equal(await failedRefresh, null);
    assert.equal(h.disk, 'A-refresh');
    assert.equal(h.store.getState().accessToken, null);

    const recovery = trigger === 'restore' ? h.restoreUser() : h.api.get('/recovery');
    await until(() => h.refreshes.length === 2);
    assert.equal(h.refreshes[1].body.refreshToken, 'A-refresh');
    h.refreshes[1].resolve(responseFor(account('A', '-recovered')));
    const recovered = await recovery;
    if (trigger === 'protected request') assert.equal(recovered.data.recovered, true);
    h.queryClient.setQueryData(['private-profile'], { owner: 'recovered' });
    const newReply = deferred();
    let newSignal;
    const newQuery = observe(h.queryClient.fetchQuery({ queryKey: ['private-details'], queryFn: context => {
      newSignal = context.signal;
      return newReply.promise;
    } }));

    const requestCount = h.requests.length;
    const originalError = h.unauthorized(oldConfig);
    oldReply.reject(originalError);
    await tick();
    assert.equal(h.refreshes.length, 2, 'The old 401 must not start another refresh');
    const result = await oldRequest;
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason, originalError);
    assert.equal(h.requests.length, requestCount, 'The old request must not replay');
    assert.equal(h.session.getSessionGeneration(), generation + 1);
    assert.equal(h.store.getState().accessToken, 'A-access-recovered');
    assert.equal(h.disk, 'A-refresh-recovered');
    assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'recovered');
    assert.equal(newSignal.aborted, false);
    assert.equal(h.toasts.length, 0);
    newReply.resolve({ owner: 'recovered' });
    const queryResult = await newQuery;
    assert.equal(queryResult.status, 'fulfilled');
    assert.equal(queryResult.value.owner, 'recovered');
  });
}

test('failed shared restoration advances once and its finalizers cannot detach recovery started during cleanup', async () => {
  const h = harness();
  const generation = h.session.getSessionGeneration();
  let recovery;
  const unsubscribe = h.store.subscribe(state => {
    if (state.accessToken !== null) return;
    unsubscribe();
    assert.equal(h.session.getSessionGeneration(), generation + 1, 'Advance before notifying subscribers');
    recovery = h.restoreUser();
  });
  const failed = Promise.all([h.restoreUser(), h.restoreUser(), h.session.refreshAccessToken()]);
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].reject(new Error('Transient refresh failure'));
  await failed;
  await until(() => h.refreshes.length === 2);
  assert.ok(recovery);
  const concurrentRestore = h.restoreUser();
  const concurrentRefresh = h.session.refreshAccessToken();
  await tick();
  assert.equal(h.refreshes.length, 2);
  assert.equal(h.storage.filter(op => op.kind === 'get').length, 2);
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  h.refreshes[1].resolve(responseFor(account('A', '-recovered')));
  assert.equal(await concurrentRefresh, 'A-access-recovered');
  await Promise.all([recovery, concurrentRestore]);
  assert.equal(h.store.getState().accessToken, 'A-access-recovered');
  assert.equal(h.disk, 'A-refresh-recovered');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
});

test('a failed older refresh cannot unblock a logout that is waiting for its server call', async () => {
  const h = harness();
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  const logoutReply = deferred();
  h.setAdapter(() => logoutReply.promise);
  const logout = h.auth().logoutAndGoToLogin();
  await until(() => h.requests.length === 1);
  h.refreshes[0].reject(new axios.AxiosError('Timeout', 'ECONNABORTED'));
  assert.equal(await refresh, null);
  assert.equal(h.session.isRefreshBlocked(), true);
  assert.equal(h.disk, null);
  logoutReply.resolve(h.ok(h.requests[0]));
  await logout;
  assert.equal(h.disk, null);
  assert.equal(h.store.getState().accessToken, null);
});

test('an old startup read failure cannot clear a newer login or its cache', async () => {
  const h = harness({ signedIn: false });
  const read = h.holdNext('get');
  const restore = h.restoreUser();
  await read.started;
  const unsubscribe = h.store.subscribe(state => {
    if (state.user?.id === 'B') h.queryClient.setQueryData(['private-profile'], { owner: 'B' });
  });
  const login = h.session.setAuthenticatedSession(account('B'));
  read.fail(new Error('Old SecureStore read failed'));
  await Promise.all([restore, login]);
  unsubscribe();
  assert.equal(h.store.getState().accessToken, 'B-access');
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'B');
});

test('a 401 after a successful refresh replay does not recursively refresh or retry again', async () => {
  const h = harness();
  h.setAdapter(async config => { throw h.unauthorized(config); });
  const request = observe(h.api.get('/protected'));
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-new')));
  const result = await request;
  assert.equal(result.status, 'rejected');
  assert.equal(result.reason.response.status, 401);
  assert.equal(h.requests.length, 2);
  assert.equal(h.refreshes.length, 1);
});

test('login publishes authentication only after persistence succeeds and blocks recovery while pending', async () => {
  const h = harness();
  h.queryClient.setQueryData(['private-profile'], { owner: 'A' });
  const write = h.holdNext('set');
  const login = h.session.setAuthenticatedSession(account('B'));
  await write.started;
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.store.getState().user, null);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
  assert.equal(h.session.isRefreshBlocked(), true);
  await Promise.all([h.restoreUser(), h.session.refreshAccessToken()]);
  assert.equal(h.refreshes.length, 0);
  write.release();
  assert.equal(await login, h.session.getSessionGeneration());
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().accessToken, 'B-access');
  assert.equal(h.session.isRefreshBlocked(), false);
});

for (const recovery of ['explicit login', 'logout cleanup']) {
  test(`a failed login write blocks the older saved account until ${recovery}`, async () => {
    const h = harness();
    const generation = h.session.getSessionGeneration();
    const write = h.holdNext('set');
    const login = observe(h.session.setAuthenticatedSession(account('B')));
    await write.started;
    const error = new Error('Synthetic private native error');
    write.fail(error);
    const result = await login;
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason, error);
    assert.equal(h.disk, 'A-refresh');
    assert.equal(h.store.getState().user, null);
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.session.isRefreshBlocked(), true);
    assert.equal(h.session.getSessionGeneration(), generation + 1);
    const reads = h.storage.filter(op => op.kind === 'get').length;
    h.requireRefresh();
    await Promise.all([h.restoreUser(), h.session.refreshAccessToken(), observe(h.api.get('/private'))]);
    assert.equal(h.refreshes.length, 0);
    assert.equal(h.storage.filter(op => op.kind === 'get').length, reads);
    assert.equal(h.requests[0].headers.get('Authorization'), undefined);
    assert.equal(h.logs.flat().includes(error), false);
    if (recovery === 'explicit login') {
      assert.equal(await h.session.setAuthenticatedSession(account('B')), generation + 2);
      assert.equal(h.disk, 'B-refresh');
      assert.equal(h.store.getState().accessToken, 'B-access');
    } else {
      assert.equal(await h.session.clearSession(), true);
      assert.equal(h.disk, null);
      assert.equal(h.store.getState().accessToken, null);
    }
    assert.equal(h.session.isRefreshBlocked(), recovery === 'logout cleanup');
  });
}

for (const mutationName of ['loginMutation', 'verifyEmailMutation', 'verifyNewEmailMutation']) {
  test(`${mutationName} rejects a failed session write without publishing auth or registering push`, async () => {
    const h = harness({ saved: null, signedIn: false });
    h.setAdapter(async config => h.ok(config, responseFor(account('B')).data));
    const mutation = h.auth()[mutationName];
    const write = h.holdNext('set');
    const pending = observe(mutation.mutateAsync({ email: 'B@example.test', password: 'synthetic', otp: '123456' }));
    await write.started;
    const failure = new Error('Synthetic private native error');
    write.fail(failure);
    assert.equal((await pending).reason, failure);
    assert.equal(h.store.getState().user, null);
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.disk, null);
    assert.equal(h.session.isRefreshBlocked(), true);
    assert.equal(h.registrations.length, 0);
    assert.equal(h.toasts.length, 1);
    assert.equal(h.toasts[0][1], 'error', 'Persistence failure must show one safe error, never a success toast');
    assert.equal(h.navigation.length, 0);
    assert.equal(JSON.stringify({ logs: h.logs, toasts: h.toasts }).includes('Synthetic private native error'), false);
  });
}

for (const outcome of ['success', 'failure']) {
  test(`an older login write ${outcome} cannot publish credentials or block a newer login`, async () => {
    const h = harness();
    const write = h.holdNext('set');
    const oldLogin = observe(h.session.setAuthenticatedSession(account('B')));
    await write.started;
    const newLogin = h.session.setAuthenticatedSession(account('C'));
    const generation = h.session.getSessionGeneration();
    if (outcome === 'success') write.release();
    else write.fail(new Error('Old login write failed'));
    assert.equal((await oldLogin).value, null);
    assert.equal(await newLogin, generation);
    assert.equal(h.session.getSessionGeneration(), generation);
    assert.equal(h.store.getState().user.id, 'C');
    assert.equal(h.disk, 'C-refresh');
    assert.equal(h.session.isRefreshBlocked(), false);
    assert.equal(h.maxActiveStorage, 1);
  });
}

for (const writeFails of [false, true]) {
  test(`concurrent refresh and restore wait for one shared token write (${writeFails ? 'failure' : 'success'})`, async () => {
    const h = harness();
    const generation = h.session.getSessionGeneration();
    h.requireRefresh();
    h.queryClient.setQueryData(['private-profile'], { owner: 'A' });
    const write = h.holdNext('set');
    const requests = Promise.all([observe(h.api.get('/one')), observe(h.api.get('/two'))]);
    const restore = h.restoreUser();
    await until(() => h.refreshes.length === 1);
    h.refreshes[0].resolve(responseFor(account('A', '-rotated')));
    await write.started;
    await tick();
    assert.equal(h.refreshes.length, 1);
    assert.equal(h.requests.length, 2);
    assert.equal(h.store.getState().accessToken, 'A-access');
    assert.equal(h.disk, 'A-refresh');
    assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'A');
    if (writeFails) write.fail(new Error('Shared native write failed'));
    else write.release();
    const results = await requests;
    await restore;
    if (writeFails) {
      assert.ok(results.every(result => result.status === 'rejected' && result.reason.response.status === 401));
      assert.equal(h.requests.length, 2);
      assert.equal(h.session.getSessionGeneration(), generation + 1);
      assert.equal(h.store.getState().accessToken, null);
      assert.equal(h.disk, 'A-refresh');
      assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
      assert.equal(h.session.isRefreshBlocked(), false);
      const recovery = h.restoreUser();
      await until(() => h.refreshes.length === 2);
      assert.equal(h.refreshes[1].body.refreshToken, 'A-refresh');
      h.refreshes[1].resolve(responseFor(account('A', '-recovered')));
      await recovery;
      assert.equal(h.disk, 'A-refresh-recovered');
      assert.equal(h.session.getSessionGeneration(), generation + 1);
    } else {
      assert.ok(results.every(result => result.status === 'fulfilled'));
      assert.equal(h.requests.length, 4);
      assert.equal(h.store.getState().accessToken, 'A-access-rotated');
      assert.equal(h.disk, 'A-refresh-rotated');
      assert.equal(h.session.getSessionGeneration(), generation);
      assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'A');
    }
  });
}

test('concurrent refresh requests share a failed token read and recover through a later protected request', async () => {
  const h = harness();
  const generation = h.session.getSessionGeneration();
  h.requireRefresh();
  const read = h.holdNext('get');
  const pending = Promise.all([observe(h.api.get('/one')), observe(h.api.get('/two')), h.restoreUser()]);
  await read.started;
  read.fail(new Error('Shared native read failed'));
  await pending;
  assert.equal(h.storage.filter(op => op.kind === 'get').length, 1);
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  assert.equal(h.session.isRefreshBlocked(), false);
  const recovery = h.api.get('/recovered');
  await until(() => h.refreshes.length === 1);
  assert.equal(h.refreshes[0].body.refreshToken, 'A-refresh');
  h.refreshes[0].resolve(responseFor(account('A', '-recovered')));
  assert.equal((await recovery).data.protected, true);
  assert.equal(h.store.getState().accessToken, 'A-access-recovered');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
});

for (const deleteFails of [false, true]) {
  test(`a failed logout read still clears memory and attempts deletion (${deleteFails ? 'failed' : 'successful'} delete)`, async () => {
    const h = harness();
    h.queryClient.setQueryData(['private-profile'], { owner: 'A' });
    const read = h.holdNext('get');
    const deletion = h.holdNext('delete');
    const logout = observe(h.auth().logoutAndGoToLogin());
    await read.started;
    read.fail(new Error('Synthetic private native read error'));
    await deletion.started;
    assert.equal(h.store.getState().user, null);
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.queryClient.getQueryCache().getAll().length, 0);
    if (deleteFails) deletion.fail(new Error('Synthetic private native delete error'));
    else deletion.release();
    assert.equal((await logout).status, 'fulfilled');
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.disk, deleteFails ? 'A-refresh' : null);
    assert.equal(h.session.isRefreshBlocked(), true);
    assert.equal(h.requests.length, 0);
    assert.deepEqual(h.navigation, [['replace', '/(auth)']]);
    assert.equal(JSON.stringify(h.logs).includes('Synthetic private native'), false);
  });
}

test('failed logout deletion stays signed out and retries cleanup through restore without authenticating', async () => {
  const h = harness();
  const deletion = h.holdNext('delete');
  const logout = h.auth().logoutAndGoToLogin();
  await deletion.started;
  assert.equal(h.store.getState().accessToken, null);
  const lateReply = deferred();
  let signal;
  const lateQuery = observe(h.queryClient.fetchQuery({ queryKey: ['private-profile'], queryFn: context => {
    signal = context.signal;
    return lateReply.promise;
  } }));
  deletion.fail(new Error('Delete unavailable'));
  await logout;
  assert.equal((await lateQuery).status, 'rejected');
  assert.equal(signal.aborted, true);
  const generation = h.session.getSessionGeneration();
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.session.isRefreshBlocked(), true);
  assert.deepEqual(h.navigation, [['replace', '/(auth)']]);
  h.requireRefresh();
  assert.equal((await observe(h.api.get('/private'))).status, 'rejected');
  assert.equal(h.requests.at(-1).headers.get('Authorization'), undefined);
  assert.equal(h.refreshes.length, 0);

  const failedRetry = h.holdNext('delete');
  const restore = h.restoreUser();
  await failedRetry.started;
  failedRetry.fail(new Error('Delete still unavailable'));
  await restore;
  await tick();
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 2, 'No automatic retry loop');
  assert.equal(h.session.isRefreshBlocked(), true);
  assert.equal(h.session.getSessionGeneration(), generation);

  const retry = h.holdNext('delete');
  const pending = Promise.all([h.restoreUser(), h.restoreUser(), h.session.refreshAccessToken()]);
  await retry.started;
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 3);
  retry.release();
  await pending;
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 3, 'Cleanup retries are shared');
  assert.equal(h.storage.filter(op => op.kind === 'get').length, 4);
  assert.equal(h.disk, null);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.session.isRefreshBlocked(), true);
  await h.session.setAuthenticatedSession(account('B'));
  h.queryClient.setQueryData(['private-profile'], { owner: 'B' });
  lateReply.resolve({ owner: 'A' });
  await tick();
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().user.id, 'B');
  assert.equal(h.queryClient.getQueryData(['private-profile']).owner, 'B');
});

test('clearSession reports incomplete durable logout when both policy and deletion fail, and permits retry', async () => {
  const h = harness();
  const policyWrite = h.holdNext('policySet');
  const deletion = h.holdNext('delete');
  const clear = observe(h.session.clearSession());
  await policyWrite.started;
  policyWrite.fail(new Error('Policy storage unavailable'));
  await deletion.started;
  deletion.fail(new Error('Delete unavailable'));
  const result = await clear;
  assert.equal(result.status, 'fulfilled');
  assert.equal(result.value, false);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.session.isRefreshBlocked(), true);
  assert.equal(await h.session.clearSession(), true);
  assert.equal(h.disk, null);
  assert.equal(h.session.isRefreshBlocked(), true);
});

test('a failed delayed deletion cannot clear a newer login or leave it blocked', async () => {
  const h = harness();
  const deletion = h.holdNext('delete');
  const logout = observe(h.session.clearSession());
  await deletion.started;
  const login = h.session.setAuthenticatedSession(account('B'));
  const generation = h.session.getSessionGeneration();
  deletion.fail(new Error('Old delete failed'));
  assert.equal((await logout).value, false);
  assert.equal(await login, generation);
  h.queryClient.setQueryData(['private-profile'], { owner: 'B' });
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().accessToken, 'B-access');
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.session.getSessionGeneration(), generation);
  assert.equal(h.maxActiveStorage, 1);
});

test('an old logout read failure cannot clear a newer login or navigate away from it', async () => {
  const h = harness();
  const read = h.holdNext('get');
  const logout = observe(h.auth().logoutAndGoToLogin());
  await read.started;
  const login = h.session.setAuthenticatedSession(account('B'));
  read.fail(new Error('Old logout read failed'));
  await Promise.all([logout, login]);
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().accessToken, 'B-access');
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.navigation.length, 0);
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 0);
});

test('an old deletion finalizer cannot detach the newer shared cleanup operation', async () => {
  const h = harness();
  const oldDelete = h.holdNext('delete');
  const oldClear = h.session.clearSession();
  await oldDelete.started;
  const newDelete = h.holdNext('delete');
  const newClear = h.session.clearSession();
  oldDelete.release();
  await newDelete.started;
  assert.equal(await oldClear, false);
  const restore = h.restoreUser();
  const refresh = h.session.refreshAccessToken();
  await tick();
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 2);
  newDelete.release();
  assert.equal(await newClear, true);
  await Promise.all([restore, refresh]);
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 2);
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.disk, null);
  assert.equal(h.session.isRefreshBlocked(), true);
});

test('a queued logout deletion is skipped when a newer login replaces it before native storage starts', async () => {
  const h = harness();
  const write = h.holdNext('set');
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-rotated')));
  await write.started;
  const logout = h.session.clearSession();
  const login = h.session.setAuthenticatedSession(account('B'));
  write.release();
  assert.equal(await refresh, null);
  assert.equal(await logout, false);
  assert.equal(await login, h.session.getSessionGeneration());
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 0);
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().accessToken, 'B-access');
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.maxActiveStorage, 1);
});

test('a login write that changes storage and then rejects still blocks authentication and restoration', async () => {
  const h = harness();
  const write = h.holdNext('set');
  const login = observe(h.session.setAuthenticatedSession(account('B')));
  await write.started;
  write.failAfterEffect(new Error('Native write completion was not confirmed'));
  assert.equal((await login).status, 'rejected');
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.session.isRefreshBlocked(), true);
  await h.restoreUser();
  assert.equal(h.refreshes.length, 0);
  assert.equal(await h.session.clearSession(), true);
  assert.equal(h.disk, null);
});

test('recovery re-reads storage after a refresh write changed the token but rejected', async () => {
  const h = harness();
  const generation = h.session.getSessionGeneration();
  const write = h.holdNext('set');
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-rotated')));
  await write.started;
  write.failAfterEffect(new Error('Native write completion was not confirmed'));
  assert.equal(await refresh, null);
  assert.equal(h.disk, 'A-refresh-rotated');
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.session.isRefreshBlocked(), false);
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  const restore = h.restoreUser();
  await until(() => h.refreshes.length === 2);
  assert.equal(h.refreshes[1].body.refreshToken, 'A-refresh-rotated');
  h.refreshes[1].resolve(responseFor(account('A', '-recovered')));
  await restore;
  assert.equal(h.disk, 'A-refresh-recovered');
  assert.equal(h.store.getState().accessToken, 'A-access-recovered');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
});

test('a deletion that removes the token but rejects can be confirmed absent by a read-back', async () => {
  const h = harness();
  const deletion = h.holdNext('delete');
  const clear = h.session.clearSession();
  await deletion.started;
  deletion.failAfterEffect(new Error('Native delete completion was not confirmed'));
  assert.equal(await clear, true);
  assert.equal(h.disk, null);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.session.isRefreshBlocked(), true);
  await h.restoreUser();
  assert.equal(h.storage.filter(op => op.kind === 'delete').length, 1);
  assert.equal(h.storage.filter(op => op.kind === 'get').length, 1);
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.session.isRefreshBlocked(), true);
});

const assertRestartDenied = async previous => {
  const restarted = previous.restart();
  await Promise.all([restarted.restoreUser(), restarted.session.refreshAccessToken()]);
  restarted.requireRefresh();
  assert.equal((await observe(restarted.api.get('/private'))).status, 'rejected');
  assert.equal(restarted.refreshes.length, 0, 'A retained token must never reach the refresh endpoint');
  assert.equal(restarted.storage.length, 0, 'Policy denial must precede every credential read');
  assert.equal(restarted.store.getState().accessToken, null);
  assert.equal(restarted.store.getState().user, null);
  return restarted;
};

test('failed token deletion cannot restore a session after a fresh app runtime', async () => {
  const h = harness();
  const deletion = h.holdNext('delete');
  const logout = h.auth().logoutAndGoToLogin();
  assert.equal(h.store.getState().accessToken, null, 'Logout invalidates memory synchronously');
  await deletion.started;
  assert.equal(h.policy, policyRecord('blocked'));
  deletion.fail(new Error('Token deletion unavailable'));
  assert.equal(await logout, true, 'The verified persistent block establishes local protection');
  assert.equal(h.disk, 'A-refresh');
  await assertRestartDenied(h);
});

test('repeated token deletion failures across restarts retain the durable block', async () => {
  let h = harness();
  for (let attempt = 0; attempt < 3; attempt++) {
    const deletion = h.holdNext('delete');
    const clear = h.session.clearSession();
    await deletion.started;
    deletion.fail(new Error('Deletion still unavailable'));
    assert.equal(await clear, true);
    assert.equal(h.disk, 'A-refresh');
    h = await assertRestartDenied(h);
  }
});

for (const [name, policy] of [
  ['missing', null], ['malformed JSON', '{'], ['JSON null', 'null'],
  ['unknown version', JSON.stringify({ version: 2, state: 'allowed' })],
  ['invalid state', JSON.stringify({ version: 1, state: 'yes' })],
  ['plain allowed string', JSON.stringify('allowed')], ['blocked', policyRecord('blocked')],
]) {
  test(`${name} restore policy denies both startup and protected-request recovery`, async () => {
    const h = harness({ signedIn: false, policy });
    const restarted = await assertRestartDenied(h);
    assert.equal(restarted.disk, 'A-refresh');
    assert.equal(restarted.policy, policy);
    assert.equal(restarted.policyStorage.filter(op => op.kind === 'policySet').length, 0);
    await restarted.session.setAuthenticatedSession(account('B'));
    assert.equal(restarted.policy, policyRecord('allowed'));
    assert.equal(restarted.store.getState().accessToken, 'B-access');
  });
}

test('unreadable policy denies access without deleting credentials and can be read again after recovery', async () => {
  const h = harness({ signedIn: false });
  const read = h.holdNext('policyGet');
  const pending = Promise.all([h.restoreUser(), h.session.refreshAccessToken()]);
  await read.started;
  read.fail(new Error('Synthetic private filesystem error'));
  await pending;
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.storage.length, 0);
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(JSON.stringify(h.logs).includes('Synthetic private'), false);
  const recovery = h.restoreUser();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-recovered')));
  await recovery;
  assert.equal(h.store.getState().accessToken, 'A-access-recovered');
  assert.equal(h.policy, policyRecord('allowed'));
  assert.equal(h.policyStorage.filter(op => op.kind === 'policySet').length, 0);
});

test('login commits credentials before allowed policy and permits restoration only after both succeed', async () => {
  const h = harness({ signedIn: false, policy: policyRecord('blocked') });
  const blocking = h.holdNext('policySet');
  const allowing = h.holdNext('policySet');
  const login = h.session.setAuthenticatedSession(account('B'));
  await blocking.started;
  blocking.release();
  await allowing.started;
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.policy, policyRecord('blocked'));
  assert.equal(h.store.getState().accessToken, null);
  await assertRestartDenied(h);
  allowing.release();
  assert.equal(await login, h.session.getSessionGeneration());
  assert.equal(h.policy, policyRecord('allowed'));
  assert.equal(h.store.getState().accessToken, 'B-access');
  const writes = h.storageEvents.filter(op => op.kind === 'policySet' || op.kind === 'set');
  assert.deepEqual(writes.map(op => op.kind), ['policySet', 'set', 'policySet']);
  assert.equal(writes[0].value, policyRecord('blocked'));
  assert.equal(writes[2].value, policyRecord('allowed'));
  for (const op of h.policyStorage.filter(op => op.kind === 'policySet')) {
    assert.ok(op.value === policyRecord('allowed') || op.value === policyRecord('blocked'));
    assert.equal(op.value.includes('refresh'), false, 'Policy files must contain no credentials');
  }
  const restarted = h.restart();
  const restore = restarted.restoreUser();
  await until(() => restarted.refreshes.length === 1);
  assert.equal(restarted.refreshes[0].body.refreshToken, 'B-refresh');
  restarted.refreshes[0].resolve(responseFor(account('B', '-restored')));
  await restore;
  assert.equal(restarted.store.getState().user.id, 'B');
  assert.equal(restarted.maxActiveStorage, 1);
});

test('a failed login token write leaves a durable block across restart', async () => {
  const h = harness();
  const write = h.holdNext('set');
  const login = observe(h.session.setAuthenticatedSession(account('B')));
  await write.started;
  write.fail(new Error('Token write failed'));
  assert.equal((await login).status, 'rejected');
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.policy, policyRecord('blocked'));
  await assertRestartDenied(h);
});

test('failed login policy preparation never writes tokens or enables an existing logout policy', async () => {
  const h = harness({ signedIn: false, policy: policyRecord('blocked') });
  const write = h.holdNext('policySet');
  const login = observe(h.session.setAuthenticatedSession(account('B')));
  await write.started;
  write.fail(new Error('Policy write failed'));
  assert.equal((await login).status, 'rejected');
  assert.equal(h.storage.length, 0);
  assert.equal(h.disk, 'A-refresh');
  await assertRestartDenied(h);
});

for (const outcome of ['reject', 'reject after effect', 'resolve without effect']) {
  test(`failed allowed-policy write (${outcome}) cannot publish login and is rolled back to blocked`, async () => {
    const h = harness({ signedIn: false, policy: policyRecord('blocked') });
    const block = h.holdNext('policySet');
    const allow = h.holdNext('policySet');
    const login = observe(h.session.setAuthenticatedSession(account('B')));
    await block.started;
    block.release();
    await allow.started;
    if (outcome === 'reject') allow.fail(new Error('Allowed policy write failed'));
    else if (outcome === 'reject after effect') allow.failAfterEffect(new Error('Allowed policy write unconfirmed'));
    else allow.skipEffect();
    assert.equal((await login).status, 'rejected');
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.policy, policyRecord('blocked'));
    assert.equal(h.disk, 'B-refresh');
    await assertRestartDenied(h);
  });
}

for (const deleteFails of [false, true]) {
  test(`failed logout policy write still attempts deletion and reports ${deleteFails ? 'incomplete' : 'verified removal'}`, async () => {
    const h = harness();
    const block = h.holdNext('policySet');
    const deletion = h.holdNext('delete');
    const logout = h.auth().logoutAndGoToLogin();
    assert.equal(h.store.getState().accessToken, null);
    await block.started;
    assert.equal(h.storage.filter(op => op.kind === 'delete').length, 0);
    block.fail(new Error('Synthetic private policy error'));
    await deletion.started;
    if (deleteFails) deletion.fail(new Error('Synthetic private delete error'));
    else deletion.release();
    assert.equal(await logout, !deleteFails);
    assert.equal(h.disk, deleteFails ? 'A-refresh' : null);
    assert.equal(h.policy, policyRecord('allowed'), 'A failed write cannot be assumed committed');
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.session.isRefreshBlocked(), true);
    assert.equal(h.logs.some(args => String(args[0]).includes('Durable logout is incomplete')), deleteFails);
    assert.equal(JSON.stringify(h.logs).includes('Synthetic private'), false);
    assert.equal(h.maxActiveStorage, 1);
    if (!deleteFails) {
      const restarted = h.restart();
      await restarted.restoreUser();
      assert.equal(restarted.refreshes.length, 0);
      assert.equal(restarted.store.getState().accessToken, null);
    }
  });
}

test('a rejected logout policy write that changed storage still reports unconfirmed protection conservatively', async () => {
  const h = harness();
  const block = h.holdNext('policySet');
  const deletion = h.holdNext('delete');
  const logout = h.session.clearSession();
  await block.started;
  block.failAfterEffect(new Error('Policy completion unconfirmed'));
  await deletion.started;
  deletion.fail(new Error('Delete failed'));
  assert.equal(await logout, false);
  assert.equal(h.policy, policyRecord('blocked'));
  await assertRestartDenied(h);
});

test('a resolved token deletion that leaves credentials behind is detected by read-back', async () => {
  const h = harness();
  const block = h.holdNext('policySet');
  const deletion = h.holdNext('delete');
  const logout = h.session.clearSession();
  await block.started;
  block.fail(new Error('Policy failed'));
  await deletion.started;
  deletion.skipEffect();
  assert.equal(await logout, false);
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.store.getState().accessToken, null);
  assert.ok(h.logs.some(args => String(args[0]).includes('Durable logout is incomplete')));
});

test('a committed logout block survives a crash before credential deletion completes', async () => {
  const h = harness();
  const deletion = h.holdNext('delete');
  const logout = h.session.clearSession();
  await deletion.started;
  assert.equal(h.policy, policyRecord('blocked'));
  assert.equal(h.disk, 'A-refresh');
  await assertRestartDenied(h);
  deletion.release();
  assert.equal(await logout, true);
  assert.equal(h.policy, policyRecord('blocked'), 'Successful cleanup must retain the block');
});

for (const outcome of ['success', 'failure']) {
  test(`an old logout policy write ${outcome} cannot overwrite or block a newer login`, async () => {
    const h = harness();
    const block = h.holdNext('policySet');
    const logout = h.auth().logoutAndGoToLogin();
    await block.started;
    const login = h.session.setAuthenticatedSession(account('B'));
    if (outcome === 'success') block.release();
    else block.fail(new Error('Old policy write failed'));
    assert.equal(await logout, false);
    assert.equal(await login, h.session.getSessionGeneration());
    await tick();
    assert.equal(h.disk, 'B-refresh');
    assert.equal(h.policy, policyRecord('allowed'));
    assert.equal(h.store.getState().accessToken, 'B-access');
    assert.equal(h.storage.filter(op => op.kind === 'delete').length, 0);
    assert.equal(h.navigation.length, 0);
    assert.equal(h.maxActiveStorage, 1);
  });
}

test('an old login allowed-policy completion cannot undo a newer logout', async () => {
  const h = harness({ signedIn: false, policy: policyRecord('blocked') });
  const block = h.holdNext('policySet');
  const allow = h.holdNext('policySet');
  const login = h.session.setAuthenticatedSession(account('A'));
  await block.started;
  block.release();
  await allow.started;
  const logout = h.auth().logoutAndGoToLogin();
  allow.release();
  assert.equal(await login, null);
  assert.equal(await logout, true);
  assert.equal(h.policy, policyRecord('blocked'));
  assert.equal(h.disk, null);
  assert.equal(h.store.getState().accessToken, null);
  await assertRestartDenied(h);
});

for (const outcome of ['success', 'failure']) {
  test(`a stale refresh policy read ${outcome} cannot alter a new login's policy`, async () => {
    const h = harness();
    const read = h.holdNext('policyGet');
    const refresh = h.session.refreshAccessToken();
    await read.started;
    const login = h.session.setAuthenticatedSession(account('B'));
    if (outcome === 'success') read.release();
    else read.fail(new Error('Stale policy read failed'));
    assert.equal(await refresh, null);
    await login;
    assert.equal(h.refreshes.length, 0);
    assert.equal(h.policy, policyRecord('allowed'));
    assert.equal(h.store.getState().accessToken, 'B-access');
  });
}

test('a transient refresh failure preserves allowed policy and can recover after restart', async () => {
  const h = harness();
  const refresh = h.session.refreshAccessToken();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].reject({ response: { status: 503 } });
  assert.equal(await refresh, null);
  assert.equal(h.policy, policyRecord('allowed'));
  assert.equal(h.policyStorage.filter(op => op.kind === 'policySet').length, 0);
  const restarted = h.restart();
  const restore = restarted.restoreUser();
  await until(() => restarted.refreshes.length === 1);
  restarted.refreshes[0].resolve(responseFor(account('A', '-recovered')));
  await restore;
  assert.equal(restarted.store.getState().accessToken, 'A-access-recovered');
  assert.equal(restarted.policy, policyRecord('allowed'));
});

test('a resolved logout policy write without effect is not counted as durable protection', async () => {
  const h = harness();
  const block = h.holdNext('policySet');
  const deletion = h.holdNext('delete');
  const logout = h.session.clearSession();
  await block.started;
  block.skipEffect();
  await deletion.started;
  deletion.fail(new Error('Delete failed'));
  assert.equal(await logout, false);
  assert.equal(h.policy, policyRecord('allowed'));
  assert.equal(h.store.getState().accessToken, null);
});

for (const policyFails of [false, true]) {
  test(`unreadable credential removal verification reports ${policyFails ? 'incomplete logout' : 'protection from the policy'}`, async () => {
    const h = harness();
    const block = h.holdNext('policySet');
    const read = h.holdNext('get');
    const logout = h.session.clearSession();
    await block.started;
    if (policyFails) block.fail(new Error('Policy write failed'));
    else block.release();
    await read.started;
    read.fail(new Error('Cannot confirm token absence'));
    assert.equal(await logout, !policyFails);
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.session.isRefreshBlocked(), true);
    assert.equal(h.disk, null);
  });
}

test('a rejected old allowed-policy write cannot roll back a newer explicit login', async () => {
  const h = harness({ signedIn: false, policy: policyRecord('blocked') });
  const block = h.holdNext('policySet');
  const allow = h.holdNext('policySet');
  const oldLogin = h.session.setAuthenticatedSession(account('A'));
  await block.started;
  block.release();
  await allow.started;
  const newLogin = h.session.setAuthenticatedSession(account('B'));
  allow.failAfterEffect(new Error('Old allowed write failed'));
  assert.equal(await oldLogin, null);
  assert.equal(await newLogin, h.session.getSessionGeneration());
  assert.equal(h.policy, policyRecord('allowed'));
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.store.getState().accessToken, 'B-access');
  assert.equal(h.maxActiveStorage, 1);
});

test('captured logout authorization cannot be reused for another endpoint', async () => {
  const h = harness();
  const block = h.holdNext('policySet');
  const logout = h.auth().logoutAndGoToLogin();
  await block.started;
  await h.api.get('/private', { headers: { Authorization: 'Bearer A-access' } });
  assert.equal(h.requests[0].headers.get('Authorization'), undefined);
  block.release();
  await logout;
  const serverLogout = h.requests.find(config => config.url === '/Auth/Logout');
  assert.equal(serverLogout.headers.get('Authorization'), 'Bearer A-access');
  assert.equal(h.store.getState().accessToken, null);
});

// Task 8: real Axios, HTTP helpers, React Query mutation callbacks, and retained
// auth screen handlers. UI primitives/native services remain mocked.
const httpFailure = (config, status, data = {}) => new axios.AxiosError(
  'Private backend diagnostics', 'ERR_BAD_RESPONSE', config, {},
  { status, statusText: 'Error', headers: {}, config, data },
);
const findElement = (tree, type) => {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === type) return tree;
  for (const child of [tree.props?.children].flat()) {
    const found = findElement(child, type);
    if (found) return found;
  }
  return null;
};

for (const signedIn of [false, true]) {
  for (const endpoint of ['SignIn', 'SignUp', 'VerifyEmailOtp', 'SendEmailOtp', 'SendForgotPasswordOtp', 'VerifyForgotPasswordOtp', 'ResetPassword']) {
    test(`public ${endpoint} 401 never refreshes or replays (signedIn=${signedIn})`, async () => {
      const h = harness({ signedIn });
      const generation = h.session.getSessionGeneration();
      let failure;
      h.setAdapter(async config => { throw (failure = httpFailure(config, 401)); });
      const result = await observe(h.api.post(`/Auth/${endpoint}`, { private: 'synthetic' }));
      assert.equal(result.reason, failure);
      assert.equal(h.refreshes.length, 0);
      assert.equal(h.requests.length, 1);
      assert.equal(h.requests[0]._retry, undefined);
      assert.equal(h.session.getSessionGeneration(), generation);
      assert.equal(h.store.getState().accessToken, signedIn ? 'A-access' : null);
      assert.equal(h.disk, 'A-refresh');
      assert.equal(h.toasts.length, 1);
      assert.equal(h.toasts[0][1], 'error');
    });
  }
}

for (const [status, expected] of [
  [400, 'Unable to sign in. Check your details and try again.'],
  [401, 'Unable to sign in. Check your details and try again.'],
  [403, "You don't have permission to complete this request."],
  [429, 'Too many requests. Please wait and try again.'],
  [500, 'The service is temporarily unavailable. Please try again later.'],
]) {
  test(`login HTTP ${status} shows one controlled message and preserves the original error`, async () => {
    const h = harness({ signedIn: false });
    let failure;
    h.setAdapter(async config => { throw (failure = httpFailure(config, status, {
      detail: '<html>internal trace and private payload</html>', title: 'Private error', message: 'Not approved for display',
      errors: { password: ['Synthetic secret echoed by validation'] },
    })); });
    const result = await observe(h.auth().loginMutation.mutateAsync({ email: 'a@example.test', password: 'synthetic-private' }));
    assert.equal(result.reason, failure);
    assert.deepEqual(h.toasts, [[expected, 'error']]);
    assert.equal(h.refreshes.length, 0);
    assert.equal(h.navigation.length, 0);
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.logs.length, 0);
    const info = h.errorInfo(failure, 'signIn');
    assert.equal(info.kind, 'http');
    assert.equal(info.status, status);
    assert.equal(info.message, expected);
    assert.deepEqual(Object.keys(info).sort(), ['kind', 'message', 'status']);
  });
}

for (const [name, code, kind, expected] of [
  ['offline', 'ERR_NETWORK', 'network', 'Unable to connect. Check your connection and try again.'],
  ['timeout', 'ECONNABORTED', 'timeout', 'The request timed out. Please try again.'],
  ['explicit timeout', 'ETIMEDOUT', 'timeout', 'The request timed out. Please try again.'],
]) {
  test(`${name} is distinguished without refreshing, retrying, or leaking the native message`, async () => {
    const h = harness({ signedIn: false });
    let failure;
    h.setAdapter(async config => { throw (failure = new axios.AxiosError('Private native details', code, config, {})); });
    const result = await observe(h.auth().registerMutation.mutateAsync({ email: 'a@example.test', password: 'synthetic-private' }));
    assert.equal(result.reason, failure);
    assert.deepEqual(h.toasts, [[expected, 'error']]);
    assert.equal(h.errorInfo(failure).kind, kind);
    assert.equal(h.requests.length, 1);
    assert.equal(h.refreshes.length, 0);
    assert.equal(h.navigation.length, 0);
    assert.equal(h.logs.length, 0);
  });
}

for (const [mutationName, expected] of [
  ['registerMutation', 'Unable to register. Check your details and try again.'],
  ['verifyEmailMutation', 'Unable to verify the code. Check it and try again.'],
  ['verifyNewEmailMutation', 'Unable to verify the code. Check it and try again.'],
  ['sendForgetPasswordMutation', 'Unable to request a code. Check your details and try again.'],
  ['verifyResetPasswordOtpMutation', 'Unable to verify the code. Check it and try again.'],
  ['setNewPasswordMutation', 'Unable to reset your password. Please try again.'],
  ['changeEmailMutation', 'Unable to change your email. Check your details and try again.'],
  ['changePasswordMutation', 'Unable to change your password. Check your details and try again.'],
]) {
  test(`${mutationName} HTTP 400 has one safe error notification and no success side effects`, async () => {
    const h = harness();
    const generation = h.session.getSessionGeneration();
    h.setAdapter(async config => { throw httpFailure(config, 400, { detail: { password: 'unsafe object' } }); });
    const result = await observe(h.auth()[mutationName].mutateAsync({ email: 'a@example.test', otp: '123456', forgotPasswordToken: 'synthetic-reset' }));
    assert.equal(result.status, 'rejected');
    assert.deepEqual(h.toasts, [[expected, 'error']]);
    assert.equal(h.navigation.length, 0);
    assert.equal(h.registrations.length, 0);
    assert.equal(h.refreshes.length, 0);
    assert.equal(h.session.getSessionGeneration(), generation);
    assert.equal(h.store.getState().accessToken, 'A-access');
  });
}

for (const endpoint of ['/Auth/Refresh', '/Auth/Logout', '/Auth/CheckAppVersion']) {
  for (const status of [401, 500]) {
    test(`${endpoint} HTTP ${status} remains silent and never starts refresh`, async () => {
      const h = harness();
      let failure;
      h.setAdapter(async config => { throw (failure = httpFailure(config, status, { detail: 'Internal details' })); });
      const result = await observe(h.api.post(endpoint));
      h.apiHelpers().notifyApiError(result.reason);
      assert.equal(result.reason, failure);
      assert.equal(h.refreshes.length, 0);
      assert.equal(h.requests.length, 1);
      assert.equal(h.toasts.length, 0);
      assert.equal(h.logs.length, 0);
    });
  }
}

test('background push registration remains protected but stays silent after a failed replay', async () => {
  const h = harness();
  h.setAdapter(async config => { throw httpFailure(config, config._retry ? 500 : 401); });
  const pending = observe(h.notification().registerNotification.mutateAsync({ expoPushToken: 'synthetic-push', userId: 'A' }));
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-renewed')));
  assert.equal((await pending).status, 'rejected');
  assert.equal(h.refreshes.length, 1);
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].headers.get('Authorization'), 'Bearer A-access-renewed');
  assert.equal(h.toasts.length, 0);
  assert.equal(h.store.getState().accessToken, 'A-access-renewed');
});

test('credential settings still share refresh and failed replays notify once without looping', async () => {
  const h = harness();
  const generation = h.session.getSessionGeneration();
  h.setAdapter(async config => { throw httpFailure(config, 401); });
  const pending = observe(h.auth().changePasswordMutation.mutateAsync({ currentPassword: 'synthetic-old', newPassword: 'synthetic-new' }));
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].resolve(responseFor(account('A', '-renewed')));
  assert.equal((await pending).status, 'rejected');
  assert.equal(h.refreshes.length, 1);
  assert.equal(h.requests.length, 2);
  assert.equal(h.session.getSessionGeneration(), generation);
  assert.deepEqual(h.toasts, [['Unable to change your password. Check your details and try again.', 'error']]);
});

for (const mode of ['cancelled error', 'cancelled code', 'aborted signal']) {
  test(`${mode} remains silent through the interceptor and auth hook`, async () => {
    const h = harness();
    h.setAdapter(async config => {
      const failure = mode === 'cancelled error' ? new axios.CanceledError('Private cancellation', config) : new axios.AxiosError('Private cancellation', 'ERR_CANCELED', config);
      // Even an attached response must not turn cancellation into refresh.
      failure.response = { status: 401, data: {}, config };
      throw failure;
    });
    let result;
    if (mode === 'aborted signal') {
      const controller = new AbortController(); controller.abort();
      result = await observe(h.api.get('/private', { signal: controller.signal }));
      h.apiHelpers().notifyApiError(result.reason);
    } else result = await observe(h.auth().loginMutation.mutateAsync({ email: 'a@example.test', password: 'synthetic' }));
    assert.equal(result.status, 'rejected');
    assert.equal(h.errorInfo(result.reason).kind, 'cancelled');
    assert.equal(h.refreshes.length, 0);
    assert.equal(h.toasts.length, 0);
    assert.equal(h.logs.length, 0);
  });
}

test('an error from a stale login request cannot notify or modify the newer session', async () => {
  const h = harness(), reply = deferred();
  h.setAdapter(() => reply.promise);
  const pending = observe(h.auth().loginMutation.mutateAsync({ email: 'old@example.test', password: 'synthetic' }));
  await until(() => h.requests.length === 1);
  await h.session.setAuthenticatedSession(account('B'));
  h.queryClient.setQueryData(['private'], 'B-private');
  reply.reject(httpFailure(h.requests[0], 401));
  assert.equal((await pending).status, 'rejected');
  assert.equal(h.store.getState().accessToken, 'B-access');
  assert.equal(h.queryClient.getQueryData(['private']), 'B-private');
  assert.equal(h.toasts.length, 0);
  assert.equal(h.refreshes.length, 0);
});

test('the same error notifies once while independent attempts may notify again', async () => {
  const h = harness();
  h.setAdapter(async config => { throw httpFailure(config, 400); });
  const first = await observe(h.api.get('/private'));
  h.apiHelpers().notifyApiError(first.reason);
  h.apiHelpers().notifyApiError(first.reason);
  assert.equal(h.toasts.length, 1);
  await observe(h.api.get('/private'));
  assert.equal(h.toasts.length, 2);
});

for (const method of ['getData', 'postData', 'putData', 'deleteData']) {
  test(`${method} returns HTTP 2xx success:false bodies unchanged and preserves rejection identity`, async () => {
    const h = harness();
    const body = { success: false, message: 'Unconfirmed backend semantics', data: null };
    h.setAdapter(async config => h.ok(config, body));
    const helper = h.apiHelpers()[method];
    assert.equal(await helper('/private', {}), body);
    assert.equal(h.toasts.length, 0);
    let failure;
    h.setAdapter(async config => { throw (failure = httpFailure(config, 500)); });
    assert.equal((await observe(helper('/private', {}))).reason, failure);
    assert.equal(h.toasts.length, 1);
  });
}

test('public request policies match canonical, query-string, trailing-slash, and absolute URLs', async () => {
  const h = harness();
  h.setAdapter(async config => { throw httpFailure(config, 401); });
  for (const url of ['Auth/SignIn/', '/Auth/SignIn?request=synthetic', 'https://api.example.test/Auth/SignIn', '/auth/signin']) {
    assert.equal((await observe(h.api.post(url))).status, 'rejected');
  }
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.requests.length, 4);
  assert.equal(h.toasts.length, 4);
});

for (const name of ['otp-register', 'otp-forgot-password']) {
  test(`${name} actual resend catch cannot duplicate an interceptor error toast`, async () => {
    const h = harness();
    h.setAdapter(async config => { throw httpFailure(config, 400, { detail: 'Private resend diagnostics' }); });
    const otp = findElement(h.screen(name), 'OTPComponent');
    await otp.props.reSendOtp();
    assert.equal(h.requests.length, 1);
    assert.equal(h.refreshes.length, 0);
    assert.deepEqual(h.toasts, [['Unable to request a code. Check your details and try again.', 'error']]);
  });

  test(`${name} resend success uses controlled text without interpreting success:false`, async () => {
    const h = harness();
    h.setAdapter(async config => h.ok(config, { success: false, message: 'Private backend message', data: null }));
    const otp = findElement(h.screen(name), 'OTPComponent');
    await otp.props.reSendOtp();
    assert.deepEqual(h.toasts, [['A new code has been requested. Please check your email.', 'success']]);
  });
}

for (const name of ['index', 'register', 'forgot-password', 'set-new-password']) {
  test(`${name} existing field validation rejects invalid input before any API request`, async () => {
    const h = harness();
    const tree = h.screen(name);
    const form = h.forms[0];
    form.values = name === 'set-new-password' ? { password: 'short', confirmPassword: 'mismatch' } : { email: 'invalid', password: 'short', confirmPassword: 'mismatch' };
    await findElement(tree, 'PrimaryButton').props.onPress();
    assert.ok(Object.keys(form.errors).length > 0);
    const firstField = findElement(tree, 'Controller');
    const input = firstField.props.render({ field: { value: '', onChange() {}, onBlur() {} } });
    assert.equal(typeof input.props.error, 'string', 'Validation stays bound to the existing inline input error');
    assert.equal(h.requests.length, 0);
    assert.equal(h.refreshes.length, 0);
    assert.equal(h.toasts.length, 0);
  });
}

test('safe error projections, notifications, and logs never copy sensitive request/response fields', async () => {
  const h = harness();
  const secret = 'synthetic-sensitive-value';
  let failure;
  h.setAdapter(async config => { throw (failure = httpFailure(config, 400, {
    detail: secret, title: secret, message: secret, errors: { password: [secret], otp: [secret] },
    accessToken: secret, refreshToken: secret, forgotPasswordToken: secret,
  })); });
  await observe(h.auth().loginMutation.mutateAsync({ email: secret, password: secret }));
  const safe = { error: h.errorInfo(failure), toasts: h.toasts, logs: h.logs };
  assert.equal(JSON.stringify(safe).includes(secret), false);
  assert.equal(Object.hasOwn(safe.error, 'config'), false);
  assert.equal(Object.hasOwn(safe.error, 'response'), false);
  assert.equal(Object.hasOwn(safe.error, 'request'), false);
  assert.equal(h.toasts.length, 1);
  const unknown = h.errorInfo(new Error(secret));
  assert.equal(unknown.kind, 'unknown');
  assert.equal(unknown.message.includes(secret), false);
});

for (const mutationName of ['loginMutation', 'verifyEmailMutation', 'verifyNewEmailMutation']) {
  test(`${mutationName} stale persistence failure cannot notify or affect a newer login`, async () => {
    const h = harness();
    h.setAdapter(async config => h.ok(config, responseFor(account('B')).data));
    const write = h.holdNext('set');
    const pending = observe(h.auth()[mutationName].mutateAsync({ email: 'b@example.test', password: 'synthetic', otp: '123456' }));
    await write.started;
    const newer = h.session.setAuthenticatedSession(account('C'));
    write.fail(new Error('Old private persistence failure'));
    await pending;
    await newer;
    h.queryClient.setQueryData(['private'], 'C-private');
    const oldGeneration = h.session.getSessionGeneration() - 1;
    const lateFailure = new Error('Delayed callback failure');
    h.apiHelpers().notifyApiError(lateFailure, { generation: oldGeneration, action: 'signIn' });
    h.apiHelpers().notifyApiError(lateFailure, { action: 'signIn' });
    assert.equal(h.store.getState().accessToken, 'C-access');
    assert.equal(h.disk, 'C-refresh');
    assert.equal(h.policy, policyRecord('allowed'));
    assert.equal(h.queryClient.getQueryData(['private']), 'C-private');
    assert.equal(h.registrations.length, 0);
    assert.equal(h.toasts.length, 0);
  });
}

const authPayload = {
  email: 'old@example.test', password: 'synthetic', confirmPassword: 'synthetic',
  otp: '123456', userId: 1, newEmail: 'new@example.test',
  currentPassword: 'synthetic-old', newPassword: 'synthetic-new', forgotPasswordToken: 'synthetic-reset',
};
const authSuccessBody = (name, id = 'A') => name === 'registerMutation'
  ? { success: true, data: { user: account(id).user } }
  : name === 'verifyResetPasswordOtpMutation'
    ? { success: true, data: { forgotPasswordToken: 'synthetic-reset' } }
    : responseFor(account(id)).data;

for (const name of ['loginMutation', 'registerMutation', 'verifyEmailMutation', 'verifyNewEmailMutation',
  'changeEmailMutation', 'changePasswordMutation', 'sendForgetPasswordMutation', 'verifyResetPasswordOtpMutation', 'setNewPasswordMutation']) {
  for (const transition of ['logout', 'new account']) {
    test(`${name}: late HTTP success after ${transition} cannot publish data, persist, navigate, or call consumer callbacks`, async () => {
      const h = harness(), reply = deferred(), callbacks = [];
      h.setAdapter(() => reply.promise);
      const pending = observe(h.auth()[name].mutateAsync(authPayload, {
        onSuccess: () => callbacks.push('success'),
        onError: () => callbacks.push('error'),
        onSettled: () => callbacks.push('settled'),
      }));
      await until(() => h.requests.length === 1);
      if (transition === 'logout') {
        const logout = h.session.beginSessionLogout();
        await h.session.clearSession(logout.generation);
      } else {
        await h.session.setAuthenticatedSession(account('B'));
      }
      const state = h.store.getState(), token = h.disk, policy = h.policy;
      const writes = h.storage.length, policyWrites = h.policyStorage.length;
      h.queryClient.setQueryData(['current-session'], 'preserve-this');
      reply.resolve(h.ok(h.requests[0], authSuccessBody(name)));
      const result = await pending;
      assert.equal(result.status, 'rejected');
      assert.ok(axios.isCancel(result.reason));
      assert.equal(h.store.getState().user, state.user);
      assert.equal(h.store.getState().accessToken, state.accessToken);
      assert.equal(h.disk, token);
      assert.equal(h.policy, policy);
      assert.equal(h.storage.length, writes);
      assert.equal(h.policyStorage.length, policyWrites);
      assert.equal(h.queryClient.getQueryData(['current-session']), 'preserve-this');
      assert.deepEqual(callbacks, []);
      assert.deepEqual(h.navigation, []);
      assert.deepEqual(h.toasts, []);
      assert.deepEqual(h.logs, []);
    });
  }
}

test('the newer successful login wins across hook instances and reused input objects', async () => {
  const h = harness({ signedIn: false, saved: null }), replies = [deferred(), deferred()];
  let calls = 0;
  h.setAdapter(() => replies[calls++].promise);
  const first = observe(h.auth().loginMutation.mutateAsync(authPayload));
  await until(() => h.requests.length === 1);
  const second = observe(h.auth().loginMutation.mutateAsync(authPayload));
  await until(() => h.requests.length === 2);
  assert.notEqual(h.requests[0]._authenticationOperation.id, h.requests[1]._authenticationOperation.id);
  assert.equal(h.requests[0]._sessionGeneration, h.requests[1]._sessionGeneration);
  assert.deepEqual(JSON.parse(h.requests[0].data), authPayload, 'Operation metadata must not alter the backend body');
  replies[1].resolve(h.ok(h.requests[1], responseFor(account('B')).data));
  assert.equal((await second).status, 'fulfilled');
  const nativeWrites = h.storage.length, policyWrites = h.policyStorage.length;
  replies[0].resolve(h.ok(h.requests[0], responseFor(account('A')).data));
  assert.ok(axios.isCancel((await first).reason));
  assert.equal(h.store.getState().user.id, 'B');
  assert.equal(h.store.getState().accessToken, 'B-access');
  assert.equal(h.disk, 'B-refresh');
  assert.equal(h.storage.length, nativeWrites);
  assert.equal(h.policyStorage.length, policyWrites);
});

test('a newer failed attempt still supersedes older successes without clearing the current session', async () => {
  const h = harness(), replies = [deferred(), deferred()];
  let calls = 0;
  h.setAdapter(() => replies[calls++].promise);
  const older = observe(h.auth().loginMutation.mutateAsync(authPayload));
  await until(() => h.requests.length === 1);
  const newer = observe(h.auth().loginMutation.mutateAsync(authPayload));
  await until(() => h.requests.length === 2);
  replies[1].reject(httpFailure(h.requests[1], 400));
  await newer;
  replies[0].resolve(h.ok(h.requests[0], responseFor(account('B')).data));
  assert.ok(axios.isCancel((await older).reason));
  assert.equal(h.store.getState().user.id, 'A');
  assert.equal(h.store.getState().accessToken, 'A-access');
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.toasts.length, 1, 'Only the current failure may notify');
  assert.equal(h.policyStorage.length, 0);
});

test('an older auth mutation paused before dispatch cannot become the newest attempt when resumed', async () => {
  const h = harness({ signedIn: false, saved: null });
  h.setAdapter(async config => h.ok(config, responseFor(account('B')).data));
  const queued = h.holdNextMutation();
  const old = observe(h.auth().loginMutation.mutateAsync({ ...authPayload, email: 'old@example.test' }));
  await queued.started;
  await h.auth().loginMutation.mutateAsync({ ...authPayload, email: 'new@example.test' });
  queued.release();
  assert.ok(axios.isCancel((await old).reason));
  assert.equal(h.requests.length, 1);
  assert.equal(JSON.parse(h.requests[0].data).email, 'new@example.test');
  assert.equal(h.store.getState().user.id, 'B');
});

test('a success superseded between HTTP completion and mutation callback cannot publish user data', async () => {
  const h = harness({ signedIn: false, saved: null }), barrier = deferred();
  let reached = false;
  h.queryClient.getMutationCache().config.onSuccess = async () => { reached = true; await barrier.promise; };
  h.setAdapter(async config => h.ok(config, authSuccessBody('registerMutation')));
  const pending = observe(h.auth().registerMutation.mutateAsync(authPayload));
  await until(() => reached);
  await h.session.setAuthenticatedSession(account('B'));
  barrier.resolve();
  assert.ok(axios.isCancel((await pending).reason));
  assert.equal(h.store.getState().user.id, 'B');
  assert.equal(h.store.getState().accessToken, 'B-access');
  assert.equal(h.disk, 'B-refresh');
  assert.deepEqual(h.navigation, []);
});

for (const boundary of ['blocked policy', 'credential', 'allowed policy']) {
  test(`superseding authentication during ${boundary} persistence cannot publish or leave restoration allowed`, async () => {
    const h = harness({ signedIn: false, saved: null }), nextReply = deferred();
    h.setAdapter(async config => h.requests.length === 1
      ? h.ok(config, responseFor(account('A')).data) : nextReply.promise);
    const held = h.holdNext(boundary === 'blocked policy' ? 'policySet' : 'set');
    const old = observe(h.auth().loginMutation.mutateAsync(authPayload));
    await held.started;
    let nativeBoundary = held;
    if (boundary === 'allowed policy') {
      nativeBoundary = h.holdNext('policySet');
      held.release();
      await nativeBoundary.started;
    }
    const generation = h.session.getSessionGeneration();
    const next = observe(h.auth().loginMutation.mutateAsync(authPayload));
    await until(() => h.requests.length === 2);
    assert.equal(h.session.getSessionGeneration(), generation, 'New intent alone must not rotate the session');
    nativeBoundary.release();
    assert.ok(axios.isCancel((await old).reason));
    assert.equal(h.store.getState().user, null);
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.policy, policyRecord('blocked'));
    assert.equal(h.session.isRefreshBlocked(), true);
    if (boundary === 'blocked policy') assert.equal(h.storage.filter(event => event.kind === 'set').length, 0);
    const restarted = h.restart();
    await restarted.restoreUser();
    assert.equal(restarted.refreshes.length, 0, 'A stale native write must not authorize restoration');
    nextReply.resolve(h.ok(h.requests[1], responseFor(account('B')).data));
    assert.equal((await next).status, 'fulfilled');
    assert.equal(h.store.getState().user.id, 'B');
    assert.equal(h.store.getState().accessToken, 'B-access');
    assert.equal(h.disk, 'B-refresh');
    assert.equal(h.policy, policyRecord('allowed'));
    assert.deepEqual(h.toasts, []);
  });
}

test('a session setter rejects an already superseded operation before advancing or touching persistence', async () => {
  const h = harness(), operation = h.session.beginAuthenticationOperation();
  h.session.beginAuthenticationOperation();
  const generation = h.session.getSessionGeneration();
  assert.equal(await h.session.setAuthenticatedSession(account('B'), operation), null);
  assert.equal(h.session.getSessionGeneration(), generation);
  assert.equal(h.store.getState().user.id, 'A');
  assert.deepEqual(h.storage, []);
  assert.deepEqual(h.policyStorage, []);
});

test('auth response interception rejects superseded direct service calls within the same generation', async () => {
  const h = harness(), reply = deferred();
  h.setAdapter(() => reply.promise);
  const pending = observe(h.authServices().register(authPayload));
  await until(() => h.requests.length === 1);
  const generation = h.session.getSessionGeneration();
  h.session.beginAuthenticationOperation();
  reply.resolve(h.ok(h.requests[0], authSuccessBody('registerMutation', 'B')));
  assert.ok(axios.isCancel((await pending).reason));
  assert.equal(h.session.getSessionGeneration(), generation);
  assert.equal(h.store.getState().user.id, 'A');
  assert.equal(h.store.getState().accessToken, 'A-access');
});

test('a stale credential 401 cannot refresh or notify even when the session generation is unchanged', async () => {
  const h = harness(), reply = deferred();
  h.setAdapter(() => reply.promise);
  const pending = observe(h.auth().verifyNewEmailMutation.mutateAsync(authPayload));
  await until(() => h.requests.length === 1);
  h.session.beginAuthenticationOperation();
  const failure = httpFailure(h.requests[0], 401);
  reply.reject(failure);
  assert.equal((await pending).reason, failure, 'Existing rejection identity remains intact');
  assert.equal(h.refreshes.length, 0);
  assert.deepEqual(h.toasts, []);
  assert.equal(h.store.getState().accessToken, 'A-access');
});

test('consumer success/settled callbacks cannot run after a newer operation begins during settlement', async () => {
  const h = harness(), barrier = deferred(), callbacks = [];
  let reached = false;
  h.queryClient.getMutationCache().config.onSettled = async () => { reached = true; await barrier.promise; };
  h.setAdapter(async config => h.ok(config, { success: true, data: null }));
  const pending = observe(h.auth().changeEmailMutation.mutateAsync(authPayload, {
    onSuccess: () => callbacks.push('success'), onSettled: () => callbacks.push('settled'),
  }));
  await until(() => reached);
  h.session.beginAuthenticationOperation();
  barrier.resolve();
  assert.ok(axios.isCancel((await pending).reason));
  assert.deepEqual(callbacks, []);
});

test('normal registration and OTP retain callback payloads, pending identity, navigation, and confirmed credentials', async () => {
  const h = harness({ signedIn: false, saved: null }), callbacks = [];
  h.setAdapter(async config => h.ok(config, config.url === '/Auth/SignUp'
    ? authSuccessBody('registerMutation') : responseFor(account('A')).data));
  const auth = h.auth();
  const registration = await auth.registerMutation.mutateAsync(authPayload, {
    onSuccess: (data, variables) => callbacks.push([data.data.user.id, variables.email]),
  });
  assert.equal(registration.data.user.id, 'A');
  assert.equal(h.store.getState().user.id, 'A');
  assert.equal(h.store.getState().accessToken, null);
  assert.deepEqual(h.navigation, [['push', '/(auth)/otp-register']]);
  assert.deepEqual(callbacks, [['A', authPayload.email]]);
  await auth.verifyEmailMutation.mutateAsync(authPayload);
  assert.equal(h.store.getState().accessToken, 'A-access');
  assert.equal(h.disk, 'A-refresh');
  assert.equal(h.policy, policyRecord('allowed'));
  assert.equal(h.registrations.length, 0);
});

test('password-reset delayed navigation is discarded after another authentication operation', async () => {
  const timers = [], h = harness({ signedIn: false, saved: null, scheduleTimeout: callback => { timers.push(callback); return 0; } });
  h.setAdapter(async config => h.ok(config, { success: true, data: null }));
  await h.auth().setNewPasswordMutation.mutateAsync(authPayload);
  assert.equal(timers.length, 1);
  await h.session.setAuthenticatedSession(account('B'));
  timers[0]();
  assert.deepEqual(h.navigation, []);
  assert.equal(h.store.getState().user.id, 'B');
});

for (const boundary of ['credential', 'allowed policy']) {
  test(`a newer confirmed login owns persistence while an old ${boundary} write is still in flight`, async () => {
    const h = harness({ signedIn: false, saved: null });
    h.setAdapter(async config => h.ok(config, responseFor(account(h.requests.length === 1 ? 'A' : 'B')).data));
    const credential = h.holdNext('set');
    const old = observe(h.auth().verifyEmailMutation.mutateAsync(authPayload));
    await credential.started;
    let held = credential;
    if (boundary === 'allowed policy') {
      held = h.holdNext('policySet');
      credential.release();
      await held.started;
    }
    const generation = h.session.getSessionGeneration();
    const newer = observe(h.auth().loginMutation.mutateAsync(authPayload));
    await until(() => h.session.getSessionGeneration() === generation + 1);
    held.release();
    assert.ok(axios.isCancel((await old).reason));
    assert.equal((await newer).status, 'fulfilled');
    h.queryClient.setQueryData(['new-session'], 'B-private');
    await tick();
    assert.equal(h.store.getState().user.id, 'B');
    assert.equal(h.store.getState().accessToken, 'B-access');
    assert.equal(h.disk, 'B-refresh');
    assert.equal(h.policy, policyRecord('allowed'));
    assert.equal(h.session.isRefreshBlocked(), false);
    assert.equal(h.queryClient.getQueryData(['new-session']), 'B-private');
    assert.deepEqual(h.toasts, []);
  });
}

test('normal password-reset navigation still executes when its operation remains current', async () => {
  const timers = [], h = harness({ signedIn: false, saved: null, scheduleTimeout: callback => { timers.push(callback); return 0; } });
  h.setAdapter(async config => h.ok(config, { success: true, data: null }));
  await h.auth().setNewPasswordMutation.mutateAsync(authPayload);
  timers[0]();
  assert.deepEqual(h.navigation, [['replace', '/(auth)']]);
  assert.deepEqual(h.toasts, [['Password has been reset successfully. Please login.', 'success']]);
});
