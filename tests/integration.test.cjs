/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

const modules = new Map();
const calls = [];
const state = { accessToken: 'test-access' };
const pdf = new ArrayBuffer(3);
const api = {
  defaults: { baseURL: 'https://api.example.test' },
  request: async config => { calls.push(config); return { data: { traceId: 'upload', code: 'Success', data: null } }; },
  get: async (url, config) => { calls.push({ url, ...config }); return { data: pdf, headers: { 'content-type': 'application/pdf' } }; },
};
class NativeFormData {
  parts = [];
  append(key, value) { this.parts.push([key, value]); }
}
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, URL, URLSearchParams, FormData: NativeFormData,
    process: { env: { EXPO_PUBLIC_BASE_URL: 'https://api.example.test/' } },
    require: id => {
      if (id === 'axios') return axios;
      if (id === '@/services/api') return { __esModule: true, default: api };
      if (id === '@/stores/authStore') return { useAuthStore: { getState: () => state } };
      assert.ok(id.startsWith('@/'));
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, module.exports);
  return module.exports;
}
const transport = load('utility/apiTransport.ts');
const values = load('utility/apiValues.ts');
const permissions = load('utility/permissions.ts');
const errors = load('services/apiError.ts');
const files = load('services/apiFiles.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const failure = (status, data, headers = {}) => new axios.AxiosError('Private native error', 'ERR_BAD_REQUEST', {}, {}, {
  status, data, headers, config: {}, statusText: '',
});

test('API origins are HTTPS and paths never duplicate /api', () => {
  assert.equal(transport.normalizeApiOrigin('https://api.example.test/'), 'https://api.example.test');
  assert.equal(transport.normalizeApiOrigin(undefined), undefined);
  for (const origin of ['http://api.example.test', 'https://api.example.test/api', 'https://user:pass@api.example.test', ' https://api.example.test', 'https://api.example.test?token=test']) {
    assert.throws(() => transport.normalizeApiOrigin(origin));
  }
});

test('queries encode values, repeat array keys, and omit absent filters while retaining zero/false', () => {
  const query = transport.serializeQuery({ search: 'a&b +?', absent: null, omitted: undefined, page: 1, active: false, count: 0, type: ['one', null, 'two'] });
  const parsed = new URLSearchParams(query);
  assert.equal(parsed.get('search'), 'a&b +?');
  assert.equal(parsed.has('absent'), false);
  assert.equal(parsed.has('omitted'), false);
  assert.equal(parsed.get('active'), 'false');
  assert.equal(parsed.get('count'), '0');
  assert.deepEqual(parsed.getAll('type'), ['one', 'two']);
  assert.throws(() => transport.serializeQuery({ id: 9007199254740992 }));
});

test('int64 IDs above 32 bits work, while unsafe numbers are rejected instead of rounded', () => {
  assert.equal(values.requireDatabaseId(4294967296), 4294967296);
  assert.equal(transport.parseApiJson('{"id":4294967296}').id, 4294967296);
  assert.equal(transport.parseApiJson('{"sub":"9223372036854775807"}').sub, '9223372036854775807');
  assert.throws(() => transport.parseApiJson('{"data":[{"id":9223372036854775807}]}'));
  assert.throws(() => values.requireDatabaseId(9007199254740992));
  assert.throws(() => values.requireDatabaseId(1.5));
});

test('page defaults and limits follow the backend without inventing totalCount', () => {
  assert.deepEqual(plain(transport.pageParams()), { page: 1, pageSize: 20 });
  assert.deepEqual(plain(transport.pageParams(1000, 100)), { page: 1000, pageSize: 100 });
  for (const [page, size] of [[0, 20], [1001, 20], [1, 101], [1.5, 20], [1, 0]]) assert.throws(() => transport.pageParams(page, size));
});

