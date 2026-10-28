// Run with: node --test tests/*.test.cjs
// Guide 15 support: member/admin routes, field limits, state-based actions and newest-first paging.
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
      if (id === 'yup') return require('yup');
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, sandbox.exports);
  return sandbox.exports;
}

const service = load('services/supportService.ts');
const rules = load('utility/supportRules.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

test('member routes: own list, create, thread, reply, close and reopen', async () => {
  await service.listMySupportTickets();
  await service.listMySupportTickets({ status: 'pending' }, 2);
  await service.createSupportTicket({ title: ' Help ', initialMessage: ' Something broke ' });
  await service.getSupportTicket('member', 7);
  await service.listSupportMessages('member', 7, 3);
  await service.listSupportTicketHistory('member', 7);
  await service.sendSupportMessage('member', 7, { body: ' Thanks ' });
  await service.closeSupportTicket('member', 7);
  await service.reopenSupportTicket('member', 7);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/support/tickets/me', 'get /api/support/tickets/me', 'post /api/support/tickets',
    'get /api/support/tickets/7', 'get /api/support/tickets/7/messages', 'get /api/support/tickets/7/history',
    'post /api/support/tickets/7/messages', 'post /api/support/tickets/7/close', 'post /api/support/tickets/7/reopen',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 }, 'Empty filters are omitted');
  assert.deepEqual(plain(calls[1].params), { status: 'pending', page: 2, pageSize: 20 });
  assert.deepEqual(plain(calls[2].body), { title: 'Help', initialMessage: 'Something broke' });
  assert.deepEqual(plain(calls[4].params), { page: 3, pageSize: 20 });
  assert.deepEqual(plain(calls[6].body), { body: 'Thanks' });
  assert.equal(calls[7].body, undefined);
  assert.equal(calls[8].body, undefined);
});

test('admin routes are explicit: inbox filters, thread actions and opening for a member', async () => {
  await service.adminListSupportTickets({ ownerUserId: 4, status: 'open' });
  await service.getSupportTicket('admin', 7);
  await service.listSupportMessages('admin', 7);
  await service.sendSupportMessage('admin', 7, { body: 'On it' });
  await service.closeSupportTicket('admin', 7);
  await service.reopenSupportTicket('admin', 7);
  await service.adminCreateSupportTicket(4, { title: 'Card', initialMessage: 'Your card is ready' });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/support/tickets', 'get /api/admin/support/tickets/7', 'get /api/admin/support/tickets/7/messages',
    'post /api/admin/support/tickets/7/messages', 'post /api/admin/support/tickets/7/close',
    'post /api/admin/support/tickets/7/reopen', 'post /api/admin/support/tickets/users/4',
  ]);
  assert.deepEqual(plain(calls[0].params), { ownerUserId: 4, status: 'open', page: 1, pageSize: 20 });
});

test('field limits: nonblank title ≤ 200, messages ≤ 5000; IDs validated', () => {
  assert.throws(() => service.createSupportTicket({ title: '  ', initialMessage: 'x' }), /title/);
  assert.throws(() => service.createSupportTicket({ title: 'x'.repeat(201), initialMessage: 'x' }), /200/);
  assert.throws(() => service.createSupportTicket({ title: 'x', initialMessage: 'x'.repeat(5001) }), /5000/);
  assert.throws(() => service.sendSupportMessage('member', 7, { body: ' ' }), /message/);
  assert.throws(() => service.getSupportTicket('member', 0), /database ID/);
  assert.throws(() => service.listSupportMessages('member', 7, 0), /Page/);
  assert.doesNotThrow(() => service.createSupportTicket({ title: '😀'.repeat(200), initialMessage: 'x' }), 'Counts characters, not UTF-16 units');

  assert.equal(rules.supportTicketSchema.isValidSync({ title: 'Help', initialMessage: 'Please' }), true);
  assert.equal(rules.supportTicketSchema.isValidSync({ title: ' ', initialMessage: 'Please' }), false);
  assert.equal(rules.supportTicketSchema.isValidSync({ title: 'Help', initialMessage: 'x'.repeat(5001) }), false);
});

const user = (id, accessLevel = 'full', permissions = ['support.view', 'support.manage', 'support.delete'], roles = []) =>
  ({ id, accessLevel, roles, permissions, profileCompletionRequired: accessLevel === 'profile_setup', email: 'a@b.c' });
