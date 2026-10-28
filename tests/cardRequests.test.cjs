// Run with: node --test tests/*.test.cjs
// Guide 11 card requests: personal vs employee routes, address edits, lifecycle and permissions.
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

const service = load('services/cardRequestService.ts');
const rules = load('utility/cardRequestRules.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

const address = { streetAddress: ' 1 A St ', suburb: 'Sydney ', regionCode: 'NSW', postalCode: ' 2000' };

test('member routes: personal has no body; employee sends only its ID', async () => {
  await service.listMyCardRequests();
  await service.listMyCardRequests({ status: 'accepted', subjectType: 'employee' }, 2);
  await service.getCardRequest(6);
  await service.requestPersonalCard();
  await service.requestEmployeeCard(12);
  await service.updateCardDeliveryAddress(6, address);
  await service.cancelCardRequest(6);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/card-requests/me', 'get /api/card-requests/me', 'get /api/card-requests/6', 'post /api/card-requests/personal',
    'post /api/card-requests/employee', 'put /api/card-requests/6/delivery-address', 'post /api/card-requests/6/cancel',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[1].params), { status: 'accepted', subjectType: 'employee', page: 2, pageSize: 20 });
  assert.equal(calls[3].body, undefined, 'Personal creation has no body');
  assert.deepEqual(plain(calls[4].body), { employeeId: 12 });
  assert.deepEqual(plain(calls[5].body), { streetAddress: '1 A St', suburb: 'Sydney', regionCode: 'NSW', postalCode: '2000' });
  assert.equal(calls[6].body, undefined);
  assert.throws(() => service.requestEmployeeCard(0), /database ID/);
});

test('admin routes: rejection and cancellation need reasons; replacements need both fields', async () => {
  await service.adminListCardRequests({ ownerUserId: 3, status: 'pending' });
  await service.adminGetCardRequest(6);
  await service.adminCreateCardRequest(3, {});
  await service.adminCreateCardRequest(3, { employeeId: 12, previousCardId: 40, replacementReason: 'lost' });
  await service.adminDecideCardRequest(6, { action: 'accept' });
  await service.adminDecideCardRequest(6, { action: 'reject', reason: ' Not eligible ' });
  await service.adminCancelCardRequest(6, { reason: ' Duplicate ' });
  await service.adminUpdateCardDeliveryAddress(6, address);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/card-requests', 'get /api/admin/card-requests/6', 'post /api/admin/card-requests/users/3', 'post /api/admin/card-requests/users/3',
    'post /api/admin/card-requests/6/decision', 'post /api/admin/card-requests/6/decision', 'post /api/admin/card-requests/6/cancel',
    'put /api/admin/card-requests/6/delivery-address',
  ]);
  assert.deepEqual(plain(calls[0].params), { ownerUserId: 3, status: 'pending', page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[2].body), { employeeId: null, previousCardId: null, replacementReason: null });
  assert.deepEqual(plain(calls[3].body), { employeeId: 12, previousCardId: 40, replacementReason: 'lost' });
  assert.deepEqual(plain(calls[4].body), { action: 'accept', reason: null });
  assert.deepEqual(plain(calls[5].body), { action: 'reject', reason: 'Not eligible' });
  assert.throws(() => service.adminDecideCardRequest(6, { action: 'reject', reason: ' ' }), /reason/);
  assert.throws(() => service.adminCancelCardRequest(6, { reason: '' }), /audit reason/);
  assert.throws(() => service.adminCreateCardRequest(3, { previousCardId: 40 }), /both/);
  assert.throws(() => service.adminCreateCardRequest(3, { replacementReason: 'damaged' }), /both/);
});

const user = (id, permissions) => ({ id, accessLevel: 'full', roles: [], permissions, profileCompletionRequired: false });
const all = ['card-requests.view', 'card-requests.manage', 'card-requests.delete', 'employees.manage'];

