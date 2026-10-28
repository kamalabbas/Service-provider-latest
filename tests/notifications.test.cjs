// Run with: node --test tests/*.test.cjs
// Guide 17: push installation routes and registration lifecycle, issue-report redaction and size.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const calls = [];
const record = method => async (url, ...rest) => {
  const withBody = method === 'post' || method === 'put';
  calls.push({ method, url, body: withBody ? rest[0] : undefined, params: withBody ? undefined : rest[0]?.params });
  return { traceId: 'trace', code: 'Success', data: null };
};
const api = { getData: record('get'), postData: record('post'), putData: record('put'), deleteData: record('delete') };

// Device and registration boundaries for services/pushRegistration.ts.
const registrations = [];
let registerFailure = null;
const secure = new Map();
const stubs = {
  '@/services/notificationService': {
    registerPushInstallation: async body => {
      registrations.push(body);
      if (registerFailure) throw registerFailure;
      return { data: body };
    },
    unregisterPushInstallation: async id => { registrations.push({ unregister: id }); },
  },
  '@/services/pushNotifications': { refreshPushToken: async () => null },
  '@/utility/installationId': { getInstallationId: async () => '0f8c3c2a-1b2c-4d3e-8f4a-5b6c7d8e9f00' },
  'expo-secure-store': {
    getItemAsync: async key => secure.get(key) ?? null,
    setItemAsync: async (key, value) => { secure.set(key, value); },
    deleteItemAsync: async key => { secure.delete(key); },
  },
  'react-native': { Platform: { OS: 'android' } },
  axios: { isAxiosError: error => Boolean(error?.isAxiosError) },
  zustand: require('zustand'),
  '@tanstack/react-query': require('@tanstack/react-query'),
};

const modules = new Map();
function load(file, overrides = {}) {
  if (modules.has(file)) return modules.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, encodeURIComponent, Promise,
    require: id => {
      if (id in overrides) return overrides[id];
      if (id === './api') return api;
      if (id in stubs && file.startsWith('services/pushRegistration')) return stubs[id];
      if (id === 'zustand' || id === '@tanstack/react-query') return stubs[id];
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, module.exports);
  return module.exports;
}

const service = load('services/notificationService.ts');
const reports = load('utility/issueReport.ts');
const access = load('utility/access.ts');
const registration = load('services/pushRegistration.ts');
const { useAuthStore } = load('stores/authStore.ts');
const { useNotificationStore } = load('stores/notificationStore.ts');
const plain = value => JSON.parse(JSON.stringify(value));

const ID = '0f8c3c2a-1b2c-4d3e-8f4a-5b6c7d8e9f00';
test.beforeEach(() => {
  calls.length = 0;
  registrations.length = 0;
  registerFailure = null;
  secure.clear();
});

test('installation routes: real Expo tokens only, iOS/Android only, UUID installation IDs', async () => {
  await service.registerPushInstallation({ installationId: ID, platform: 'ios', expoPushToken: 'ExponentPushToken[abc]' });
  await service.unregisterPushInstallation(ID);
  await service.listMyPushInstallations();
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'post /api/notifications/installations', `delete /api/notifications/installations/${ID}`, 'get /api/notifications/installations/me',
  ]);
  assert.deepEqual(plain(calls[0].body), { installationId: ID, platform: 'ios', expoPushToken: 'ExponentPushToken[abc]' });
  assert.throws(() => service.registerPushInstallation({ installationId: ID, platform: 'web', expoPushToken: 'ExpoPushToken[a]' }), /iOS and Android/);
  assert.throws(() => service.registerPushInstallation({ installationId: ID, platform: 'ios', expoPushToken: 'fake-token' }), /real Expo push token/);
  assert.throws(() => service.registerPushInstallation({ installationId: 'not-a-uuid', platform: 'ios', expoPushToken: 'ExpoPushToken[a]' }), /installation ID/);
  assert.throws(() => service.unregisterPushInstallation('../x'), /installation ID/);
});