test('permission grants normalize scalar/array values and enforce independent cumulative policies', () => {
  const grants = permissions.normalizeGrants({ access_level: 'full', role: 'Member', permission: ['service.manage', 'service.view'] });
  assert.deepEqual(plain(grants.roles), ['Member']);
  assert.equal(permissions.hasPermissions(grants, ['service.manage', 'service.view']), true);
  assert.equal(permissions.hasPermissions(grants, ['service.delete']), false);
  assert.equal(permissions.hasPermissions(permissions.normalizeGrants({ access_level: 'full', permission: 'service.manage' }), ['service.view']), false);
  assert.equal(permissions.hasPermissions(permissions.normalizeGrants({}), []), false);
  assert.equal(permissions.visibilityPermission('service', false), 'service.delete');
  assert.equal(permissions.visibilityPermission('service', true), 'service.manage');
});

test('only full SuperAdmin bypasses permissions; setup requires an explicit endpoint exception', () => {
  const admin = permissions.normalizeGrants({ access_level: 'full', role: ['SuperAdmin'] });
  assert.equal(permissions.isAdministrator(admin), true);
  assert.equal(permissions.hasPermissions(admin, ['inspection.view', 'inspection.manage']), true);
  const setup = permissions.normalizeGrants({ access_level: 'profile_setup', role: 'SuperAdmin' });
  assert.equal(permissions.isAdministrator(setup), false);
  assert.equal(permissions.hasPermissions(setup, ['reference.view']), false);
  assert.equal(permissions.hasPermissions(setup, ['reference.view'], true), true);
});

test('AUD calculations use cents and format amounts as Australian dollars', () => {
  assert.equal(values.audToCents('150.50'), 15050);
  assert.equal(values.centsToAud(values.audToCents('0.10') + values.audToCents('0.20')), 0.3);
  assert.match(values.formatAud('150.50', 'en-AU'), /150\.50/);
  for (const amount of ['0', '-1', '', '1.001', '1e2', '99999999999999999999']) assert.throws(() => values.audToCents(amount));
});

test('timestamps require seconds and an offset and local formatting preserves the instant', () => {
  assert.equal(values.toUtcTimestamp('2030-01-15T10:00:00+11:00'), '2030-01-14T23:00:00.000Z');
  assert.throws(() => values.toUtcTimestamp('2030-01-15T10:00'));
  assert.throws(() => values.toUtcTimestamp('2030-01-15T10:00:00'));
  assert.throws(() => values.toUtcTimestamp('2030-02-30T10:00:00Z'));
  assert.throws(() => values.toUtcTimestamp('2030-01-15T24:00:00Z'));
  assert.match(values.formatLocalTimestamp('2030-01-14T23:00:00Z', 'en-AU', 'Australia/Sydney'), /15 Jan 2030/);
  assert.deepEqual(plain(values.requireCoordinates(-90, 180)), { latitude: -90, longitude: 180 });
  assert.throws(() => values.requireCoordinates(91, 0));
  assert.throws(() => values.requireCoordinates(0, -181));
});

test('Problem Details exposes approved validation fields and prefers header trace IDs', () => {
  const error = failure(400, { code: 'VALIDATION_FAILED', detail: 'Check the form.', traceId: 'body-trace', errors: {
    FirstName: ['Required.'], 'Profile.LastName': ['Too long.'], PasswordTooShort: ['Choose a longer password.'], Invalid: 'not an array',
  } }, { 'Content-Type': 'Application/Problem+Json; charset=utf-8', 'X-Trace-Id': 'header-trace' });
  const info = errors.toAppError(error);
  assert.equal(info.message, 'Check the form.');
  assert.equal(info.traceId, 'header-trace');
  assert.equal(info.code, 'VALIDATION_FAILED');
  const mapped = errors.mapApiValidation(error, ['firstName', 'lastName'], { 'Profile.LastName': 'lastName' });
  assert.deepEqual(plain(mapped.fieldErrors), { firstName: 'Required.', lastName: 'Too long.' });
  assert.deepEqual(plain(mapped.summary), ['Choose a longer password.']);
  assert.equal(Object.hasOwn(info, 'request'), false);
  assert.equal(Object.hasOwn(info, 'config'), false);
});

