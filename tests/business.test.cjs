// Run with: node --test tests/*.test.cjs
// Guide 05 business details: service contracts, ABN/ACN and coordinate rules, eligibility gates.
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
const apiFiles = {
  pictureForm: file => ({ picture: file.name }),
  uploadApiFile: async (method, url) => { calls.push({ method, url }); return { traceId: 'trace', code: 'Success', data: null }; },
};

const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, encodeURIComponent,
    require: id => {
      if (id === './api') return api;
      if (id === './apiFiles') return apiFiles;
      if (id === 'yup') return require('yup');
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, module.exports);
  return module.exports;
}

const service = load('services/businessService.ts');
const form = load('utility/businessForm.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

const values = (overrides = {}) => ({
  ...form.businessFormValues(null),
  businessName: ' Example Electrical ', abn: '51 824 753 556', streetAddress: '10 Example Street', suburb: 'Sydney',
  regionCode: 'NSW', postalCode: '2000', latitude: '-33.8688', longitude: '151.2093', ...overrides,
});
const body = form.toSaveBusinessRequest(values());

test('own business routes: POST creates, PUT edits, DELETE archives', async () => {
  await service.getMyBusiness();
  await service.createMyBusiness(body);
  await service.updateMyBusiness(body);
  await service.archiveMyBusiness();
  await service.uploadMyBusinessPicture({ name: 'b.jpg' });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/businesses/me', 'post /api/businesses/me', 'put /api/businesses/me', 'delete /api/businesses/me', 'put /api/businesses/me/picture',
  ]);
  assert.deepEqual(plain(calls[1].body), plain(body));
});

test('admin routes use stable IDs; the user filter is omitted when absent', async () => {
  await service.adminListBusinesses();
  await service.adminListBusinesses({ userId: 41 });
  await service.adminGetBusiness(7);
  await service.adminCreateBusinessForUser(41, body);
  await service.adminUpdateBusiness(7, body);
  await service.adminArchiveBusiness(7);
  await service.adminGetBusinessHistory(7);
  await service.adminUploadBusinessPicture(7, { name: 'b.jpg' });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/businesses', 'get /api/admin/businesses', 'get /api/admin/businesses/7', 'post /api/admin/businesses/users/41',
    'put /api/admin/businesses/7', 'delete /api/admin/businesses/7', 'get /api/admin/businesses/7/history', 'put /api/admin/businesses/7/picture',
  ]);
  assert.deepEqual(plain(calls[0].params), {});
  assert.deepEqual(plain(calls[1].params), { userId: 41 });
  assert.throws(() => service.adminGetBusiness(0), /database ID/);
});

test('coordinates are required numbers in range; zero is valid', async () => {
  assert.throws(() => service.createMyBusiness({ ...body, latitude: 91 }), /outside its valid range/);
  assert.throws(() => service.updateMyBusiness({ ...body, longitude: Number.NaN }), /outside its valid range/);
  assert.equal(calls.length, 0);
  const zero = form.toSaveBusinessRequest(values({ latitude: '0', longitude: '0' }));
  assert.equal(zero.latitude, 0);
  assert.equal(zero.longitude, 0);
  assert.equal(await form.businessSchema.isValid(values({ latitude: '0', longitude: '0' })), true);
  assert.equal(await form.businessSchema.isValid(values({ latitude: '' })), false, 'Missing coordinates');
  assert.equal(await form.businessSchema.isValid(values({ longitude: '181' })), false);
  assert.equal(await form.businessSchema.isValid(values({ latitude: 'north' })), false);
});

test('ABN and ACN checksums; spaces are removed before sending', async () => {
  assert.equal(form.isValidAbn('51 824 753 556'), true);
  assert.equal(form.isValidAbn('51824753557'), false);
  assert.equal(form.isValidAbn('5182475355'), false);
  assert.equal(form.isValidAcn('004 085 616'), true);
  assert.equal(form.isValidAcn('004085617'), false);
  assert.equal(await form.businessSchema.isValid(values({ abn: '12345678901' })), false);
  assert.equal(await form.businessSchema.isValid(values({ acn: '123' })), false);
  assert.equal(await form.businessSchema.isValid(values({ acn: '004 085 616' })), true);
  assert.equal(await form.businessSchema.isValid(values()), true, 'ACN is optional');
  const request = plain(form.toSaveBusinessRequest(values({ acn: '004 085 616' })));
  assert.equal(request.abn, '51824753556');
  assert.equal(request.acn, '004085616');
  assert.equal(request.businessName, 'Example Electrical');
  assert.equal(body.acn, null);
  assert.equal(body.phone, null);
  assert.equal(form.formatRegistrationNumber('51824753556'), '51 824 753 556');
  assert.equal(form.formatRegistrationNumber('004085616'), '004 085 616');
});

test('saved values reload, including coordinates of zero', () => {
  const saved = { ...body, id: 1, latitude: 0, longitude: -0.5, createdAtUtc: '', updatedAtUtc: '' };
  const reloaded = plain(form.businessFormValues(saved));
  assert.equal(reloaded.latitude, '0');
  assert.equal(reloaded.longitude, '-0.5');
  assert.equal(reloaded.acn, '');
});

const user = (permissions, accessLevel = 'full', roles = []) => ({
  id: '1', accessLevel, roles, permissions, profileCompletionRequired: accessLevel === 'profile_setup',
});

test('eligibility: business types plus each operation permission; no setup exception', () => {
  const all = user(['businesses.view', 'businesses.manage', 'businesses.delete']);
  for (const type of ['tradeperson', 'builder', 'developer']) assert.equal(access.canViewOwnBusiness(all, type), true);
  for (const type of ['individual', 'public_government_sector', null]) {
    assert.equal(access.canViewOwnBusiness(all, type), false, 'A type alone is not access, nor permission alone');
  }
  const viewOnly = user(['businesses.view']);
  assert.equal(access.canViewOwnBusiness(viewOnly, 'builder'), true);
  assert.equal(access.canManageOwnBusiness(viewOnly, 'builder'), false, 'Read-only permission');
  assert.equal(access.canArchiveOwnBusiness(user(['businesses.manage']), 'builder'), false);
  assert.equal(access.canViewOwnBusiness(user(['businesses.view'], 'profile_setup'), 'builder'), false);
  assert.equal(access.canManageBusinessesAsAdmin(all), false);
  assert.equal(access.canManageBusinessesAsAdmin(user([], 'full', ['SuperAdmin'])), true);
});
