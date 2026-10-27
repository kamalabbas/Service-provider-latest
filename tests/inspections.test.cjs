// Run with: node --test tests/*.test.cjs
// Guide 08 inspections: routes, workflow bodies, the state/action matrix, codes and requests.
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

const service = load('services/inspectionService.ts');
const rules = load('utility/inspectionRules.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

test('member routes and list filters: only set filters are sent', async () => {
  await service.listMyInspections();
  await service.listMyInspections({ side: 'provider', status: 'accepted', includeHidden: true }, 2);
  await service.getInspection(5);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[1].params), { status: 'accepted', side: 'provider', includeHidden: true, page: 2, pageSize: 20 });
  assert.deepEqual(plain(service.inspectionListParams({ side: 'all' })), { page: 1, pageSize: 20 }, 'side all is the default');
  assert.equal(calls[2].url, '/api/inspections/5');
});

test('workflow writes: exact paths and bodies', async () => {
  await service.createInspection({ serviceId: 9, streetAddress: '1 A St', suburb: 'Sydney', regionCode: 'NSW', postalCode: '2000', note: null });
  await service.acceptInspection(5, { scheduledAt: '2030-01-02T09:30:00+10:00', employeeId: 3 });
  await service.acceptInspection(5, { scheduledAt: '2030-01-02T09:30:00Z' });
  await service.rejectInspection(5, { reason: '  ' });
  await service.cancelInspection(5, { reason: ' Clash ' });
  await service.issueCompletionCode(5);
  await service.completeInspection(5, { code: '123456' });
  await service.assignInspectionEmployee(5, null);
  await service.assignInspectionEmployee(5, 3);
  await service.rateInspection(5, { score: 4, note: ' Great ' });
  await service.setInspectionHidden(5, true);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'post /api/inspections', 'post /api/inspections/5/accept', 'post /api/inspections/5/accept', 'post /api/inspections/5/reject',
    'post /api/inspections/5/cancel', 'post /api/inspections/5/completion-code', 'post /api/inspections/5/complete',
    'put /api/inspections/5/employee', 'put /api/inspections/5/employee', 'post /api/inspections/5/rating', 'put /api/inspections/5/visibility',
  ]);
  assert.deepEqual(plain(calls[1].body), { scheduledAt: '2030-01-01T23:30:00.000Z', employeeId: 3 }, 'Offset converted to UTC');
  assert.deepEqual(plain(calls[2].body), { scheduledAt: '2030-01-02T09:30:00.000Z', employeeId: null });
  assert.deepEqual(plain(calls[3].body), { reason: null });
  assert.deepEqual(plain(calls[4].body), { reason: 'Clash' });
  assert.equal(calls[5].body, undefined);
  assert.deepEqual(plain(calls[6].body), { code: '123456' });
  assert.deepEqual(plain(calls[7].body), { employeeId: null }, 'null clears the worker');
  assert.deepEqual(plain(calls[9].body), { score: 4, note: 'Great' });
  assert.deepEqual(plain(calls[10].body), { isHidden: true });
});

test('local checks: offset-less appointments, bad codes and scores are never sent', () => {
  assert.throws(() => service.acceptInspection(5, { scheduledAt: '2030-01-02T09:30' }), /offset/);
  assert.throws(() => service.completeInspection(5, { code: '12345' }), /6-digit/);
  assert.throws(() => service.completeInspection(5, { code: '12a456' }), /6-digit/);
  assert.throws(() => service.rateInspection(5, { score: 0 }), /1 to 5/);
  assert.throws(() => service.rateInspection(5, { score: 4.5 }), /1 to 5/);
  assert.throws(() => service.createInspection({ serviceId: 0 }), /database ID/);
  assert.equal(calls.length, 0);
});

test('admin routes: audit reason required; acceptance needs an appointment', async () => {
  await service.adminListInspections({ status: 'pending', providerUserId: 8 });
  await service.adminGetInspection(5);
  await service.adminCreateInspectionForRequester(7, { serviceId: 9, streetAddress: 'a', suburb: 'b', regionCode: 'NSW', postalCode: '1' });
  await service.adminDecideInspection(5, { action: 'complete', reason: ' Verified by phone ' });
  await service.adminAssignInspectionEmployee(5, { employeeId: null, reason: 'Worker unavailable' });
  await service.adminRateInspection(5, { score: 5 });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/inspections', 'get /api/admin/inspections/5', 'post /api/admin/inspections/users/7',
    'post /api/admin/inspections/5/decision', 'put /api/admin/inspections/5/employee', 'post /api/admin/inspections/5/rating',
  ]);
  assert.deepEqual(plain(calls[0].params), { status: 'pending', providerUserId: 8, page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[3].body), { action: 'complete', reason: 'Verified by phone', scheduledAt: null, employeeId: null });
  assert.throws(() => service.adminDecideInspection(5, { action: 'reject', reason: ' ' }), /audit reason/);
  assert.throws(() => service.adminDecideInspection(5, { action: 'accept', reason: 'ok' }), /appointment/);
});

