// Run with: node --test tests/*.test.cjs
// Code paste parsing, remembered sign-in after verification, the pending profile picture and
// the push "why isn't it on" messages.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const stubs = {
  zustand: require('zustand'),
  react: { useRef: () => ({ current: null }), useState: value => [value, () => {}] },
  'react-native': { Platform: { OS: 'android' }, Pressable: 'Pressable', StyleSheet: { create: styles => styles, absoluteFill: {} }, TextInput: 'TextInput', View: 'View' },
};

const modules = new Map();
function load(file, extra = {}) {
  if (modules.has(file)) return modules.get(file);
  const sandbox = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module: sandbox, exports: sandbox.exports,
    require: id => {
      if (id in extra) return extra[id];
      if (id in stubs) return stubs[id];
      if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' };
      if (id.startsWith('@/components/') || id.startsWith('@/hooks/') || id.startsWith('@/constants/')) return new Proxy({}, { get: () => () => null });
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, sandbox.exports);
  return sandbox.exports;
}

test('pasted codes keep only digits and at most six', () => {
  const { toCode } = load('components/ui/CodeInput.tsx');
  assert.equal(toCode('123456'), '123456');
  assert.equal(toCode('123 456'), '123456', 'Spaces from email formatting');
  assert.equal(toCode('Your code: 012345.'), '012345', 'Leading zero kept');
  assert.equal(toCode('1234567890'), '123456');
  assert.equal(toCode('ab'), '');
  assert.equal(toCode('98', 4), '98');
});

test('remembered sign-in: only for the same email, used once', () => {
  const store = load('stores/pendingSignInStore.ts');
  store.usePendingSignInStore.getState().set('New@Example.test', 'secret');
  assert.equal(store.takePendingSignIn('other@example.test'), null, 'Another email never gets it');
  assert.equal(store.takePendingSignIn('new@example.test'), null, 'A failed match also clears it');
  store.usePendingSignInStore.getState().set('new@example.test', 'secret');
  assert.deepEqual(JSON.parse(JSON.stringify(store.takePendingSignIn(' NEW@example.test '))), { email: 'new@example.test', password: 'secret' });
  assert.equal(store.takePendingSignIn('new@example.test'), null, 'Taken once');
});

test('a picture chosen before the profile exists is held until it is saved', () => {
  const { usePendingProfilePictureStore } = load('stores/pendingProfilePictureStore.ts');
  const file = { uri: 'file:///photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg', size: 1000, width: 100, height: 100 };
  usePendingProfilePictureStore.getState().set(file);
  assert.equal(usePendingProfilePictureStore.getState().file.uri, 'file:///photo.jpg');
  usePendingProfilePictureStore.getState().clear();
  assert.equal(usePendingProfilePictureStore.getState().file, null);
});

test('push: the switch only reports success when the phone is really registered', () => {
  const { useNotificationStore } = load('stores/notificationStore.ts');
  const registration = load('services/pushRegistration.ts', {
    '@/services/notificationService': {},
    '@/services/pushNotifications': { refreshPushToken: async () => null },
    '@/utility/installationId': { getInstallationId: async () => 'id' },
    '@/stores/authStore': { useAuthStore: { getState: () => ({}), subscribe: () => () => {} }, selectIsAuthenticated: () => false },
    '@/stores/notificationStore': { useNotificationStore },
    '@/utility/access': { canRegisterPushInstallation: () => true, canUnregisterPushInstallation: () => true },
    'expo-secure-store': {},
    axios: { isAxiosError: () => false },
  });
  const reason = state => { useNotificationStore.setState(state); return registration.pushUnavailableReason(); };
  assert.equal(reason({ registration: 'registered', tokenStatus: 'available' }), null);
  assert.match(reason({ registration: 'idle', tokenStatus: 'unavailable' }), /Expo Go/);
  assert.match(reason({ registration: 'idle', tokenStatus: 'denied' }), /blocked/);
  assert.match(reason({ registration: 'refused', tokenStatus: 'available' }), /another account/);
  assert.match(reason({ registration: 'error', tokenStatus: 'available' }), /couldn't be turned on/);
});
