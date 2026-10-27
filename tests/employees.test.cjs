// Run with: node --test tests/*.test.cjs
// Guide 10 employees: roster routes, paging, form rules and gates.
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

const service = load('services/employeeService.ts');
const form = load('utility/employeeForm.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

const values = (overrides = {}) => ({
  ...form.employeeFormValues(null),
  firstName: ' Alex ', lastName: 'Taylor', phone: '+61 412 345 678', occupationCode: 'electrical_services', ...overrides,
});

test('own roster routes; archived history only when asked; paging validated', async () => {
  const body = form.toSaveEmployeeRequest(values());
  await service.listMyEmployees();
  await service.listMyEmployees({ includeArchived: true }, 2, 50);
  await service.getMyEmployee(7);
  await service.createMyEmployee(body);
  await service.updateMyEmployee(7, body);
  await service.archiveMyEmployee(7);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/employees/me', 'get /api/employees/me', 'get /api/employees/me/7', 'post /api/employees/me', 'put /api/employees/me/7', 'delete /api/employees/me/7',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[1].params), { includeArchived: true, page: 2, pageSize: 50 });
  assert.throws(() => service.listMyEmployees({}, 0), /Page/);
  assert.throws(() => service.getMyEmployee(-1), /database ID/);
});

test('admin routes target user, business and employee IDs', async () => {
  const body = form.toSaveEmployeeRequest(values());
  await service.adminListUserEmployees(41, { includeArchived: true });
  await service.adminGetEmployee(7);
  await service.adminCreateBusinessEmployee(9, body);
  await service.adminUpdateEmployee(7, body);
  await service.adminArchiveEmployee(7);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/employees/users/41', 'get /api/admin/employees/7', 'post /api/admin/employees/businesses/9',
    'put /api/admin/employees/7', 'delete /api/admin/employees/7',
  ]);
  assert.deepEqual(plain(calls[0].params), { includeArchived: true, page: 1, pageSize: 20 });
});

test('form: required name, phone and occupation; optional email, position, licence on create and edit', async () => {
  assert.equal(await form.employeeSchema.isValid(values()), true);
  for (const field of ['firstName', 'lastName', 'phone', 'occupationCode']) {
    assert.equal(await form.employeeSchema.isValid(values({ [field]: '' })), false, `${field} is required`);
  }
  assert.equal(await form.employeeSchema.isValid(values({ email: 'not-an-email' })), false);
  assert.equal(await form.employeeSchema.isValid(values({ phone: 'abc' })), false);
  const request = plain(form.toSaveEmployeeRequest(values()));
  assert.equal(request.firstName, 'Alex');
  assert.equal(request.email, null);
  assert.equal(request.positionCode, null);
  assert.equal(request.licence, null);
  // Clearing optional fields on edit sends null, not the old value.
  const saved = { ...request, id: 7, businessId: 1, occupationName: 'E', email: 'a@b.au', positionCode: 'lead', positionName: 'Lead', licence: 'L1', createdAtUtc: '', updatedAtUtc: '' };
  const edited = plain(form.toSaveEmployeeRequest({ ...form.employeeFormValues(saved), email: ' ', positionCode: '', licence: '' }));
  assert.deepEqual([edited.email, edited.positionCode, edited.licence], [null, null, null]);
  assert.equal(form.employeeName(saved), 'Alex Taylor');
});

const user = (permissions, accessLevel = 'full') => ({ id: '1', accessLevel, roles: [], permissions, profileCompletionRequired: accessLevel === 'profile_setup' });

test('gates: eligible type plus view, manage and delete separately', () => {
  assert.equal(access.canViewEmployees(user(['employees.view']), 'tradeperson'), true);
  assert.equal(access.canViewEmployees(user(['employees.view']), 'individual'), false);
  assert.equal(access.canManageEmployees(user(['employees.view']), 'builder'), false, 'Read-only roster');
  assert.equal(access.canManageEmployees(user(['employees.manage']), 'builder'), true);
  assert.equal(access.canArchiveEmployees(user(['employees.manage']), 'builder'), false);
  assert.equal(access.canArchiveEmployees(user(['employees.delete']), 'developer'), true);
  assert.equal(access.canViewEmployees(user(['employees.view'], 'profile_setup'), 'builder'), false);
});
