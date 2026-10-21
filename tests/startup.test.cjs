// Run with: node --test tests/*.test.cjs
// Execute the real root layout and session modules with deterministic native
// boundaries. The small hook runner models effects/cleanup; it is not a native renderer.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient } = require('@tanstack/react-query');

const root = path.resolve(__dirname, '..');
const compiled = new Map();
const runtimes = new Set();
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const until = async predicate => {
  for (let i = 0; i < 20; i++) {
    if (predicate()) return;
    await tick();
  }
  assert.ok(predicate(), 'Expected asynchronous boundary was not reached');
};
const account = {
  user: { id: 'A', email: 'a@example.test' },
  accessToken: 'A-access', refreshToken: 'A-refresh',
};
const response = { data: { success: true, data: {
  user: account.user, token: { accessToken: account.accessToken, refreshToken: account.refreshToken },
} } };
const findView = tree => {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === 'View') return tree;
  for (const child of [tree.props?.children].flat()) {
    const view = findView(child);
    if (view) return view;
  }
  return null;
};

function harness(options = {}) {
  const modules = new Map(), mounts = [];
  const logs = [], refreshes = [], storage = [], redirects = [], splash = [];
  let token = 'saved-refresh';
  let policy = JSON.stringify({ version: 1, state: 'allowed' });
  let fonts = [true, null], current, restoreCalls = 0;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const instance = current, index = instance.cursor++;
      const slot = instance.slots[index] ??= { value: initial };
      return [slot.value, value => {
        if (!instance.active) { instance.lateUpdates++; return; }
        slot.value = typeof value === 'function' ? value(slot.value) : value;
        instance.dirty = true;
      }];
    },
    useRef(initial) {
      const index = current.cursor++;
      return current.slots[index] ??= { current: initial };
    },
    useEffect(setup, deps) {
      const instance = current, index = instance.cursor++;
      const previous = instance.slots[index];
      if (!previous || !sameDeps(previous.deps, deps)) {
        const slot = { deps, setup, cleanup: previous?.cleanup };
        instance.slots[index] = slot;
        instance.effects.push(slot);
      }
    },
    useCallback(callback, deps) {
      const index = current.cursor++, previous = current.slots[index];
      if (!previous || !sameDeps(previous.deps, deps)) current.slots[index] = { deps, callback };
      return current.slots[index].callback;
    },
  };
  const Stack = Object.assign(() => {}, { Screen: 'Stack.Screen' });
  const external = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View' },
    'react-native-reanimated': {},
    '@react-navigation/native': {
      DarkTheme: { colors: { background: '#000' } }, DefaultTheme: { colors: { background: '#fff' } }, ThemeProvider: 'ThemeProvider',
    },
    'expo-font': { useFonts: () => fonts },
    'expo-router': { Stack },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-splash-screen': {
      preventAutoHideAsync: async () => {
        splash.push('prevent');
        if (options.preventError) throw options.preventError;
      },
      hideAsync: async () => {
        splash.push('hide');
        if (options.hide) return options.hide();
      },
      hide: () => {
        splash.push('fallback');
        if (options.fallbackError) throw options.fallbackError;
      },
    },
    '@/components/ui/Toast': { Toast: 'Toast' },
    '@/hooks/useColorScheme': { useColorScheme: () => 'light' },
    '@/stores/theme': { useThemeStore: select => select({ preference: 'system' }) },
    '@/stores/toastStore': { useToastStore: () => ({ visible: false }) },
    '@/hooks/useUserStateRedirect': { useUserStateRedirect: ready => redirects.push(ready) },
    '@/utility/restoreUser': { restoreUser: () => {
      restoreCalls++;
      return options.restore ? options.restore() : load('utility/restoreUser.ts').restoreUser();
    } },
    '../assets/fonts/SpaceMono-Regular.ttf': 'font-asset',
    '@tanstack/react-query': { QueryClient, QueryClientProvider: 'QueryClientProvider' },
    zustand: require('zustand'),
    axios: { post: (url, body, config) => {
      const pending = deferred();
      refreshes.push({ url, body, config, ...pending });
      return pending.promise;
    } },
    'expo-secure-store': {
      getItemAsync: async () => {
        storage.push('read-token');
        if (options.tokenReadError) throw options.tokenReadError;
        return token;
      },
      setItemAsync: async (key, value) => { storage.push('write-token'); token = value; },
      deleteItemAsync: async () => { storage.push('delete-token'); token = null; },
    },
    'expo-file-system/legacy': {
      documentDirectory: 'file:///app-private/documents/',
      readAsStringAsync: async () => {
        storage.push('read-policy');
        if (options.policyReadError) throw options.policyReadError;
        return policy;
      },
      writeAsStringAsync: async (uri, value) => { storage.push('write-policy'); policy = value; },
    },
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText);
    const module = { exports: {} };
    modules.set(file, module);
    vm.runInNewContext(compiled.get(file), {
      module, exports: module.exports,
      process: { env: { EXPO_PUBLIC_BASE_URL: options.noBackend ? '' : 'https://api.example.test' } },
      console: { warn: (...args) => logs.push(args), log: (...args) => logs.push(args) },
      require: id => {
        if (Object.hasOwn(external, id)) return external[id];
        assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
        return load(`${id.slice(2)}.ts`);
      },
    }, { filename: file });
    return module.exports;
  }
  const store = load('stores/authStore.ts').useAuthStore;
  const session = load('services/authSession.ts');
  const queryClient = load('services/queryClient.ts').queryClient;
  const RootLayout = load('app/_layout.tsx').default;
  const h = {
    store, session, queryClient, refreshes, storage, redirects, splash, logs,
    get restoreCalls() { return restoreCalls; },
    get token() { return token; },
    get policy() { return policy; },
    setFonts: (loaded, error = null) => { fonts = [loaded, error]; },
    mount() {
      const instance = {
        slots: [], effects: [], cursor: 0, active: true, dirty: false, lateUpdates: 0, tree: null,
        render() {
          assert.ok(instance.active, 'Cannot render an unmounted layout');
          current = instance;
          instance.cursor = 0; instance.effects = []; instance.dirty = false;
          instance.tree = RootLayout();
          for (const slot of instance.effects) { slot.cleanup?.(); slot.cleanup = slot.setup(); }
          return instance.tree;
        },
        layout() {
          const view = findView(instance.tree);
          assert.ok(view, 'Root must render before native layout/splash dismissal');
          view.props.onLayout();
        },
        replayEffects() {
          const effects = instance.slots.filter(slot => slot?.setup);
          for (const slot of effects) slot.cleanup?.();
          for (const slot of effects) slot.cleanup = slot.setup();
        },
        unmount() {
          if (!instance.active) return;
          instance.active = false;
          for (const slot of instance.slots) slot?.cleanup?.();
        },
      };
      mounts.push(instance);
      instance.render();
      return instance;
    },
    async flush() {
      await tick();
      for (const instance of mounts) if (instance.active && instance.dirty) instance.render();
      await tick();
    },
    cleanup() { for (const instance of mounts) instance.unmount(); queryClient.clear(); },
  };
  runtimes.add(h);
  return h;
}
test.afterEach(() => {
  for (const runtime of runtimes) runtime.cleanup();
  runtimes.clear();
});

