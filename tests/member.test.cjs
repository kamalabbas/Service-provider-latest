// Run with: node --test tests/*.test.cjs
// Guide 03 member types and roles: service contracts and access gates.
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

const service = load('services/memberService.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

test('member routes: types, current member, first type selection and self-deactivation', async () => {
  await service.getUserTypes();
  await service.getMyMember();
  await service.selectMyUserType({ userTypeCode: 'tradeperson' });
  await service.deactivateMyAccount();
  assert.deepEqual(plain(calls), [
    { method: 'get', url: '/api/members/user-types' },
    { method: 'get', url: '/api/members/me' },
    { method: 'put', url: '/api/members/me/user-type', body: { userTypeCode: 'tradeperson' } },
    { method: 'post', url: '/api/members/me/deactivate' },
  ]);
});

test('admin user routes use validated database IDs and exact-email lookup', async () => {
  await service.adminListAllUsers();
  await service.adminFindUserByEmail('member@example.test');
  await service.adminDeactivateUser(41);
  await service.adminReactivateUser(41);
  await service.adminChangeUserType(41, { userTypeCode: 'builder' });
  assert.deepEqual(plain(calls), [
    { method: 'get', url: '/api/admin/users/all' },
    { method: 'get', url: '/api/admin/users', params: { email: 'member@example.test' } },
    { method: 'post', url: '/api/admin/users/41/deactivate' },
    { method: 'post', url: '/api/admin/users/41/reactivate' },
    { method: 'put', url: '/api/admin/users/41/user-type', body: { userTypeCode: 'builder' } },
  ]);
  assert.throws(() => service.adminDeactivateUser(0), /database ID/);
  assert.throws(() => service.adminChangeUserType(1.5, { userTypeCode: 'builder' }), /database ID/);
});

test('role routes send complete names and permission sets', async () => {
  await service.adminListRoles();
  await service.adminListPermissions();
  await service.adminCreateRole({ name: 'Reviewer', permissions: ['quotes.view'] });
  await service.adminUpdateRole(7, { name: 'Reviewer', permissions: ['quotes.view', 'quotes.manage'] });
  await service.adminDeleteRole(7);
  await service.adminGetUserRoles(41);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/roles',
    'get /api/admin/roles/permissions',
    'post /api/admin/roles',
    'put /api/admin/roles/7',
    'delete /api/admin/roles/7',
    'get /api/admin/users/41/roles',
  ]);
  assert.deepEqual(plain(calls[3].body), { name: 'Reviewer', permissions: ['quotes.view', 'quotes.manage'] });
});

const roles = [
  { id: 1, name: 'SuperAdmin', isSystemRole: true, isDefaultRole: false, permissions: [] },
  { id: 2, name: 'Member', isSystemRole: true, isDefaultRole: true, permissions: ['profiles.view'] },
  { id: 3, name: 'Reviewer', isSystemRole: false, isDefaultRole: false, permissions: ['quotes.view'] },
];

test('role assignment replaces the complete set and never sends SuperAdmin', async () => {
  await service.adminReplaceUserRoles(41, [2, 3, 3], roles);
  assert.deepEqual(plain(calls[0]), { method: 'put', url: '/api/admin/users/41/roles', body: { roleIds: [2, 3] } });
  await service.adminReplaceUserRoles(41, [], roles);
  assert.deepEqual(plain(calls[1].body), { roleIds: [] }, 'An empty set removes non-system assignments');
  assert.throws(() => service.adminReplaceUserRoles(41, [1, 2], roles), /SuperAdmin/);
  assert.equal(calls.length, 2);
});

const user = (permissions, accessLevel = 'full', roles = []) => ({
  id: '1', accessLevel, roles, permissions, profileCompletionRequired: accessLevel === 'profile_setup',
});

test('own membership routes allow profile setup; deactivation needs only a session', () => {
  const setup = user([], 'profile_setup');
  assert.equal(access.canViewOwnMembership(setup), true);
  assert.equal(access.canSelectUserType(setup), true);
  assert.equal(access.canDeactivateOwnAccount(setup), true);
  assert.equal(access.canViewOwnMembership(user([])), false);
  assert.equal(access.canSelectUserType(user(['profiles.view'])), false);
  assert.equal(access.canDeactivateOwnAccount(user([])), true);
  assert.equal(access.canDeactivateOwnAccount(null), false);
});

test('admin gates: independent grants, both grants to assign, SuperAdmin-only type change', () => {
  assert.equal(access.canViewUsers(user(['users.view'])), true);
  assert.equal(access.canDeactivateUsers(user(['users.manage'])), false);
  assert.equal(access.canReactivateUsers(user(['users.manage'])), true);
  assert.equal(access.canAssignRoles(user(['roles.manage'])), false);
  assert.equal(access.canAssignRoles(user(['roles.manage', 'users.manage'])), true);
  assert.equal(access.canDeleteRoles(user(['roles.manage'])), false);
  const everyPermission = user(['users.view', 'users.manage', 'users.delete', 'roles.view', 'roles.manage', 'roles.delete']);
  assert.equal(access.canChangeUserType(everyPermission), false, 'No permission grants a type change');
  assert.equal(access.canChangeUserType(user([], 'full', ['SuperAdmin'])), true);
  assert.equal(access.canChangeUserType(user([], 'profile_setup', ['SuperAdmin'])), false);
});
