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
const { QueryClient, QueryObserver } = require('@tanstack/react-query');
const React = require('react');
const jsxRuntime = require('react/jsx-runtime');
const { StackRouter } = require('@react-navigation/routers');
const { notifications, response: notificationResponse } = require('./helpers/notifications.cjs');

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
const findElement = (tree, type) => {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === type) return tree;
  for (const child of [tree.props?.children].flat()) {
    const found = findElement(child, type);
    if (found) return found;
  }
  return null;
};
const findView = tree => findElement(tree, 'View');

// Run the installed Expo Router's real Protected recognition/child filtering.
// Mock unused native imports; do not reimplement guard selection in the tests.
const routerModules = new Map();
const routerImports = {
  react: { ...React, useMemo: factory => factory() },
  'react/jsx-runtime': jsxRuntime,
  '@react-navigation/native': {},
  '../primitives': { Group: () => null },
  '../Route': {},
  '../useScreens': {},
  '../useNavigation': {},
  './useSafeLayoutEffect': {},
  '../utils/stack': {},
  '../native-tabs/NativeBottomTabs/NativeTabTrigger': { isNativeTabTrigger: () => false },
};
function loadRouter(file) {
  if (routerModules.has(file)) return routerModules.get(file).exports;
  const module = { exports: {} };
  routerModules.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'node_modules/expo-router/build', `${file}.js`), 'utf8'), {
    fileName: `${file}.tsx`,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, process: { env: { NODE_ENV: 'test' } },
    console: { warn: message => { throw new Error(message); } },
    require: id => {
      if (Object.hasOwn(routerImports, id)) return routerImports[id];
      if (id === '../views/Screen') return loadRouter('views/Screen');
      if (id === '../views/Protected') return loadRouter('views/Protected');
      throw new Error(`Unexpected router import: ${id}`);
    },
  }, { filename: `expo-router/${file}.js` });
  return module.exports;
}
const Screen = loadRouter('views/Screen').Screen;
const Protected = loadRouter('views/Protected').Protected;
const filterScreens = loadRouter('layouts/withLayoutContext').useFilterScreenChildren;
const routeConfig = names => ({ routeNames: names, routeParamList: {}, routeGetIdList: {}, routeKeyChanges: [] });
const stackRouter = StackRouter({});

