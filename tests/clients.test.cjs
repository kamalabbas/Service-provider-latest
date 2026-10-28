// Run with: node --test tests/*.test.cjs
// Guide 12 client relationships: routes, filters, visibility rules and identity text.
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
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, module.exports);
  return module.exports;
}

const service = load('services/clientService.ts');
const rules = load('utility/clientRules.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

test('member routes: provider and customer lists use only set filters; visibility by business + client', async () => {
  await service.listMyClients();
  await service.listMyClients({ businessId: 3, includeHidden: true, includeArchivedBusinesses: true }, 2);
  await service.listMyProviders({ includeArchivedBusinesses: true });
  await service.setClientHidden(3, 10, true);
  await service.setClientHidden(3, 10, false);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/clients/me', 'get /api/clients/me', 'get /api/clients/providers/me',
    'put /api/clients/me/3/10/visibility', 'put /api/clients/me/3/10/visibility',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[1].params), { businessId: 3, includeHidden: true, includeArchivedBusinesses: true, page: 2, pageSize: 20 });
  assert.deepEqual(plain(calls[2].params), { includeArchivedBusinesses: true, page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[3].body), { isHidden: true });
  assert.deepEqual(plain(calls[4].body), { isHidden: false });
  assert.throws(() => service.setClientHidden(0, 10, true), /database ID/);
});

test('admin routes: global filters and visibility', async () => {
  await service.adminListClients({ providerUserId: 20, clientUserId: 10, includeHidden: true });
  await service.adminSetClientHidden(3, 10, true);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/clients', 'put /api/admin/clients/businesses/3/clients/10/visibility',
  ]);
  assert.deepEqual(plain(calls[0].params), { providerUserId: 20, clientUserId: 10, includeHidden: true, page: 1, pageSize: 20 });
});

const user = (id, permissions = ['clients.view', 'clients.manage', 'clients.delete']) =>
  ({ id, accessLevel: 'full', roles: [], permissions, profileCompletionRequired: false });
const row = (isHidden = false) => ({ isHidden, providerUserId: 20 });

test('visibility: hide needs delete, restore needs manage; former ineligible providers are read-only', () => {
  assert.deepEqual(plain(rules.clientActions(row(), user('20'), 'builder')), { hide: true, restore: false });
  assert.deepEqual(plain(rules.clientActions(row(true), user('20'), 'builder')), { hide: false, restore: true });
  assert.deepEqual(plain(rules.clientActions(row(), user('20', ['clients.view', 'clients.manage']), 'builder')), { hide: false, restore: false });
  assert.deepEqual(plain(rules.clientActions(row(true), user('20', ['clients.view', 'clients.delete']), 'builder')), { hide: false, restore: false });
  assert.deepEqual(plain(rules.clientActions(row(), user('20'), 'individual')), { hide: false, restore: false }, 'Former provider: history only');
  assert.deepEqual(plain(rules.clientActions(row(), user('10'), 'builder')), { hide: false, restore: false }, 'Only the provider side');
  assert.equal(access.canViewClients(user('1', ['clients.view'])), true);
  assert.equal(access.canViewClients(user('1', [])), false);
});

test('identity text labels changed membership IDs; rows are keyed by business and client', () => {
  assert.equal(rules.clientMembershipText({ clientMembershipId: 'B100002', originalClientMembershipId: 'C100001' }),
    'Membership ID B100002 (originally C100001)');
  assert.equal(rules.clientMembershipText({ clientMembershipId: 'C100001', originalClientMembershipId: 'C100001' }), 'Membership ID C100001');
  assert.equal(rules.inspectionCountText({ acceptedInspectionCount: 3, completedInspectionCount: 2 }), '3 accepted · 2 completed');
  assert.notEqual(rules.relationshipKey({ businessId: 3, clientUserId: 10 }), rules.relationshipKey({ businessId: 4, clientUserId: 10 }),
    'The same customer under two businesses stays separate');
});