test('bare/proxy failures and 500 details never expose server internals', () => {
  const bare = failure(401, '');
  delete bare.response.headers;
  assert.equal(errors.toAppError(bare).status, 401);
  for (const [status, data, headers] of [
    [401, '', {}], [403, '<html>private</html>', { 'content-type': 'text/html' }],
    [500, { code: 'SERVER_ERROR', detail: 'private stack trace', traceId: 'support-trace' }, { 'content-type': 'application/problem+json' }],
    [400, { code: 'VALIDATION_FAILED', detail: 'private' }, { 'content-type': 'text/html' }],
  ]) assert.equal(JSON.stringify(errors.toAppError(failure(status, data, headers))).includes('private'), false);
  assert.match(errors.toAppError(failure(404, {})).message, /unavailable/);
  assert.match(errors.toAppError(failure(413, '<html>private</html>')).message, /too large/);
});

test('email delivery failure offers recovery and rate limits preserve optional backoff', () => {
  const info = errors.toAppError(failure(503, { code: 'EMAIL_DELIVERY_FAILED' }, { 'content-type': 'application/problem+json' }));
  assert.match(info.message, /account may already exist/);
  assert.equal(errors.toAppError(failure(429, {}, { 'retry-after': '45' })).retryAfterSeconds, 45);
  assert.equal(errors.toAppError(failure(429, {})).retryAfterSeconds, undefined);
});

const picture = { uri: 'file:///photo.png', name: 'photo.png', mimeType: 'image/png', size: 5 * 1024 * 1024, width: 4000, height: 4000 };
const document = { uri: 'content://document.pdf', name: 'quote.pdf', mimeType: 'application/pdf', size: 10 * 1024 * 1024 };
test('native multipart forms enforce field names, MIME types, sizes, and decoded pixel limits', () => {
  assert.equal(files.pictureForm(picture).parts[0][0], 'picture');
  assert.equal(files.documentForm(document).parts[0][0], 'document');
  for (const changes of [{ size: picture.size + 1 }, { width: 4001 }, { mimeType: 'image/svg+xml' }, { size: 0 }]) assert.throws(() => files.pictureForm({ ...picture, ...changes }));
  assert.throws(() => files.documentForm({ ...document, size: document.size + 1 }));
  assert.throws(() => files.documentForm({ ...document, mimeType: 'text/html' }));
});

test('uploads preserve the full envelope and leave multipart Content-Type to native FormData', async () => {
  const result = await files.uploadApiFile('put', '/api/members/me/profile/picture', files.pictureForm(picture), { headers: { 'Content-Type': 'application/json' }, baseURL: 'https://other.example.test' });
  const call = calls.at(-1);
  assert.equal(call.headers.getContentType(), false);
  assert.equal(call.baseURL, api.defaults.baseURL);
  assert.equal(result.code, 'Success');
  assert.equal(result.data, null);
});

test('public pictures resolve at the API origin and private PDFs return authorized bytes with a safe filename', async () => {
  assert.equal(transport.resolvePublicMediaUrl('/media/profiles/generated.jpg'), 'https://api.example.test/media/profiles/generated.jpg');
  assert.throws(() => transport.resolvePublicMediaUrl('//other.example.test/photo.jpg'));
  assert.throws(() => transport.resolvePublicMediaUrl('/media/profiles/../../api/private'));
  const result = await files.downloadPrivatePdf('/api/quotes/101/document');
  assert.equal(result.data, pdf);
  assert.equal(result.fileName, 'quote.pdf');
  assert.equal(calls.at(-1).responseType, 'arraybuffer');
  await assert.rejects(files.downloadPrivatePdf('https://other.example.test/document'));
  state.accessToken = null;
  await assert.rejects(files.downloadPrivatePdf('/api/quotes/101/document'));
  state.accessToken = 'test-access';
});
