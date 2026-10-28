// Run with: node --test tests/*.test.cjs
// Guide 16 announcements: member and SuperAdmin routes, audience rules, lifecycle actions and access.
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
  const sandbox = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module: sandbox, exports: sandbox.exports, encodeURIComponent,
    require: id => {
      if (id === './api') return api;
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, sandbox.exports);
  return sandbox.exports;
}

const service = load('services/announcementService.ts');
const rules = load('utility/announcementRules.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

test('member routes: paged list and detail only', async () => {
  await service.listAnnouncements();
  await service.listAnnouncements(2, 3);
  await service.getAnnouncement(5);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/announcements', 'get /api/announcements', 'get /api/announcements/5',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[1].params), { page: 2, pageSize: 3 });
  assert.throws(() => service.getAnnouncement(0), /database ID/);
});

test('admin routes: save is separate from publish; retire and history', async () => {
  const body = { title: ' News ', body: ' Hello ', audience: 'all', userTypeCodes: [] };
  await service.adminListAnnouncements();
  await service.adminListAnnouncements({ status: 'draft' });
  await service.adminGetAnnouncement(5);
  await service.adminCreateAnnouncement(body);
  await service.adminUpdateAnnouncement(5, body);
  await service.adminPublishAnnouncement(5);
  await service.adminRetireAnnouncement(5);
  await service.adminGetAnnouncementHistory(5);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/announcements', 'get /api/admin/announcements', 'get /api/admin/announcements/5',
    'post /api/admin/announcements', 'put /api/admin/announcements/5', 'post /api/admin/announcements/5/publish',
    'post /api/admin/announcements/5/retire', 'get /api/admin/announcements/5/history',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 }, 'Empty filters are omitted');
  assert.deepEqual(plain(calls[1].params), { status: 'draft', page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[3].body), { title: 'News', body: 'Hello', audience: 'all', userTypeCodes: [] });
  assert.equal(calls[5].body, undefined);
  assert.equal(calls[6].body, undefined);
});

test('audience: all sends no types; selected types need at least one code; limits enforced', () => {
  assert.deepEqual(plain(service.announcementBody({ title: 'a', body: 'b', audience: 'all', userTypeCodes: ['builder'] })).userTypeCodes, [],
    'Selections are dropped for all');
  assert.deepEqual(plain(service.announcementBody({ title: 'a', body: 'b', audience: 'selected_user_types', userTypeCodes: [' builder ', 'builder', '', 'developer'] })).userTypeCodes,
    ['builder', 'developer']);
  assert.throws(() => service.announcementBody({ title: 'a', body: 'b', audience: 'selected_user_types', userTypeCodes: [' '] }), /member type/);
  assert.throws(() => service.announcementBody({ title: ' ', body: 'b', audience: 'all', userTypeCodes: [] }), /title/);
  assert.throws(() => service.announcementBody({ title: 'x'.repeat(201), body: 'b', audience: 'all', userTypeCodes: [] }), /200/);
  assert.throws(() => service.announcementBody({ title: 'a', body: 'x'.repeat(10001), audience: 'all', userTypeCodes: [] }), /10000/);
  assert.doesNotThrow(() => service.announcementBody({ title: 'a', body: 'x'.repeat(10000), audience: 'all', userTypeCodes: [] }));
});

const user = (id, accessLevel = 'full', permissions = ['announcements.view'], roles = []) =>
  ({ id, accessLevel, roles, permissions, profileCompletionRequired: accessLevel === 'profile_setup', email: 'a@b.c' });
const admin = user('9', 'full', [], ['SuperAdmin']);

test('lifecycle: drafts publish explicitly, published edits are confirmed, retired is final', () => {
  assert.deepEqual(plain(rules.announcementAdminActions({ status: 'draft' }, admin)), { edit: true, publish: true, retire: false, confirmLiveEdit: false });
  assert.deepEqual(plain(rules.announcementAdminActions({ status: 'published' }, admin)), { edit: true, publish: false, retire: true, confirmLiveEdit: true });
  assert.deepEqual(plain(rules.announcementAdminActions({ status: 'retired' }, admin)), { edit: false, publish: false, retire: false, confirmLiveEdit: false });
  assert.deepEqual(plain(rules.announcementAdminActions({ status: 'draft' }, user('1', 'full', ['announcements.view', 'announcements.manage']))),
    { edit: false, publish: false, retire: false, confirmLiveEdit: false }, 'A permission never makes an editor');
});

test('access: full members with announcements.view; never during setup', () => {
  assert.equal(access.canViewAnnouncements(user('1')), true);
  assert.equal(access.canViewAnnouncements(user('1', 'full', [])), false);
  assert.equal(access.canViewAnnouncements(user('1', 'profile_setup', ['announcements.view'])), false);
  assert.equal(access.canViewAnnouncements(admin), true);
  assert.equal(access.canManageAnnouncementsAsAdmin(user('1')), false);
  assert.equal(access.canManageAnnouncementsAsAdmin(admin), true);
});

test('previews are one line and shortened by characters', () => {
  assert.equal(rules.announcementPreview('Line one\n\nline   two'), 'Line one line two');
  const preview = rules.announcementPreview('😀'.repeat(200), 10);
  assert.equal([...preview].length, 10);
  assert.ok(preview.endsWith('…'));
  assert.equal(rules.announcementPreview('<b>hi</b>'), '<b>hi</b>', 'Plain text stays literal');
});