test('owner actions only while pending; "accepted" shows as Approved', () => {
  const owner = user('5', all);
  assert.deepEqual(plain(rules.cardRequestActions({ status: 'pending', ownerUserId: 5 }, owner)), { editAddress: true, cancel: true });
  for (const status of ['accepted', 'rejected', 'cancelled']) {
    assert.deepEqual(plain(rules.cardRequestActions({ status, ownerUserId: 5 }, owner)), { editAddress: false, cancel: false }, `${status} is locked`);
  }
  assert.deepEqual(plain(rules.cardRequestActions({ status: 'pending', ownerUserId: 5 }, user('6', all))), { editAddress: false, cancel: false }, 'Recipient isolation');
  assert.deepEqual(plain(rules.cardRequestActions({ status: 'pending', ownerUserId: 5 }, user('5', ['card-requests.view', 'card-requests.delete']))), { editAddress: false, cancel: true });
  assert.equal(rules.CARD_REQUEST_STATUS_LABELS.accepted, 'Approved');
});

test('eligibility: personal needs card-requests.manage; employee also needs employees.manage and a provider type', () => {
  assert.equal(rules.canRequestPersonalCard(user('5', ['card-requests.manage'])), true);
  assert.equal(rules.canRequestPersonalCard(user('5', ['card-requests.view'])), false);
  assert.equal(rules.canRequestEmployeeCard(user('5', ['card-requests.manage', 'employees.manage']), 'builder'), true);
  assert.equal(rules.canRequestEmployeeCard(user('5', ['card-requests.manage']), 'builder'), false, 'Independent permissions');
  assert.equal(rules.canRequestEmployeeCard(user('5', ['card-requests.manage', 'employees.manage']), 'individual'), false);
  assert.equal(access.canViewCardRequests(user('5', ['card-requests.view'])), true);
  assert.equal(access.canReviewCardRequests(user('5', all)), false, 'Only SuperAdmin reviews');
  assert.equal(access.canReviewCardRequests({ ...user('5', []), roles: ['SuperAdmin'] }), true);
});

test('open requests block another for the same subject; final and fulfilled ones do not', () => {
  const request = overrides => ({ subjectType: 'personal', employeeId: null, status: 'pending', legacyApproval: false, fulfillmentClosedAtUtc: null, ...overrides });
  assert.equal(rules.hasOpenCardRequest([request()], {}), true);
  assert.equal(rules.hasOpenCardRequest([request({ status: 'accepted' })], {}), true, 'Approved but not fulfilled');
  assert.equal(rules.hasOpenCardRequest([request({ status: 'accepted', fulfillmentClosedAtUtc: '2030-01-01T00:00:00Z' })], {}), false);
  assert.equal(rules.hasOpenCardRequest([request({ status: 'accepted', legacyApproval: true })], {}), false, 'Historical approvals can be replaced');
  assert.equal(rules.hasOpenCardRequest([request({ status: 'rejected' }), request({ status: 'cancelled' })], {}), false);
  const employee = request({ subjectType: 'employee', employeeId: 12 });
  assert.equal(rules.hasOpenCardRequest([employee], { employeeId: 12 }), true);
  assert.equal(rules.hasOpenCardRequest([employee], { employeeId: 13 }), false);
  assert.equal(rules.hasOpenCardRequest([employee], {}), false, 'An employee request does not block a personal one');
});

test('delivery address: all four fields required', async () => {
  const values = plain(rules.deliveryAddressValues({ streetAddress: '1 A St', suburb: 'Sydney', regionCode: 'NSW', postalCode: '2000' }));
  assert.equal(await rules.deliveryAddressSchema.isValid(values), true);
  for (const field of ['streetAddress', 'suburb', 'regionCode', 'postalCode']) {
    assert.equal(await rules.deliveryAddressSchema.isValid({ ...values, [field]: ' ' }), false, `${field} is required`);
  }
  assert.deepEqual(plain(rules.deliveryAddressValues(null)), { streetAddress: '', suburb: '', regionCode: '', postalCode: '' });
});
