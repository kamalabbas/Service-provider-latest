// Run with: node --test tests/*.test.cjs
// Exercise the installed Zustand middleware and real theme modules. Device and
// browser storage boundaries are deterministic substitutes, not native devices.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const compiled = new Map();
const tick = () => new Promise(resolve => setImmediate(resolve));
const saved = preference => JSON.stringify({ state: { preference }, version: 0 });

function harness(platform, options = {}) {
  const values = options.values ?? new Map();
  const calls = [], warnings = [], modules = new Map();
  let scheme = 'light';
  const read = name => {
    calls.push(['read', name]);
    if (options.readError) throw new Error('Storage unavailable');
    return values.get(name) ?? null;
  };
  const write = (name, value) => {
    calls.push(['write', name, value]);
    if (options.write) return options.write(name, value, values);
    values.set(name, value);
  };
  const remove = name => {
    calls.push(['remove', name]);
    if (options.removeError) throw new Error('Storage unavailable');
    values.delete(name);
  };
  const external = {
    zustand: require('zustand'),
    'zustand/middleware': require('zustand/middleware'),
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { Platform: { OS: platform }, Text: 'Text', View: 'View', StyleSheet: { create: styles => styles } },
    'expo-secure-store': {
      getItemAsync: async name => read(name),
      setItemAsync: async (name, value) => write(name, value),
      deleteItemAsync: async name => remove(name),
    },
    '@/hooks/useColorScheme': { useColorScheme: () => scheme },
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText);
    const module = { exports: {} };
    modules.set(file, module);
    const context = {
      module, exports: module.exports, Promise,
      console: { warn: message => warnings.push(message), error: message => warnings.push(message) },
      require: id => {
        if (id === '@/stores/theme') {
          const theme = load('stores/theme.ts');
          return { ...theme, useThemeStore: select => select(theme.useThemeStore.getState()) };
        }
        if (Object.hasOwn(external, id)) return external[id];
        assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
        return load(`${id.slice(2)}.ts`);
      },
    };
    if (platform === 'web' && !options.noStorage) {
      Object.defineProperty(context, 'localStorage', { get: () => {
        if (options.storageGetterError) throw new Error('Browser storage denied');
        return { getItem: read, setItem: write, removeItem: remove };
      } });
    }
    vm.runInNewContext(compiled.get(file), context, { filename: file });
    return module.exports;
  }
  const { useThemeStore: store, initializeTheme } = load('stores/theme.ts');
  return { store, initializeTheme, values, calls, warnings, load, setScheme: value => { scheme = value; } };
}