test('cold start waits for successful restoration and native root layout before hiding splash', async () => {
  const h = harness(), root = h.mount();
  assert.equal(root.tree, null);
  assert.equal(h.redirects.at(-1), false);
  await until(() => h.refreshes.length === 1);
  await h.flush();
  assert.equal(root.tree, null, 'Slow restoration must not render authenticated routes early');
  assert.deepEqual(h.splash, ['prevent']);
  h.refreshes[0].resolve(response);
  await h.flush();
  assert.ok(findView(root.tree));
  assert.equal(h.store.getState().accessToken, 'A-access');
  assert.equal(h.redirects.at(-1), true);
  assert.deepEqual(h.splash, ['prevent'], 'State readiness alone must not dismiss splash');
  root.layout(); root.layout(); root.render(); root.layout();
  await h.flush();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
  assert.equal(h.restoreCalls, 1);
});

test('no-backend startup renders signed out without reading or changing persisted credentials', async () => {
  const h = harness({ noBackend: true }), root = h.mount();
  await h.flush();
  assert.equal(h.store.getState().user, null);
  assert.equal(h.restoreCalls, 0);
  assert.deepEqual(h.storage, []);
  assert.equal(h.token, 'saved-refresh');
  assert.ok(findView(root.tree));
  root.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

test('session readiness waits for fonts, and fonts alone do not dismiss splash', async () => {
  const h = harness({ noBackend: true });
  h.setFonts(false);
  const root = h.mount();
  await h.flush();
  assert.equal(root.tree, null);
  assert.deepEqual(h.splash, ['prevent']);
  h.setFonts(true);
  root.render();
  assert.ok(findView(root.tree));
  assert.deepEqual(h.splash, ['prevent']);
  root.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

test('font failure uses the existing shell with system fonts, while still waiting for restoration', async () => {
  const h = harness();
  h.setFonts(false, new Error('native font failure'));
  const root = h.mount();
  await until(() => h.refreshes.length === 1);
  assert.equal(root.tree, null);
  h.refreshes[0].resolve(response);
  await h.flush();
  assert.ok(findView(root.tree));
  assert.equal(h.redirects.at(-1), true);
  root.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
  assert.ok(h.logs.some(args => args[0] === 'Custom font loading failed; using system fonts.'));
});

test('offline restoration releases splash, preserves recoverable credentials, and permits later recovery', async () => {
  const h = harness(), root = h.mount();
  await until(() => h.refreshes.length === 1);
  const generation = h.session.getSessionGeneration();
  h.refreshes[0].reject(new Error('offline'));
  await h.flush();
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.store.getState().user, null);
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  assert.equal(h.token, 'saved-refresh');
  assert.equal(JSON.parse(h.policy).state, 'allowed');
  assert.ok(findView(root.tree));
  root.layout();
  const recovery = h.session.restoreSession();
  await until(() => h.refreshes.length === 2);
  h.refreshes[1].resolve(response);
  await recovery;
  assert.equal(h.store.getState().accessToken, 'A-access');
  assert.equal(h.session.getSessionGeneration(), generation + 1);
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

for (const boundary of ['tokenReadError', 'policyReadError']) {
  test(`${boundary} completes startup signed out without deleting credentials or changing policy`, async () => {
    const h = harness({ [boundary]: new Error('native read failed') }), root = h.mount();
    await h.flush();
    assert.ok(findView(root.tree));
    assert.equal(h.store.getState().accessToken, null);
    assert.equal(h.store.getState().user, null);
    assert.equal(h.refreshes.length, 0);
    assert.equal(h.token, 'saved-refresh');
    assert.equal(JSON.parse(h.policy).state, 'allowed');
    assert.ok(h.storage.every(kind => kind.startsWith('read-')));
    root.layout();
    assert.deepEqual(h.splash, ['prevent', 'hide']);
  });
}

test('unexpected restoration rejection settles unknown authentication and allows rendering', async () => {
  const pending = deferred();
  const h = harness({ restore: () => pending.promise }), root = h.mount();
  pending.reject(new Error('unexpected bootstrap failure with sensitive details'));
  await h.flush();
  assert.equal(h.store.getState().user, null);
  assert.equal(h.store.getState().accessToken, null);
  assert.equal(h.session.getSessionGeneration(), 0);
  assert.deepEqual(h.storage, []);
  assert.ok(findView(root.tree));
  assert.ok(h.logs.some(args => args[0] === 'Session restoration failed during startup.'));
  assert.ok(h.logs.every(args => args.length === 1 && !String(args[0]).includes('sensitive details')));
  root.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

test('unexpected startup rejection cannot clear a superseding authenticated session or its cache', async () => {
  const pending = deferred();
  const h = harness({ restore: () => pending.promise }), root = h.mount();
  await h.session.setAuthenticatedSession(account);
  h.queryClient.setQueryData(['private'], 'new-session-data');
  const generation = h.session.getSessionGeneration();
  pending.reject(new Error('old startup failed'));
  await h.flush();
  assert.equal(h.store.getState().accessToken, 'A-access');
  assert.equal(h.session.getSessionGeneration(), generation);
  assert.equal(h.queryClient.getQueryData(['private']), 'new-session-data');
  assert.ok(findView(root.tree));
});

test('rerenders, effect replay, and root remounts share startup without late state updates', async () => {
  const h = harness(), first = h.mount();
  first.render(); first.replayEffects();
  await until(() => h.refreshes.length === 1);
  assert.equal(h.restoreCalls, 1);
  first.unmount();
  const second = h.mount();
  assert.equal(h.restoreCalls, 1);
  h.refreshes[0].resolve(response);
  await h.flush();
  assert.equal(first.lateUpdates, 0);
  assert.equal(first.tree, null);
  assert.ok(findView(second.tree));
  second.unmount();
  const third = h.mount();
  await h.flush();
  assert.ok(findView(third.tree));
  assert.equal(h.restoreCalls, 1, 'A settled bootstrap must not rerun on remount');
  assert.equal(h.refreshes.length, 1);
  assert.deepEqual(h.splash, ['prevent']);
  third.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

test('delayed native splash dismissal does not repeat initialization or blank the rendered root', async () => {
  const pending = deferred();
  const h = harness({ noBackend: true, hide: () => pending.promise }), root = h.mount();
  await h.flush();
  root.layout(); root.render(); root.layout();
  assert.ok(findView(root.tree));
  assert.deepEqual(h.splash, ['prevent', 'hide']);
  pending.resolve();
  await h.flush();
  assert.ok(findView(root.tree));
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

test('splash prevention rejection is handled and asynchronous hide rejection attempts native fallback', async () => {
  const h = harness({ noBackend: true, preventError: new Error('prevent failed'), hide: async () => { throw new Error('hide failed'); } });
  const root = h.mount();
  await h.flush();
  assert.ok(findView(root.tree));
  root.layout();
  await h.flush();
  root.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide', 'fallback']);
  assert.ok(h.logs.every(args => args.length === 1 && typeof args[0] === 'string'));
});

test('native hide failures are handled, and a later layout can retry without a retry loop', async () => {
  const options = { noBackend: true, hide: async () => { throw new Error('hide failed'); }, fallbackError: new Error('native refused hide') };
  const h = harness(options), root = h.mount();
  await h.flush();
  root.layout();
  await h.flush();
  assert.deepEqual(h.splash, ['prevent', 'hide', 'fallback']);
  assert.ok(findView(root.tree));
  assert.ok(h.logs.some(args => args[0] === 'Could not dismiss the native splash screen.'));
  options.hide = async () => {};
  root.layout();
  await h.flush();
  assert.deepEqual(h.splash, ['prevent', 'hide', 'fallback', 'hide']);
});

test('a hide rejection after unmount cannot initiate another native hide or state update', async () => {
  const pending = deferred();
  const h = harness({ noBackend: true, hide: () => pending.promise }), root = h.mount();
  await h.flush();
  root.layout(); root.unmount();
  pending.reject(new Error('late hide failure'));
  await h.flush();
  assert.equal(root.lateUpdates, 0);
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

test('a queued layout callback from an unmounted root cannot dismiss splash', async () => {
  const h = harness({ noBackend: true }), root = h.mount();
  await h.flush();
  root.unmount(); root.layout();
  assert.deepEqual(h.splash, ['prevent']);
});
