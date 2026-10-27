// Run with: node --test tests/*.test.cjs
// Guide 06 reference choices: service paths, retired-choice options and access gates.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const calls = [];
const record = method => async (url, ...rest) => {
  calls.push({ method, url, body: method === 'get' || method === 'delete' ? undefined : rest[0] });
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
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, module.exports);
  return module.exports;
}

const service = load('services/referenceService.ts');
const { referenceOptions, referenceLabel } = load('utility/referenceOptions.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

test('member catalogues use their exact API path segments', async () => {
  for (const catalogue of ['regions', 'occupations', 'employee-positions', 'licence-types']) {
    await service.getReferenceChoices(catalogue);
  }
  assert.deepEqual(calls.map(call => call.url), [
    '/api/members/regions', '/api/members/occupations', '/api/members/employee-positions', '/api/members/licence-types',
  ]);
  assert.throws(() => service.getReferenceChoices('countries'), /Unknown reference catalogue/);
});

test('management routes send the documented methods, paths and bodies', async () => {
  await service.adminListReferenceChoices('occupations');
  await service.adminCreateReferenceChoice('occupations', { code: 'solar_installer', displayName: 'Solar installer', displayOrder: 10 });
  await service.adminUpdateReferenceChoice('occupations', 'solar_installer', { displayName: 'Solar installation', displayOrder: 11 });
  await service.adminRetireReferenceChoice('occupations', 'solar_installer');
  await service.adminReactivateReferenceChoice('regions', 'NSW');
  assert.deepEqual(plain(calls), [
    { method: 'get', url: '/api/admin/reference-choices/occupations' },
    { method: 'post', url: '/api/admin/reference-choices/occupations', body: { code: 'solar_installer', displayName: 'Solar installer', displayOrder: 10 } },
    { method: 'put', url: '/api/admin/reference-choices/occupations/solar_installer', body: { displayName: 'Solar installation', displayOrder: 11 } },
    { method: 'delete', url: '/api/admin/reference-choices/occupations/solar_installer' },
    { method: 'post', url: '/api/admin/reference-choices/regions/NSW/reactivate' },
  ]);
});

test('new non-region codes follow the immutable code format', () => {
  for (const code of ['Solar', '1st_aid', 'a', 'has space', 'x'.repeat(81)]) {
    assert.throws(() => service.adminCreateReferenceChoice('employee-positions', { code, displayName: 'X', displayOrder: 0 }), /lowercase/);
  }
  assert.equal(service.REFERENCE_CODE_PATTERN.test('site_supervisor'), true);
  assert.equal(calls.length, 0);
});

test('path codes are encoded and must be present', async () => {
  await service.adminRetireReferenceChoice('licence-types', 'a/b');
  assert.equal(calls[0].url, '/api/admin/reference-choices/licence-types/a%2Fb');
  assert.throws(() => service.adminRetireReferenceChoice('licence-types', ''), /code is required/);
});

test('saved retired codes stay visible but are not offered as new selections', () => {
  const active = [{ code: 'NSW', displayName: 'New South Wales' }, { code: 'VIC', displayName: 'Victoria' }];
  assert.deepEqual(plain(referenceOptions(active)), [
    { label: 'New South Wales', value: 'NSW' }, { label: 'Victoria', value: 'VIC' },
  ]);
  assert.deepEqual(plain(referenceOptions(active, 'NZ')).at(-1), { label: 'NZ (retired)', value: 'NZ', disabled: true });
  assert.equal(referenceOptions(active, 'VIC').length, 2, 'An active saved code is not duplicated');
  assert.equal(referenceOptions(undefined, ['old_trade', 'old_trade']).length, 1);
  assert.equal(referenceLabel(active, 'VIC'), 'Victoria');
  assert.equal(referenceLabel(active, 'NZ'), 'NZ (retired)');
  assert.equal(referenceLabel(active, null), '');
});

const user = (permissions, accessLevel = 'full', roles = []) => ({
  id: '1', accessLevel, roles, permissions, profileCompletionRequired: accessLevel === 'profile_setup',
});

test('regions are public; other catalogues need reference.view, also during setup', () => {
  assert.equal(access.canViewReferenceChoices(null, 'regions'), true);
  assert.equal(access.canViewReferenceChoices(null, 'occupations'), false);
  assert.equal(access.canViewReferenceChoices(user([]), 'occupations'), false);
  assert.equal(access.canViewReferenceChoices(user(['reference.view']), 'licence-types'), true);
  assert.equal(access.canViewReferenceChoices(user([], 'profile_setup'), 'occupations'), true, 'Profile-setup exception');
});

test('management read, manage and delete grants are independent', () => {
  const manager = user(['reference.manage']);
  assert.equal(access.canViewReferenceAdmin(manager), false);
  assert.equal(access.canManageReferenceChoices(manager), true);
  assert.equal(access.canRetireReferenceChoices(manager), false);
  assert.equal(access.canViewReferenceAdmin(user(['reference-admin.view'])), true);
  assert.equal(access.canRetireReferenceChoices(user(['reference.delete'])), true);
  assert.equal(access.canManageReferenceChoices(user([], 'profile_setup')), false, 'No setup exception for management');
  const admin = user([], 'full', ['SuperAdmin']);
  assert.ok([access.canViewReferenceAdmin, access.canManageReferenceChoices, access.canRetireReferenceChoices].every(gate => gate(admin)));
});