function harness(options = {}) {
  const push = notifications(options.push);
  const modules = new Map(), mounts = [];
  const logs = [], refreshes = [], storage = [], themeStorage = [], toasts = [], splash = [], links = [];
  let token = options.saved === undefined ? 'saved-refresh' : options.saved;
  let savedTheme = options.savedTheme ?? null;
  let policy = JSON.stringify({ version: 1, state: 'allowed' });
  let fonts = [true, null], current, restoreCalls = 0, appVersionData;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    createContext(value) {
      const context = { value };
      context.Provider = Object.assign(() => null, { context });
      return context;
    },
    useContext: context => context.value,
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
  const Stack = Object.assign(() => {}, { Screen, Protected });
  const Tabs = Object.assign(() => {}, { Screen, Protected });
  const toastState = { visible: false, showToast: (...args) => toasts.push(args) };
  const external = {
    react,
    'react/jsx-runtime': jsxRuntime,
    'react-native': { Platform: { OS: 'ios' }, AppState: push.AppState, View: 'View', StyleSheet: { create: styles => styles } },
    'expo-notifications': push.Notifications,
    'expo-constants': push.Constants,
    'expo-device': push.Device,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'react-native-reanimated': {},
    '@react-navigation/native': {
      DarkTheme: { colors: { background: '#000' } }, DefaultTheme: { colors: { background: '#fff' } }, ThemeProvider: 'ThemeProvider',
    },
    'expo-font': { useFonts: () => fonts },
    'expo-router': { Stack, Tabs, useLocalSearchParams: () => options.params ?? {} },
    'expo-linking': { openURL: url => links.push(url) },
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
    '@/hooks/useColorScheme': { useColorScheme: () => options.systemScheme ?? 'light' },
    '@/stores/toastStore': { useToastStore: select => select ? select(toastState) : toastState },
    '@/hooks/useThemeColor': { useThemeColor: () => '#fff' },
    '@/hooks/useAppVersion': { __esModule: true, default: () => appVersionData },
    '@/utility/restoreUser': { restoreUser: () => {
      restoreCalls++;
      return options.restore ? options.restore() : load('utility/restoreUser.ts').restoreUser();
    } },
    '../assets/fonts/SpaceMono-Regular.ttf': 'font-asset',
    '@tanstack/react-query': { QueryClient, QueryClientProvider: 'QueryClientProvider' },
    zustand: require('zustand'),
    'zustand/middleware': require('zustand/middleware'),
    axios: { post: (url, body, config) => {
      const pending = deferred();
      refreshes.push({ url, body, config, ...pending });
      return pending.promise;
    } },
    'expo-secure-store': {
      getItemAsync: async key => {
        if (key === 'theme-preference') {
          themeStorage.push('read');
          return options.readTheme ? options.readTheme() : savedTheme;
        }
        storage.push('read-token');
        if (options.tokenReadError) throw options.tokenReadError;
        return token;
      },
      setItemAsync: async (key, value) => {
        if (key === 'theme-preference') { themeStorage.push('write'); savedTheme = value; return; }
        storage.push('write-token'); token = value;
      },
      deleteItemAsync: async key => {
        if (key === 'theme-preference') { themeStorage.push('remove'); savedTheme = null; return; }
        storage.push('delete-token'); token = null;
      },
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
      module, exports: module.exports, Promise,
      process: { env: { EXPO_PUBLIC_BASE_URL: options.noBackend ? '' : 'https://api.example.test' } },
      console: { warn: (...args) => logs.push(args), log: (...args) => logs.push(args) },
      require: id => {
        if (id === '@/stores/authStore' && (file.startsWith('app/') || file.startsWith('hooks/'))) {
          const authModule = load('stores/authStore.ts');
          return { ...authModule, useAuthStore: Object.assign(select => select(authModule.useAuthStore.getState()), authModule.useAuthStore) };
        }
        if (id === '@/stores/notificationStore' && file.startsWith('hooks/')) {
          const notificationModule = load('stores/notificationStore.ts');
          return { ...notificationModule, useNotificationStore: select => select(notificationModule.useNotificationStore.getState()) };
        }
        if (id === '@/stores/theme') {
          const themeModule = load('stores/theme.ts');
          return { ...themeModule, useThemeStore: Object.assign(select => select(themeModule.useThemeStore.getState()), themeModule.useThemeStore) };
        }
        if (Object.hasOwn(external, id)) return external[id];
        if (id.startsWith('@/components/')) {
          const name = path.posix.basename(id);
          return { [name]: name };
        }
        assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
        return load(`${id.slice(2)}.ts`);
      },
    }, { filename: file });
    return module.exports;
  }
  const store = load('stores/authStore.ts').useAuthStore;
  const themeStore = load('stores/theme.ts').useThemeStore;
  const notificationStore = load('stores/notificationStore.ts').useNotificationStore;
  const session = load('services/authSession.ts');
  const queryClient = load('services/queryClient.ts').queryClient;
  const updateContext = load('hooks/useAppUpdatePolicy.ts').AppUpdatePolicyContext;
  store.subscribe(() => { for (const instance of mounts) if (instance.active) instance.dirty = true; });
  themeStore.subscribe(() => { for (const instance of mounts) if (instance.active) instance.dirty = true; });
  notificationStore.subscribe(() => { for (const instance of mounts) if (instance.active) instance.dirty = true; });
  const h = {
    store, themeStore, notificationStore, push, session, queryClient, refreshes, storage, themeStorage, toasts, splash, logs, links,
    takeNotificationResponse: ready => load('services/pushNotifications.ts').takeNotificationResponse(ready),
    get restoreCalls() { return restoreCalls; },
    get token() { return token; },
    get policy() { return policy; },
    setFonts: (loaded, error = null) => { fonts = [loaded, error]; },
    setUpdatePolicy(value) {
      appVersionData = value ? { data: { appVersionPolicy: value } } : undefined;
      for (const instance of mounts) if (instance.active) instance.dirty = true;
    },
    screens(instance) {
      const navigator = findElement(instance.tree, Stack) ?? findElement(instance.tree, Tabs);
      return navigator ? Array.from(filterScreens(navigator.props.children).screens, screen => screen.name) : [];
    },
    mount(file = 'app/_layout.tsx') {
      const Component = load(file).default;
      const instance = {
        slots: [], effects: [], cursor: 0, active: true, dirty: false, lateUpdates: 0, tree: null,
        render() {
          assert.ok(instance.active, 'Cannot render an unmounted layout');
          current = instance;
          instance.cursor = 0; instance.effects = []; instance.dirty = false;
          instance.tree = Component();
          const provider = findElement(instance.tree, updateContext.Provider);
          if (provider) updateContext.value = provider.props.value;
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
  assert.deepEqual(h.screens(root), []);
  await until(() => h.refreshes.length === 1);
  await h.flush();
  assert.equal(root.tree, null, 'Slow restoration must not render authenticated routes early');
  assert.deepEqual(h.splash, ['prevent']);
  h.refreshes[0].resolve(response);
  await h.flush();
  assert.ok(findView(root.tree));
  assert.equal(h.store.getState().accessToken, 'A-access');
  assert.deepEqual(h.screens(root), ['(dashboard)', '+not-found', '_sitemap']);
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
  assert.equal(h.push.active('received'), 0);
  assert.equal(h.push.count('expoToken'), 0);
  assert.ok(findView(root.tree));
  root.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

test('restored sessions acquire push tokens without mounting login or blocking startup on push acquisition', async () => {
  const token = deferred();
  const h = harness({ push: { getToken: () => token.promise } });
  const root = h.mount();
  await until(() => h.refreshes.length === 1);
  assert.equal(h.push.active('received'), 1);
  h.refreshes[0].resolve(response);
  await h.flush();
  assert.deepEqual(h.screens(root), ['(dashboard)', '+not-found', '_sitemap']);
  assert.equal(h.store.getState().pushNotificationToken, null);
  root.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
  token.resolve({ data: 'restored-session-device-token' });
  await h.flush();
  assert.equal(h.store.getState().pushNotificationToken, 'restored-session-device-token');
  assert.equal(h.push.count('expoToken'), 1);
  assert.equal(h.restoreCalls, 1);
});

test('root notification ownership survives effect replay/remount and queues a cold-start tap until session readiness', async () => {
  const tap = notificationResponse('cold-start');
  const h = harness({ push: { lastResponse: tap } });
  const root = h.mount();
  root.replayEffects();
  root.render();
  await until(() => h.refreshes.length === 1);
  assert.equal(h.takeNotificationResponse(false), null);
  assert.equal(h.takeNotificationResponse(true), null);
  h.push.emit('response', tap);
  root.unmount();
  assert.equal(h.push.active('received'), 0);
  const remount = h.mount();
  h.refreshes[0].resolve(response);
  await h.flush();
  assert.ok(findView(remount.tree));
  assert.equal(h.takeNotificationResponse(true), tap);
  assert.equal(h.takeNotificationResponse(true), null);
  assert.equal(h.push.maxima.received, 1);
  assert.equal(h.push.maxima.response, 1);
  assert.equal(h.push.maxima.token, 1);
  assert.equal(h.push.count('expoToken'), 1);
  assert.equal(root.lateUpdates, 0);
});

test('notification permission/token failures preserve session restoration, navigation, and splash readiness', async () => {
  for (const push of [
    { permission: { status: 'denied', granted: false, canAskAgain: false } },
    { getToken: async () => { throw new Error('Native acquisition unavailable'); } },
  ]) {
    const h = harness({ push }), root = h.mount();
    await until(() => h.refreshes.length === 1);
    h.refreshes[0].resolve(response);
    await h.flush();
    assert.deepEqual(h.screens(root), ['(dashboard)', '+not-found', '_sitemap']);
    assert.equal(h.store.getState().accessToken, 'A-access');
    root.layout();
    assert.deepEqual(h.splash, ['prevent', 'hide']);
    assert.equal(h.store.getState().pushNotificationToken, null);
    assert.equal(h.push.active('response'), 1);
  }
});

test('slow theme restoration holds the splash and first content uses the saved dark theme', async () => {
  const pending = deferred();
  const h = harness({ noBackend: true, readTheme: () => pending.promise });
  const root = h.mount();
  await h.flush();
  assert.equal(h.store.getState().user, null, 'Session startup can finish independently');
  assert.equal(root.tree, null, 'Do not display the default light theme during storage reads');
  assert.deepEqual(h.splash, ['prevent']);
  root.replayEffects();
  root.unmount();
  const remounted = h.mount();
  assert.deepEqual(h.themeStorage, ['read'], 'Root remounts must share the pending theme read');
  pending.resolve(JSON.stringify({ state: { preference: 'dark' }, version: 0 }));
  await h.flush();
  assert.equal(root.lateUpdates, 0);
  assert.equal(findView(remounted.tree).props.style.backgroundColor, '#000');
  assert.deepEqual(h.screens(remounted), ['(auth)', '+not-found', '_sitemap']);
  assert.deepEqual(h.splash, ['prevent']);
  remounted.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

for (const failure of ['corrupt', 'unavailable']) {
  test(`${failure} theme storage releases its gate while session restoration still controls routing`, async () => {
    const h = harness({
      savedTheme: '{invalid',
      ...(failure === 'unavailable' ? { readTheme: async () => { throw new Error('Storage unavailable'); } } : {}),
    });
    const root = h.mount();
    await until(() => h.refreshes.length === 1);
    await h.flush();
    assert.equal(root.tree, null, 'Theme failure must not bypass session restoration');
    assert.deepEqual(h.splash, ['prevent']);
    h.refreshes[0].resolve(response);
    await h.flush();
    assert.equal(findView(root.tree).props.style.backgroundColor, '#fff');
    assert.deepEqual(h.screens(root), ['(dashboard)', '+not-found', '_sitemap']);
    root.layout();
    assert.deepEqual(h.splash, ['prevent', 'hide']);
    assert.ok(h.logs.some(args => args[0].startsWith('Could not restore the theme preference')));
  });
}

test('root navigation theme updates at runtime and restores existing system preference', async () => {
  const h = harness({ noBackend: true, systemScheme: 'dark', savedTheme: JSON.stringify({ state: { preference: 'system' }, version: 0 }) });
  const root = h.mount();
  await h.flush();
  assert.equal(findElement(root.tree, 'ThemeProvider').props.value.colors.background, '#000');
  root.layout();
  h.themeStore.getState().setPreference('light');
  await h.flush();
  assert.equal(findElement(root.tree, 'ThemeProvider').props.value.colors.background, '#fff');
  h.themeStore.getState().setPreference('dark');
  await h.flush();
  assert.equal(findView(root.tree).props.style.backgroundColor, '#000');
  assert.equal(h.restoreCalls, 0);
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
  assert.deepEqual(h.screens(root), ['(dashboard)', '+not-found', '_sitemap']);
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

// Select a request-capable child using the real router state engine and screen
// list filtered by Expo. This tests route availability, not native rendering.
async function protectedProbe(h, root) {
  const names = h.screens(root);
  let requests = 0, state = null;
  if (names.length) {
    state = stackRouter.getRehydratedState({ stale: true, routes: [{ name: '(dashboard)', state: {
      routes: [{ name: '(menu)', state: { routes: [{ name: 'changeEmailPassword' }] } }],
    } }] }, routeConfig(names));
    if (state.routes[state.index].name === '(dashboard)') {
      const observer = new QueryObserver(h.queryClient, {
        queryKey: ['protected-route-probe'], retry: false,
        queryFn: async () => { requests++; return 'private'; },
      });
      const unsubscribe = observer.subscribe(() => {});
      await tick();
      unsubscribe();
    }
  }
  return { requests, state };
}

const authFlows = ['index', 'register', 'forgot-password', 'otp-forgot-password', 'otp-register', 'set-new-password'];
const forcePolicy = { action: 'force', message: 'Please install the required update.', latestVersion: 102, updateUrl: 'https://updates.example.test/app' };

test('cold start without credentials rejects a protected deep link before a private query can start', async () => {
  const h = harness({ saved: null }), root = h.mount();
  assert.equal((await protectedProbe(h, root)).requests, 0);
  await h.flush();
  const probe = await protectedProbe(h, root);
  assert.equal(probe.requests, 0);
  assert.equal(probe.state.routes[probe.state.index].name, '(auth)');
  assert.equal(JSON.stringify(probe.state).includes('changeEmailPassword'), false);
  const auth = h.mount('app/(auth)/_layout.tsx');
  assert.deepEqual(h.screens(auth), authFlows);
  assert.equal(stackRouter.getInitialState(routeConfig(h.screens(auth))).routes[0].name, 'index');
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.mount('app/(dashboard)/_layout.tsx').tree, null);
});

test('saved-session restoration keeps deep-link queries unmounted until fresh credentials are persisted', async () => {
  const h = harness(), root = h.mount();
  await until(() => h.refreshes.length === 1);
  assert.equal((await protectedProbe(h, root)).requests, 0);
  assert.equal(h.mount('app/(dashboard)/_layout.tsx').tree, null);
  h.refreshes[0].resolve(response);
  await h.flush();
  const probe = await protectedProbe(h, root);
  assert.equal(probe.requests, 1);
  assert.equal(h.store.getState().accessToken, 'A-access');
  assert.equal(h.token, 'A-refresh');
  assert.equal(h.restoreCalls, 1);
});

test('an expired in-memory access token cannot bypass the cold-start restoration gate', async () => {
  const h = harness();
  h.store.setState({ user: account.user, accessToken: 'expired-access' });
  const root = h.mount();
  await until(() => h.refreshes.length === 1);
  assert.equal((await protectedProbe(h, root)).requests, 0);
  assert.equal(root.tree, null);
  assert.equal(h.refreshes[0].body.refreshToken, 'saved-refresh');
  h.refreshes[0].resolve(response);
  await h.flush();
  assert.equal(h.store.getState().accessToken, 'A-access');
  assert.equal((await protectedProbe(h, root)).requests, 1);
});

test('transient restoration failure denies private routes and later explicit recovery opens Home', async () => {
  const h = harness(), root = h.mount();
  await until(() => h.refreshes.length === 1);
  h.refreshes[0].reject(new Error('Offline'));
  await h.flush();
  const failed = await protectedProbe(h, root);
  assert.equal(failed.requests, 0);
  assert.equal(failed.state.routes[0].name, '(auth)');
  assert.equal(h.token, 'saved-refresh');
  assert.equal(JSON.parse(h.policy).state, 'allowed');
  const recovery = h.session.restoreSession();
  await until(() => h.refreshes.length === 2);
  h.refreshes[1].resolve(response);
  await recovery; await h.flush();
  const recovered = stackRouter.getStateForRouteNamesChange(failed.state, routeConfig(h.screens(root)));
  assert.equal(recovered.routes[0].name, '(dashboard)');
  assert.equal(recovered.routes[0].state, undefined, 'Do not resume the denied private deep link');
  assert.equal((await protectedProbe(h, root)).requests, 1);
});

for (const flow of authFlows) {
  test(`signed-in navigation to auth/${flow} falls back to dashboard without mounting the auth flow`, async () => {
    const h = harness({ noBackend: true }), root = h.mount();
    await h.flush();
    await h.session.setAuthenticatedSession(account); await h.flush();
    const state = stackRouter.getRehydratedState({ stale: true, routes: [{ name: '(auth)', state: { routes: [{ name: flow }] } }] }, routeConfig(h.screens(root)));
    assert.equal(state.routes[0].name, '(dashboard)');
    assert.equal(JSON.stringify(state).includes(`"name":"${flow}"`), false);
    assert.deepEqual(h.screens(h.mount('app/(auth)/_layout.tsx')), []);
    assert.notEqual(h.mount('app/(dashboard)/_layout.tsx').tree, null);
  });
}

test('a tokenless pending-verification user keeps public OTP access and cannot enter dashboard', async () => {
  const h = harness({ noBackend: true }), root = h.mount();
  await h.flush();
  h.store.setState({ user: { ...account.user, statusCode: 'PENDING_VERIFICATION' }, accessToken: null });
  await h.flush();
  assert.equal((await protectedProbe(h, root)).requests, 0);
  assert.deepEqual(h.screens(h.mount('app/(auth)/_layout.tsx')), authFlows);
  assert.equal(h.mount('app/(dashboard)/_layout.tsx').tree, null);
});

test('a token without a known user never grants layout access', async () => {
  const h = harness({ noBackend: true }), root = h.mount();
  await h.flush();
  for (const user of [undefined, null]) {
    h.store.setState({ user, accessToken: 'unestablished-token' });
    await h.flush();
    assert.equal((await protectedProbe(h, root)).requests, 0);
    assert.equal(h.mount('app/(dashboard)/_layout.tsx').tree, null);
  }
});

test('logout immediately removes protected descendants and their navigation history', async () => {
  const h = harness({ noBackend: true }), root = h.mount();
  await h.flush();
  await h.session.setAuthenticatedSession(account); await h.flush();
  const dashboard = h.mount('app/(dashboard)/_layout.tsx');
  const active = (await protectedProbe(h, root)).state;
  h.queryClient.setQueryData(['private'], 'A-private');
  const logout = h.session.beginSessionLogout();
  const cleanup = h.session.clearSession(logout.generation);
  await h.flush();
  assert.equal(dashboard.tree, null);
  const state = stackRouter.getStateForRouteNamesChange(active, routeConfig(h.screens(root)));
  assert.equal(state.routes[0].name, '(auth)');
  assert.equal(JSON.stringify(state).includes('changeEmailPassword'), false);
  assert.equal(stackRouter.getStateForAction(state, { type: 'NAVIGATE', payload: { name: '(dashboard)' } }, routeConfig(h.screens(root))), null);
  assert.equal((await protectedProbe(h, root)).requests, 0);
  assert.equal(h.queryClient.getQueryData(['private']), undefined);
  await logout.refreshToken; await cleanup;
  assert.equal(h.store.getState().accessToken, null);
});

for (const signedIn of [false, true]) {
  test(`confirmed force policy makes only the update screen accessible (signedIn=${signedIn})`, async () => {
    const h = harness({ noBackend: true }), root = h.mount();
    await h.flush();
    if (signedIn) { await h.session.setAuthenticatedSession(account); await h.flush(); }
    const auth = h.mount('app/(auth)/_layout.tsx');
    const dashboard = h.mount('app/(dashboard)/_layout.tsx');
    let state = stackRouter.getInitialState(routeConfig(h.screens(root)));
    h.setUpdatePolicy(forcePolicy); await h.flush();
    assert.deepEqual(h.screens(root), ['(auth)']);
    assert.deepEqual(h.screens(auth), ['forced-update']);
    assert.equal(dashboard.tree, null);
    assert.equal((await protectedProbe(h, root)).requests, 0);
    state = stackRouter.getStateForRouteNamesChange(state, routeConfig(h.screens(root)));
    assert.equal(state.routes[0].name, '(auth)');
    let authState = stackRouter.getRehydratedState({ stale: true, routes: [{ name: 'register' }] }, routeConfig(h.screens(auth)));
    assert.equal(authState.routes[0].name, 'forced-update');
    const key = authState.routes[0].key;
    for (let i = 0; i < 15; i++) {
      root.render(); auth.render();
      authState = stackRouter.getStateForRouteNamesChange(authState, routeConfig(h.screens(auth)));
      assert.equal(authState.routes[0].key, key, 'Stable state instead of repeated imperative replacement');
      assert.deepEqual(h.screens(auth), ['forced-update']);
    }
    h.setUpdatePolicy(undefined); await h.flush();
    const normal = stackRouter.getStateForRouteNamesChange(state, routeConfig(h.screens(root)));
    assert.equal(normal.routes[0].name, signedIn ? '(dashboard)' : '(auth)');
    if (!signedIn) {
      const cleared = stackRouter.getStateForRouteNamesChange(authState, routeConfig(h.screens(auth)));
      assert.equal(cleared.routes[0].name, 'index');
    }
  });
}

test('force policy during restoration still waits for bootstrap and font readiness', async () => {
  const h = harness(); h.setFonts(false); h.setUpdatePolicy(forcePolicy);
  const root = h.mount();
  await until(() => h.refreshes.length === 1);
  assert.equal(root.tree, null);
  h.refreshes[0].resolve(response); await h.flush();
  assert.equal(root.tree, null);
  h.setFonts(true); root.render();
  assert.deepEqual(h.screens(root), ['(auth)']);
  assert.equal((await protectedProbe(h, root)).requests, 0);
  root.layout();
  assert.deepEqual(h.splash, ['prevent', 'hide']);
});

test('forced-update content reads the root policy without requiring an imperative redirect or trusting link parameters', async () => {
  const h = harness({ noBackend: true, params: { message: 'Link message', latestVersion: '999', updateUrl: 'https://link.example.test' } });
  const root = h.mount(); await h.flush();
  h.setUpdatePolicy(forcePolicy); await h.flush();
  const update = h.mount('app/(auth)/forced-update.tsx');
  const button = findElement(update.tree, 'PrimaryButton');
  assert.equal(button.props.disabled, false);
  button.props.onPress();
  assert.deepEqual(h.links, [forcePolicy.updateUrl]);
  assert.equal(JSON.stringify(update.tree).includes(forcePolicy.message), true);
  assert.equal(JSON.stringify(update.tree).includes('Link message'), false);
  assert.deepEqual(h.screens(root), ['(auth)']);
});

test('soft-update feedback waits for startup readiness and appears once across rerenders', async () => {
  const h = harness({ noBackend: true }); h.setFonts(false);
  h.setUpdatePolicy({ ...forcePolicy, action: 'soft' });
  const root = h.mount(); await h.flush();
  assert.equal(h.toasts.length, 0);
  h.setFonts(true); root.render();
  for (let i = 0; i < 10; i++) { h.setUpdatePolicy({ ...forcePolicy, action: 'soft' }); root.render(); }
  assert.equal(h.toasts.length, 1);
  assert.deepEqual(h.toasts[0], [forcePolicy.message, 'error', true, 'Update', forcePolicy.updateUrl]);
  assert.deepEqual(h.screens(root), ['(auth)', '+not-found', '_sitemap']);
});

test('unavailable or pending version policy never becomes another startup gate', async () => {
  const h = harness({ noBackend: true }), root = h.mount();
  await h.flush();
  assert.deepEqual(h.screens(root), ['(auth)', '+not-found', '_sitemap']);
  await h.session.setAuthenticatedSession(account); await h.flush();
  assert.equal((await protectedProbe(h, root)).requests, 1);
  h.setUpdatePolicy(undefined); await h.flush();
  assert.deepEqual(h.screens(root), ['(dashboard)', '+not-found', '_sitemap']);
});

test('repeated login/logout transitions consistently prune history without repeating restoration', async () => {
  const h = harness({ noBackend: true }), root = h.mount(); await h.flush();
  let state = stackRouter.getInitialState(routeConfig(h.screens(root)));
  for (let i = 0; i < 5; i++) {
    await h.session.setAuthenticatedSession(account); await h.flush();
    state = stackRouter.getStateForRouteNamesChange(state, routeConfig(h.screens(root)));
    assert.equal(state.routes[0].name, '(dashboard)');
    assert.equal(state.routes.length, 1);
    await h.session.clearSession(); await h.flush();
    state = stackRouter.getStateForRouteNamesChange(state, routeConfig(h.screens(root)));
    assert.equal(state.routes[0].name, '(auth)');
    assert.equal(state.routes.length, 1);
    assert.equal((await protectedProbe(h, root)).requests, 0);
  }
  assert.equal(h.restoreCalls, 0);
  assert.equal(h.refreshes.length, 0);
});
