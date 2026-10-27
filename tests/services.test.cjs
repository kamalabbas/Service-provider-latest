// Run with: node --test tests/*.test.cjs
// Guide 07 services and discovery: routes, search parameters, listing rules and gates.
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
      if (id === 'yup') return require('yup');
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, module.exports);
  return module.exports;
}

const service = load('services/serviceListingService.ts');
const form = load('utility/serviceForm.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

const values = (overrides = {}) => ({
  title: ' Switchboard upgrades ', description: 'Upgrades and repairs.', occupationCode: 'electrical_services',
  suburb: 'Sydney', regionCode: 'NSW', latitude: '-33.8688', longitude: '151.2093', ...overrides,
});
const body = form.toSaveServiceRequest(values());

test('own listing routes: list, detail, create, edit, archive', async () => {
  await service.getMyServices();
  await service.getMyService(7);
  await service.createMyService(body);
  await service.updateMyService(7, body);
  await service.archiveMyService(7);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/services/me', 'get /api/services/me/7', 'post /api/services/me', 'put /api/services/me/7', 'delete /api/services/me/7',
  ]);
  assert.equal(plain(calls[2].body).title, 'Switchboard upgrades');
  assert.throws(() => service.updateMyService(0, body), /database ID/);
});

test('discovery detail and admin routes use stable IDs', async () => {
  await service.getDiscoveredService(7);
  await service.adminListUserServices(41);
  await service.adminCreateUserService(41, body);
  await service.adminGetService(7);
  await service.adminUpdateService(7, body);
  await service.adminArchiveService(7);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/services/7', 'get /api/admin/services/users/41', 'post /api/admin/services/users/41',
    'get /api/admin/services/7', 'put /api/admin/services/7', 'delete /api/admin/services/7',
  ]);
});

test('search: location required, zero allowed, empty filters omitted, both filters applied', async () => {
  await service.searchServices({ latitude: 0, longitude: 0 });
  assert.deepEqual(plain(calls[0].params), { latitude: 0, longitude: 0, page: 1, pageSize: 20 });
  await service.searchServices({ latitude: -33.8, longitude: 151.2, radiusKm: 25, membershipId: ' T100000 ', occupationCode: 'electrical_services' }, 3, 20);
  assert.deepEqual(plain(calls[1].params), {
    latitude: -33.8, longitude: 151.2, radiusKm: 25, membershipId: 'T100000', occupationCode: 'electrical_services', page: 3, pageSize: 20,
  });
  assert.deepEqual(plain(service.searchParams({ latitude: 1, longitude: 1, membershipId: '  ', occupationCode: '' })),
    { latitude: 1, longitude: 1, page: 1, pageSize: 20 });
  assert.throws(() => service.searchParams({ latitude: 1, longitude: 1, radiusKm: 0.5 }), /1–500/);
  assert.throws(() => service.searchParams({ latitude: 1, longitude: 1, radiusKm: 501 }), /1–500/);
  assert.throws(() => service.searchParams({ latitude: Number.NaN, longitude: 1 }), /outside its valid range/);
  assert.throws(() => service.searchParams({ latitude: 1, longitude: 1 }, 1001), /Page/);
});

test('listing form: required fields, own coordinates, business prefill without write-back', async () => {
  assert.equal(await form.serviceSchema.isValid(values()), true);
  assert.equal(await form.serviceSchema.isValid(values({ latitude: '0', longitude: '0' })), true);
  assert.equal(await form.serviceSchema.isValid(values({ latitude: '' })), false);
  assert.equal(await form.serviceSchema.isValid(values({ title: 'x'.repeat(121) })), false);
  assert.equal(await form.serviceSchema.isValid(values({ occupationCode: '' })), false);
  assert.throws(() => service.createMyService({ ...body, longitude: 200 }), /outside its valid range/);

  const business = { suburb: 'Parramatta', regionCode: 'NSW', latitude: 0, longitude: 150.5 };
  const prefilled = plain(form.serviceFormValues(null, business));
  assert.deepEqual([prefilled.suburb, prefilled.latitude, prefilled.longitude], ['Parramatta', '0', '150.5']);
  const listing = { ...body, id: 7, occupationName: 'Electrical', archivedAtUtc: null, createdAtUtc: '', updatedAtUtc: '' };
  assert.equal(form.serviceFormValues(listing, business).suburb, 'Sydney', 'A saved listing keeps its own location');
});

test('occupations: a Tradeperson is limited to profile occupations; others may choose any', () => {
  assert.deepEqual(plain(form.allowedOccupationCodes('tradeperson', ['electrical_services'])), ['electrical_services']);
  assert.deepEqual(plain(form.allowedOccupationCodes('tradeperson', [])), []);
  assert.equal(form.allowedOccupationCodes('builder', []), null);
  assert.equal(form.allowedOccupationCodes('developer', ['x']), null);
});

test('ratings and distance text: null average means no ratings', () => {
  assert.equal(form.ratingText(null, 0), 'No ratings yet');
  assert.equal(form.ratingText(4.25, 1), '4.3 ★ (1 rating)');
  assert.equal(form.ratingText(5, 12), '5.0 ★ (12 ratings)');
  assert.equal(form.distanceText(null), null);
  assert.equal(form.distanceText(0.4), 'Under 1 km away');
  assert.equal(form.distanceText(3.26), 'About 3.3 km away');
  assert.equal(form.distanceText(42.6), 'About 43 km away');
});

const user = (permissions, accessLevel = 'full', roles = []) => ({
  id: '1', accessLevel, roles, permissions, profileCompletionRequired: accessLevel === 'profile_setup',
});

test('gates: view, publish by eligible type, archive, inspection availability', () => {
  assert.equal(access.canViewServices(user(['services.view'])), true);
  assert.equal(access.canViewServices(user([])), false);
  assert.equal(access.canViewServices(user(['services.view'], 'profile_setup')), false);
  const manager = user(['services.view', 'services.manage', 'services.delete']);
  assert.equal(access.canManageOwnServices(manager, 'builder'), true);
  assert.equal(access.canManageOwnServices(manager, 'individual'), false);
  assert.equal(access.canManageOwnServices(user(['services.view']), 'builder'), false);
  assert.equal(access.canArchiveOwnServices(user(['services.manage']), 'builder'), false);
  const available = { canRequestInspection: true };
  assert.equal(access.canRequestInspectionFor(user(['inspections.manage']), available), true);
  assert.equal(access.canRequestInspectionFor(user([]), available), false, 'Advisory flag alone is not enough');
  assert.equal(access.canRequestInspectionFor(user(['inspections.manage']), { canRequestInspection: false }), false);
});
