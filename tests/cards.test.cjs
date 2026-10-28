// Run with: node --test tests/*.test.cjs
// Guide 11-b cards: routes, receipt, replacement rules, validity and admin actions.
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

const service = load('services/cardService.ts');
const rules = load('utility/cardRules.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

test('member routes: list, detail, receipt (no body) and subject-specific replacement', async () => {
  await service.listMyCards();
  await service.listMyCards({ status: 'dispatched' }, 2);
  await service.getCard(30);
  await service.receiveCard(30);
  await service.requestCardReplacement({ id: 30, subjectType: 'personal' }, 'damaged');
  await service.requestCardReplacement({ id: 31, subjectType: 'employee' }, 'lost');
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/cards/me', 'get /api/cards/me', 'get /api/cards/30', 'post /api/cards/30/receive',
    'post /api/card-requests/personal/replacement', 'post /api/card-requests/employee/replacement',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[1].params), { status: 'dispatched', page: 2, pageSize: 20 });
  assert.equal(calls[3].body, undefined, 'Receipt has no body');
  assert.deepEqual(plain(calls[4].body), { cardId: 30, reason: 'damaged' });
  assert.deepEqual(plain(calls[5].body), { cardId: 31, reason: 'lost' });
  assert.throws(() => service.requestCardReplacement({ id: 30, subjectType: 'personal' }, 'stolen'), /expired, damaged or lost/);
});

test('admin routes: issue, actions with audit reasons, and 1-20 year settings', async () => {
  await service.adminIssueCard(6);
  await service.adminListCards({ ownerUserId: 5, status: 'issued' });
  await service.adminGetCard(30);
  await service.adminCardAction(30, { action: 'dispatch', carrier: ' Australia Post ', trackingReference: ' AP123 ' });
  await service.adminCardAction(30, { action: 'reissue', reason: ' Damaged in transit ' });
  await service.adminGetCardSettings();
  await service.adminUpdateCardSettings({ validityYears: 3 });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'post /api/admin/card-requests/6/issue', 'get /api/admin/cards', 'get /api/admin/cards/30', 'post /api/admin/cards/30/action',
    'post /api/admin/cards/30/action', 'get /api/admin/card-settings', 'put /api/admin/card-settings',
  ]);
  assert.deepEqual(plain(calls[1].params), { ownerUserId: 5, status: 'issued', page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[3].body), { action: 'dispatch', reason: null, carrier: 'Australia Post', trackingReference: 'AP123' });
  assert.deepEqual(plain(calls[4].body), { action: 'reissue', reason: 'Damaged in transit', carrier: null, trackingReference: null });
  assert.deepEqual(plain(calls[6].body), { validityYears: 3 });
  for (const action of ['delivery_failed', 'resend', 'reissue', 'receive', 'void']) {
    assert.throws(() => service.adminCardAction(30, { action, reason: ' ' }), /audit reason/, `${action} needs a reason`);
  }
  for (const years of [0, 21, 1.5]) assert.throws(() => service.adminUpdateCardSettings({ validityYears: years }), /1 to 20/);
});

const now = Date.parse('2030-06-01T00:00:00Z');
const card = (overrides = {}) => ({
  id: 30, ownerUserId: 5, subjectType: 'personal', status: 'received', isValid: true,
  receivedAtUtc: '2030-01-10T00:00:00Z', invalidatedAtUtc: null, expiresAtUtc: '2031-01-01T00:00:00Z', ...overrides,
});
const owner = (permissions = ['cards.view', 'cards.manage', 'card-requests.manage', 'employees.manage']) =>
  ({ id: '5', accessLevel: 'full', roles: [], permissions, profileCompletionRequired: false });

test('usable only when received, valid, not invalidated and unexpired', () => {
  assert.equal(rules.isCardUsable(card(), now), true);
  assert.equal(rules.isCardUsable(card({ receivedAtUtc: null, status: 'dispatched' }), now), false, 'Status alone is not proof');
  assert.equal(rules.isCardUsable(card({ isValid: false }), now), false);
  assert.equal(rules.isCardUsable(card({ invalidatedAtUtc: '2030-05-01T00:00:00Z' }), now), false);
  assert.equal(rules.isCardUsable(card({ expiresAtUtc: '2030-05-31T00:00:00Z' }), now), false);
  assert.equal(rules.cardValidityText(card(), now), 'Valid');
  assert.equal(rules.cardValidityText(card({ receivedAtUtc: null, status: 'issued' }), now), 'Not yet received');
  assert.equal(rules.cardValidityText(card({ status: 'voided', isValid: false, invalidatedAtUtc: '2030-05-01T00:00:00Z' }), now), 'No longer valid');
  assert.equal(rules.cardValidityText(card({ expiresAtUtc: '2030-05-31T00:00:00Z' }), now), 'Expired');
});

test('receipt: only the owner, only once dispatched, never automatic', () => {
  assert.equal(rules.cardActions(card({ status: 'dispatched', receivedAtUtc: null }), owner(), null, now).receive, true);
  for (const status of ['issued', 'delivery_failed', 'received']) {
    assert.equal(rules.cardActions(card({ status, receivedAtUtc: null }), owner(), null, now).receive, false, `${status}: no receipt`);
  }
  assert.equal(rules.cardActions(card({ status: 'dispatched', receivedAtUtc: null }), { ...owner(), id: '6' }, null, now).receive, false);
  assert.equal(rules.cardActions(card({ status: 'dispatched', receivedAtUtc: null }), owner(['cards.view']), null, now).receive, false);
});

test('replacement reasons: received cards only; renewal within 30 days; damaged while usable; lost always', () => {
  const reasons = (overrides, user = owner(), type = null) => plain(rules.cardActions(card(overrides), user, type, now).replacementReasons);
  assert.deepEqual(reasons({}), ['damaged', 'lost'], 'Early renewal not yet open');
  assert.deepEqual(reasons({ expiresAtUtc: '2030-06-20T00:00:00Z' }), ['expired', 'damaged', 'lost'], 'Within 30 days of expiry');
  assert.deepEqual(reasons({ expiresAtUtc: '2030-05-01T00:00:00Z', status: 'expired' }), ['expired', 'lost']);
  assert.deepEqual(reasons({ receivedAtUtc: null, status: 'delivery_failed' }), [], 'Not received: SuperAdmin handles it');
  assert.deepEqual(reasons({ status: 'replaced', isValid: false }), [], 'Already superseded');
  assert.deepEqual(reasons({ status: 'voided', isValid: false, invalidatedAtUtc: '2030-05-01T00:00:00Z' }), ['lost'], 'Historically received');
  assert.deepEqual(reasons({ subjectType: 'employee' }, owner(), 'individual'), [], 'Employee cards need a provider type');
  assert.deepEqual(reasons({ subjectType: 'employee' }, owner(['card-requests.manage']), 'builder'), [], 'and employees.manage');
  assert.deepEqual(reasons({ subjectType: 'employee' }, owner(), 'builder'), ['damaged', 'lost']);
  assert.deepEqual(reasons({}, owner(['cards.view'])), []);
});

test('gates: owners view with cards.view; only SuperAdmin manages issuance', () => {
  assert.equal(access.canViewCards(owner(['cards.view'])), true);
  assert.equal(access.canViewCards(owner([])), false);
  assert.equal(access.canManageCardsAsAdmin(owner()), false);
  assert.equal(access.canManageCardsAsAdmin({ ...owner([]), roles: ['SuperAdmin'] }), true);
  assert.match(rules.REPLACEMENT_EFFECTS.lost, /cancelled straight away/);
});