test('issue reports: redacted, trimmed and within 8192 bytes; admin routes', async () => {
  const body = reports.buildIssueReport({
    platform: 'android', appVersion: '1.0.1', attemptedAction: ' Sign in ',
    errorMessage: 'Failed with Bearer abc.def.ghi for me@example.com, code 123456, password=hunter2',
    context: 'token: eyJhbGciOi.eyJzdWIi.c2lnbmF0dXJl and ExpoPushToken[xyz]', clientTraceId: '00-abc123-01',
  });
  assert.equal(body.attemptedAction, 'Sign in');
  assert.doesNotMatch(body.errorMessage, /hunter2|me@example\.com|123456|abc\.def\.ghi/);
  assert.match(body.errorMessage, /\[email\]/);
  assert.match(body.errorMessage, /\[code\]/);
  assert.doesNotMatch(body.context, /eyJ|xyz/);
  assert.equal(body.clientTraceId, '00-abc123-01');
  assert.equal(reports.buildIssueReport({ ...body, clientTraceId: 'bad id with spaces' }).clientTraceId, null);
  assert.throws(() => reports.buildIssueReport({ ...body, errorMessage: '  ' }), /what went wrong/);

  const huge = reports.buildIssueReport({ ...body, errorMessage: 'é'.repeat(2000), context: '漢'.repeat(4000) });
  assert.ok(reports.utf8Length(JSON.stringify(huge)) <= reports.ISSUE_REPORT_MAX_BYTES, 'Fits the total byte limit');
  assert.equal(reports.utf8Length('é漢😀'), 2 + 3 + 4);

  await service.submitIssueReport(body);
  await service.adminListIssueReports('new');
  await service.adminGetIssueReport(3);
  await service.adminGetIssueReportHistory(3);
  await service.adminChangeIssueReportStatus(3, { status: 'resolved', note: ' Fixed ' });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'post /api/issue-reports', 'get /api/admin/issue-reports', 'get /api/admin/issue-reports/3',
    'get /api/admin/issue-reports/3/history', 'post /api/admin/issue-reports/3/status',
  ]);
  assert.equal(calls[0].body.reporterUserId, undefined, 'No invented reporter ID');
  assert.deepEqual(plain(calls[4].body), { status: 'resolved', note: 'Fixed' });
  assert.throws(() => service.adminChangeIssueReportStatus(3, { status: 'new', note: 'x'.repeat(1001) }), /1000/);
});

const user = (id, accessLevel = 'full', permissions = ['notifications.view', 'notifications.manage', 'notifications.delete']) =>
  ({ id, accessLevel, roles: [], permissions, profileCompletionRequired: accessLevel === 'profile_setup', email: 'a@b.c' });
const signIn = (account, token = 'ExpoPushToken[one]') =>
  useAuthStore.setState({ accessToken: 'access', user: account, pushNotificationToken: token });

test('registration: once per account and token; re-registers on rotation and new sign-in', async () => {
  signIn(user('1'));
  await registration.syncPushRegistration();
  await registration.syncPushRegistration();
  assert.deepEqual(plain(registrations), [{ installationId: ID, platform: 'android', expoPushToken: 'ExpoPushToken[one]' }]);
  assert.equal(useNotificationStore.getState().registration, 'registered');

  useAuthStore.setState({ pushNotificationToken: 'ExpoPushToken[two]' });
  await registration.syncPushRegistration();
  assert.equal(registrations.length, 2, 'Token rotation');

  useAuthStore.setState({ accessToken: null, user: null });
  await registration.syncPushRegistration();
  assert.equal(useNotificationStore.getState().registration, 'idle');
  signIn(user('1'), 'ExpoPushToken[two]');
  await registration.syncPushRegistration();
  assert.equal(registrations.length, 3, 'A new sign-in restores the destination');
});

test('registration: setup sessions allowed; refused tokens are not retried; no token, no request', async () => {
  signIn(user('2', 'profile_setup', []), null);
  await registration.syncPushRegistration();
  assert.equal(registrations.length, 0, 'Never fabricate a token');

  signIn(user('2', 'profile_setup', []));
  await registration.syncPushRegistration();
  assert.equal(registrations.length, 1, 'Setup sessions may register');

  registerFailure = { isAxiosError: true, response: { status: 409 } };
  signIn(user('3'), 'ExpoPushToken[owned-elsewhere]');
  await registration.syncPushRegistration();
  await registration.syncPushRegistration();
  assert.equal(registrations.length, 2, 'Refused once, not repeated');
  assert.equal(useNotificationStore.getState().registration, 'refused');

  signIn(user('4', 'full', ['notifications.view']), 'ExpoPushToken[no-permission]');
  await registration.syncPushRegistration();
  assert.equal(registrations.length, 2, 'Needs notifications.manage');
});

test('disable unregisters this installation and stays off until enabled again', async () => {
  registerFailure = null;
  signIn(user('5'), 'ExpoPushToken[five]');
  await registration.syncPushRegistration();
  await registration.disablePushOnThisDevice();
  assert.deepEqual(plain(registrations.at(-1)), { unregister: ID });
  assert.equal(useNotificationStore.getState().registration, 'disabled');
  const before = registrations.length;
  useAuthStore.setState({ pushNotificationToken: 'ExpoPushToken[five-rotated]' });
  await registration.syncPushRegistration();
  assert.equal(registrations.length, before, 'Disabled survives token rotation');
  await registration.enablePushOnThisDevice();
  assert.equal(registrations.length, before + 1);
  assert.equal(useNotificationStore.getState().registration, 'registered');
  assert.equal(access.canInvestigateIssueReports(user('5')), false);
  assert.equal(access.canRegisterPushInstallation(user('5', 'profile_setup', [])), true);
});