const user = (id, permissions = ['inspections.view', 'inspections.manage', 'inspections.delete']) =>
  ({ id, accessLevel: 'full', roles: [], permissions, profileCompletionRequired: false });
const inspection = (status, isHidden = false) => ({ status, isHidden, requesterUserId: 10, providerUserId: 20 });
const enabled = actions => Object.entries(plain(actions)).filter(([, on]) => on).map(([name]) => name).sort();

test('state/action matrix by participant (decided by account IDs)', () => {
  const requester = user('10');
  const provider = user('20');
  assert.equal(rules.inspectionRole(inspection('pending'), '10'), 'requester');
  assert.equal(rules.inspectionRole(inspection('pending'), '20'), 'provider');
  assert.equal(rules.inspectionRole(inspection('pending'), '99'), null);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('pending'), provider)), ['accept', 'cancel', 'reject']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('pending'), requester)), ['cancel']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('accepted'), provider)), ['assignWorker', 'cancel', 'complete']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('accepted'), requester)), ['cancel', 'issueCode']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('completed'), requester)), ['hide', 'rate']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('completed'), provider)), ['hide']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('rated', true), provider)), ['restore']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('rejected'), user('99'))), [], 'Permission never makes an outsider a participant');
});

test('independent permissions: reject/cancel/hide need delete; restore needs manage', () => {
  const viewOnly = user('20', ['inspections.view']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('pending'), viewOnly)), []);
  const manageOnly = user('20', ['inspections.view', 'inspections.manage']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('pending'), manageOnly)), ['accept']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('cancelled', true), manageOnly)), ['restore']);
  const deleteOnly = user('20', ['inspections.view', 'inspections.delete']);
  assert.deepEqual(enabled(rules.inspectionActions(inspection('cancelled'), deleteOnly)), ['hide']);
  assert.equal(access.canRequestInspections(manageOnly), true);
  assert.equal(access.canRequestInspections(viewOnly), false);
});

test('appointments, code countdown and matching workers', () => {
  const now = Date.parse('2030-01-01T00:00:00Z');
  assert.equal(rules.isFutureAppointment(new Date(now + 60000), now), true);
  assert.equal(rules.isFutureAppointment(new Date(now - 1), now), false);
  assert.equal(rules.isFutureAppointment(null, now), false);
  assert.equal(rules.secondsUntil('2030-01-01T00:10:00Z', now), 600);
  assert.equal(rules.secondsUntil('2029-12-31T23:59:00Z', now), 0);
  assert.equal(rules.formatCountdown(599), '9:59');
  const employees = [
    { id: 1, occupationCode: 'electrical', archivedAtUtc: null },
    { id: 2, occupationCode: 'plumbing', archivedAtUtc: null },
    { id: 3, occupationCode: 'electrical', archivedAtUtc: '2030-01-01T00:00:00Z' },
  ];
  assert.deepEqual(rules.matchingEmployees(employees, 'electrical').map(e => e.id), [1], 'Active and same occupation only');
});

test('request form: prefilled from the profile, explicit address, optional note', async () => {
  const values = plain(rules.inspectionRequestValues({ streetAddress: '1 A St', suburb: 'Sydney', regionCode: 'NSW', postalCode: '2000' }));
  assert.deepEqual(values, { streetAddress: '1 A St', suburb: 'Sydney', regionCode: 'NSW', postalCode: '2000', note: '' });
  assert.equal(await rules.inspectionRequestSchema.isValid(values), true);
  assert.equal(await rules.inspectionRequestSchema.isValid({ ...values, streetAddress: '' }), false);
  assert.deepEqual(plain(rules.toCreateInspectionRequest(9, { ...values, note: '  ' })), { serviceId: 9, ...values, note: null });
  assert.equal(plain(rules.inspectionRequestValues(null)).streetAddress, '');
});