const ticket = (status, ownerUserId = 1) => ({ id: 7, ownerUserId, ownerEmail: 'owner@b.c', status });

test('actions: owners reply while open/pending, close needs support.delete, closed needs explicit reopen', () => {
  assert.deepEqual(plain(rules.supportTicketActions(ticket('open'), user('1'), 'member')), { reply: true, close: true, reopen: false });
  assert.deepEqual(plain(rules.supportTicketActions(ticket('pending'), user('1'), 'member')), { reply: true, close: true, reopen: false });
  assert.deepEqual(plain(rules.supportTicketActions(ticket('closed'), user('1'), 'member')), { reply: false, close: false, reopen: true });
  assert.deepEqual(plain(rules.supportTicketActions(ticket('open'), user('1', 'full', ['support.view', 'support.manage']), 'member')),
    { reply: true, close: false, reopen: false });
  assert.deepEqual(plain(rules.supportTicketActions(ticket('open'), user('1', 'full', ['support.view']), 'member')),
    { reply: false, close: false, reopen: false });
  assert.deepEqual(plain(rules.supportTicketActions(ticket('open', 2), user('1'), 'member')), { reply: false, close: false, reopen: false },
    'Permission never reaches another member\'s ticket');
  assert.deepEqual(plain(rules.supportTicketActions(ticket('pending'), user('1', 'profile_setup', []), 'member')), { reply: true, close: true, reopen: false },
    'Profile-setup sessions are supported');

  const admin = user('9', 'full', [], ['SuperAdmin']);
  assert.deepEqual(plain(rules.supportTicketActions(ticket('open', 1), admin, 'admin')), { reply: true, close: true, reopen: false });
  assert.deepEqual(plain(rules.supportTicketActions(ticket('closed', 1), admin, 'admin')), { reply: false, close: false, reopen: true });
  assert.deepEqual(plain(rules.supportTicketActions(ticket('open', 1), user('1'), 'admin')), { reply: false, close: false, reopen: false },
    'Admin mode is SuperAdmin-only');
});

test('access: setup sessions may use support; staff access is SuperAdmin-only', () => {
  assert.equal(access.canViewSupport(user('1', 'profile_setup', [])), true);
  assert.equal(access.canCreateSupportTickets(user('1', 'profile_setup', [])), true);
  assert.equal(access.canViewSupport(user('1', 'full', [])), false);
  assert.equal(access.canManageSupportAsAdmin(user('1')), false);
  assert.equal(access.canManageSupportAsAdmin(user('9', 'full', [], ['SuperAdmin'])), true);
  assert.equal(access.canManageSupportAsAdmin(user('9', 'profile_setup', [], ['SuperAdmin'])), false);
});

const message = (id, minute, senderUserId = 1) => ({ id, ticketId: 7, senderUserId, senderKind: 'member', body: `m${id}`, createdAtUtc: `2026-10-18T12:${String(minute).padStart(2, '0')}:00Z` });

test('paging: newest-first pages merge without duplicates when a reply shifts boundaries', () => {
  // Page 1 was fetched before message 5 arrived; page 2 after, so message 3 appears twice.
  const page1 = [message(4, 4), message(3, 3)];
  const page2 = [message(3, 3), message(2, 2), message(1, 1)];
  const latest = [message(5, 5), message(4, 4)];
  assert.deepEqual(plain(rules.mergeSupportMessages([page1, page2]).map(item => item.id)), [4, 3, 2, 1]);
  assert.deepEqual(plain(rules.mergeSupportMessages([latest, page1, page2]).map(item => item.id)), [5, 4, 3, 2, 1]);
  assert.deepEqual(plain(rules.mergeSupportMessages([[message(8, 1), message(9, 1)]]).map(item => item.id)), [9, 8], 'Ties fall back to ID');
});

test('sender labels come from the viewer, not senderKind', () => {
  const t = { ownerUserId: 1, ownerEmail: 'owner@b.c' };
  assert.equal(rules.supportSenderLabel({ senderUserId: 1 }, t, user('1')), 'You');
  assert.equal(rules.supportSenderLabel({ senderUserId: 9 }, t, user('1')), 'Support');
  assert.equal(rules.supportSenderLabel({ senderUserId: 1 }, t, user('9', 'full', [], ['SuperAdmin'])), 'owner@b.c');
  assert.equal(rules.supportSenderLabel({ senderUserId: 9 }, t, user('9', 'full', [], ['SuperAdmin'])), 'You');
});