for (const platform of ['android', 'ios', 'web']) {
  test(`${platform}: first launch retains light and does not write a default over storage`, async () => {
    const h = harness(platform);
    assert.deepEqual(h.calls, [], 'Module loading must be safe for static rendering');
    const first = h.initializeTheme();
    assert.equal(h.initializeTheme(), first, 'Repeated initialization must share restoration');
    await first;
    assert.equal(h.store.getState().preference, 'light');
    assert.deepEqual(h.calls, [['read', 'theme-preference']]);
    assert.deepEqual(h.warnings, []);
  });

  for (const preference of ['dark', 'system', 'light']) {
    test(`${platform}: ${preference} updates immediately and survives a fresh app runtime`, async () => {
      const h = harness(platform);
      await h.initializeTheme();
      h.store.getState().setPreference(preference);
      assert.equal(h.store.getState().preference, preference);
      if (platform === 'web') assert.equal(h.values.get('theme-preference'), saved(preference), 'Web saves synchronously');
      await tick();
      assert.equal(h.values.get('theme-preference'), saved(preference));
      const restarted = harness(platform, { values: h.values });
      await restarted.initializeTheme();
      assert.equal(restarted.store.getState().preference, preference);
      assert.deepEqual(restarted.calls, [['read', 'theme-preference']]);
    });
  }

  for (const payload of ['{broken', 'null', '{}', '[]', 'true', '42', '"dark"',
    JSON.stringify({ state: null, version: 0 }), saved('invalid'), saved(null),
    JSON.stringify({ state: { preference: 'dark', setPreference: 'invalid' }, version: 0 })]) {
    test(`${platform}: safely handles stored ${payload}`, async () => {
      const h = harness(platform, { values: new Map([['theme-preference', payload]]) });
      await h.initializeTheme();
      const validDark = payload.includes('setPreference');
      assert.equal(h.store.getState().preference, validDark ? 'dark' : 'light');
      assert.equal(typeof h.store.getState().setPreference, 'function');
      assert.equal(h.values.get('theme-preference'), payload, 'Restoration must not write fallback state');
      h.store.getState().setPreference('system');
      await tick();
      const restarted = harness(platform, { values: h.values });
      await restarted.initializeTheme();
      assert.equal(restarted.store.getState().preference, 'system', 'A later choice repairs invalid data');
    });
  }

  test(`${platform}: failed reads settle and failed writes preserve runtime changes`, async () => {
    const h = harness(platform, { readError: true, write: () => { throw new Error('Write unavailable'); } });
    await h.initializeTheme();
    assert.equal(h.store.getState().preference, 'light');
    h.store.getState().setPreference('dark');
    assert.equal(h.store.getState().preference, 'dark');
    await tick();
    assert.equal(h.warnings.length, 2);
  });

  test(`${platform}: shared components honor runtime choices, system changes, and color overrides`, async () => {
    const h = harness(platform);
    await h.initializeTheme();
    const { useThemeColor } = h.load('hooks/useThemeColor.ts');
    const { ThemedText } = h.load('components/ThemedText.tsx');
    const { ThemedView } = h.load('components/ThemedView.tsx');
    const { Colors } = h.load('constants/Colors.ts');
    h.setScheme('dark');
    assert.equal(useThemeColor({}, 'background'), Colors.light.background, 'Explicit light ignores system dark');
    h.store.getState().setPreference('dark');
    h.setScheme('light');
    assert.equal(ThemedView({}).props.style[0].backgroundColor, Colors.dark.background);
    assert.equal(ThemedText({}).props.style[0].color, Colors.dark.text);
    assert.equal(useThemeColor({ dark: '#123456' }, 'text'), '#123456');
    h.store.getState().setPreference('system');
    assert.equal(useThemeColor({}, 'text'), Colors.light.text);
    h.setScheme('dark');
    assert.equal(useThemeColor({}, 'text'), Colors.dark.text);
    h.setScheme(null);
    assert.equal(useThemeColor({}, 'text'), Colors.light.text);
    await tick();
  });
}

for (const options of [{ noStorage: true }, { storageGetterError: true }]) {
  test(`web: ${Object.keys(options)[0]} does not block initialization or runtime themes`, async () => {
    const h = harness('web', options);
    await h.initializeTheme();
    h.store.getState().setPreference('dark');
    assert.equal(h.store.getState().preference, 'dark');
    assert.equal(h.warnings.length, 2);
  });
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: rapid native writes stay ordered and recover after rejection`, async () => {
    let rejectFirst;
    const pending = new Promise((_resolve, reject) => { rejectFirst = reject; });
    let writes = 0;
    const h = harness(platform, { write: (name, value, values) => {
      if (++writes === 1) return pending;
      values.set(name, value);
    } });
    await h.initializeTheme();
    h.store.getState().setPreference('dark');
    h.store.getState().setPreference('light');
    h.store.getState().setPreference('system');
    await tick();
    assert.equal(writes, 1, 'A pending write must finish before the next begins');
    assert.equal(h.store.getState().preference, 'system');
    rejectFirst(new Error('Native write failed'));
    await tick();
    assert.equal(writes, 3);
    const restarted = harness(platform, { values: h.values });
    await restarted.initializeTheme();
    assert.equal(restarted.store.getState().preference, 'system');
    assert.equal(h.warnings.length, 1);
  });
}
