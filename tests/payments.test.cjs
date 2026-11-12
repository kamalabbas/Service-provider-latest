// Run with: node --test tests/*.test.cjs
// Guide 21/22: payment routes and bodies, request-ID reuse, safe Stripe links, operation and plan
// rules, booking cancellation cutoff and the provider price list.
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

const secure = new Map();
const opened = [];
const stubs = {
  'expo-secure-store': {
    getItemAsync: async key => secure.get(key) ?? null,
    setItemAsync: async (key, value) => { secure.set(key, value); },
    deleteItemAsync: async key => { secure.delete(key); },
  },
  'expo-web-browser': { openBrowserAsync: async url => { opened.push(url); return { type: 'opened' }; } },
  yup: require('yup'),
};

const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const sandbox = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module: sandbox, exports: sandbox.exports, encodeURIComponent, URL, Intl, Promise,
    require: id => {
      if (id === './api') return api;
      if (id in stubs) return stubs[id];
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, sandbox.exports);
  return sandbox.exports;
}

const service = load('services/paymentService.ts');
const flow = load('services/paymentFlow.ts');
const rules = load('utility/paymentRules.ts');
const inspections = load('utility/inspectionRules.ts');
const prices = load('services/providerPriceService.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

const ID = '0f8c3c2a-1b2c-4d3e-8f4a-5b6c7d8e9f00';
test.beforeEach(() => { calls.length = 0; secure.clear(); opened.length = 0; });

test('member routes: account, plans, cards, operations and history', async () => {
  await service.getPaymentAccount();
  await service.listPaymentPlans();
  await service.listSavedCards();
  await service.getPaymentOperation(ID);
  await service.cancelPaymentOperation(ID, { requestId: ID, consentAccepted: false });
  await service.setDefaultSavedCard('pm_123');
  await service.removeSavedCard('pm_123');
  await service.listPaymentTransactions(2);
  await service.listPaymentConfirmations();
  await service.listInspectionRefunds();
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/payments/me', 'get /api/payments/plans', 'get /api/payments/cards', `get /api/payments/operations/${ID}`,
    `post /api/payments/operations/${ID}/cancel`, 'put /api/payments/cards/pm_123/default', 'delete /api/payments/cards/pm_123',
    'get /api/payments/transactions', 'get /api/payments/confirmations', 'get /api/payments/refunds',
  ]);
  assert.equal(calls[5].body, undefined, 'Set default has no body');
  assert.deepEqual(plain(calls[7].params), { page: 2, pageSize: 20 }, 'No userId filter is sent');
  assert.throws(() => service.getPaymentOperation('../me'), /request ID/);
  assert.throws(() => service.removeSavedCard('pm_1/../x'), /Unknown saved card/);
});

test('charging needs a request ID and explicit consent; plans are exact codes', async () => {
  await service.startSubscriptionCheckout({ requestId: ID, consentAccepted: true, planCode: 'provider' });
  await service.upgradeSubscriptionPlan({ requestId: ID, consentAccepted: true });
  await service.setupSavedCard({ requestId: ID, consentAccepted: true });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'post /api/payments/subscriptions/checkout', 'post /api/payments/subscriptions/change', 'post /api/payments/cards/setup',
  ]);
  assert.deepEqual(plain(calls[0].body), { requestId: ID, consentAccepted: true, planCode: 'provider' });
  assert.deepEqual(plain(calls[1].body), { requestId: ID, consentAccepted: true, planCode: 'provider' }, 'Upgrade is always to Provider');
  assert.equal(service.cancelSubscriptionRenewal, undefined, 'Guide 23: no renewal cancellation; terms are one-off payments');
  assert.throws(() => service.startSubscriptionCheckout({ requestId: ID, consentAccepted: false, planCode: 'provider' }), /Agree/);
  assert.throws(() => service.startSubscriptionCheckout({ requestId: ID, consentAccepted: true, planCode: 'gold' }), /Choose a plan/);
  assert.throws(() => service.setupSavedCard({ requestId: ID, consentAccepted: false }), /Agree/);
  assert.throws(() => service.startSubscriptionCheckout({ requestId: '', consentAccepted: true, planCode: 'provider' }), /request ID/);
});

test('inspection checkout: trimmed visit address; a free credit may omit consent', async () => {
  await service.startInspectionCheckout({ requestId: ID, consentAccepted: false, serviceId: 101, streetAddress: ' 10 Example St ', suburb: ' Sydney', regionCode: 'NSW', postalCode: '2000 ', note: '  ' });
  assert.equal(calls[0].url, '/api/payments/inspections/checkout');
  assert.deepEqual(plain(calls[0].body), {
    requestId: ID, consentAccepted: false, serviceId: 101, streetAddress: '10 Example St', suburb: 'Sydney', regionCode: 'NSW', postalCode: '2000', note: null,
  });
  assert.throws(() => service.startInspectionCheckout({ requestId: ID, consentAccepted: true, serviceId: 0, streetAddress: 'a', suburb: 'b', regionCode: 'NSW', postalCode: '1' }), /database ID/);
});

test('request IDs: reused for identical input until the server answers; new for new input', async () => {
  let next = 0;
  const create = () => [ID, '1f8c3c2a-1b2c-4d3e-8f4a-5b6c7d8e9f00'][next++];
  const first = await flow.requestIdFor('inspection', 'input-a', '7', create);
  assert.equal(await flow.requestIdFor('inspection', 'input-a', '7', create), first, 'A retry after a lost response reuses it');
  const changed = await flow.requestIdFor('inspection', 'input-b', '7', create);
  assert.notEqual(changed, first, 'Different input never reuses the ID');
  await flow.clearSubmit('inspection', '7');
  next = 0;
  assert.equal(await flow.requestIdFor('inspection', 'input-b', '7', create), ID, 'Spent after an answer');
  assert.equal((await flow.listPendingOperations('7')).length, 0);
  await flow.rememberOperation({ operationId: ID, kind: 'inspection', label: 'Inspection', userId: '7', startedAtUtc: 'now' });
  assert.equal((await flow.listPendingOperations('7')).length, 1);
  assert.equal((await flow.listPendingOperations('8')).length, 0, 'Per account');
  await flow.forgetOperation(ID);
  assert.equal((await flow.listPendingOperations('7')).length, 0);
});

test('only https Stripe pages are opened for payment', async () => {
  for (const url of ['https://checkout.stripe.com/c/pay/cs_test_1', 'https://invoice.stripe.com/i/acct/x']) {
    assert.equal(rules.isTrustedPaymentUrl(url), true, url);
  }
  for (const url of ['http://checkout.stripe.com/c', 'https://checkout.stripe.com.evil.example/c', 'https://evil.example/?u=checkout.stripe.com',
    'https://user:pw@checkout.stripe.com/c', 'javascript:alert(1)', '', null]) {
    assert.equal(rules.isTrustedPaymentUrl(url), false, String(url));
  }
  await flow.openPaymentPage('https://checkout.stripe.com/c/pay/cs_test_1');
  assert.deepEqual(opened, ['https://checkout.stripe.com/c/pay/cs_test_1']);
  await assert.rejects(flow.openPaymentPage('https://evil.example/pay'), /secure Stripe page/);
  assert.equal(opened.length, 1, 'Refused links are never opened');
  assert.equal(rules.isTrustedReceiptUrl('https://pay.stripe.com/receipts/x'), true);
  assert.equal(rules.isTrustedReceiptUrl('https://example.com/receipt'), false);
});

test('operation outcomes: polling until settled; refund-required success is explained', () => {
  for (const status of ['queued', 'processing', 'requires_action']) assert.equal(rules.isOperationSettled({ status }), false, status);
  for (const status of ['succeeded', 'failed', 'review_required']) assert.equal(rules.isOperationSettled({ status }), true, status);
  assert.equal(rules.operationView({ status: 'succeeded', refundRequired: false }).tone, 'success');
  assert.match(rules.operationView({ status: 'succeeded', refundRequired: true }).text, /refunded automatically/);
  assert.match(rules.operationView({ status: 'review_required', refundRequired: false }).text, /don't need to pay again/);
  assert.match(rules.operationView({ status: 'failed', refundRequired: false, errorCode: 'card_declined' }).text, /card_declined/);
});

test('money in cents: formatted as AUD including zero', () => {
  assert.match(rules.formatMinor(500), /5\.00/);
  assert.match(rules.formatMinor(0), /0\.00/);
  assert.equal(rules.formatMinor(null), '—');
});

const plan = (code, overrides = {}) => ({ code, name: code, description: '', isAvailable: true, isEligible: true,
  prices: [{ id: 1, channel: 'stripe', amountMinor: code === 'provider' ? 5000 : 100, currency: 'AUD', isPublished: true, createdAtUtc: 'x' }], ...overrides });
const sub = overrides => ({ subscription: { termId: 601, channel: 'stripe', planCode: 'price_list', status: 'active', paidFromUtc: '2030-11-12T10:00:00Z',
  paidUntilUtc: '2031-11-12T10:00:00Z', canRenew: false, canUpgrade: true, upcomingPlanCode: null, upcomingStartsAtUtc: null, upcomingPaidUntilUtc: null, ...overrides } });

test('annual terms (guide 23): buy, renew in the last 30 days, upgrade, next year, one prepaid term', () => {
  assert.equal(rules.planAction(plan('provider'), { subscription: null }), 'subscribe');
  assert.equal(rules.planAction(plan('provider'), sub()), 'upgrade', 'canUpgrade');
  assert.equal(rules.planAction(plan('provider'), sub({ canUpgrade: false })), 'unavailable');
  assert.equal(rules.planAction(plan('price_list'), sub()), 'current', 'Renewal not open yet');
  assert.equal(rules.planAction(plan('price_list'), sub({ canRenew: true })), 'renew');
  assert.equal(rules.planAction(plan('price_list'), sub({ planCode: 'provider', canRenew: true })), 'next_year', 'A lower plan for next year');
  assert.equal(rules.planAction(plan('price_list'), sub({ planCode: 'provider' })), 'unavailable', 'Not before renewal opens');
  assert.equal(rules.planAction(plan('price_list'), sub({ canRenew: true, upcomingPlanCode: 'price_list' })), 'prepaid', 'One following term only');
  assert.equal(rules.planAction(plan('provider'), sub({ canRenew: true, upcomingPlanCode: 'price_list' })), 'unavailable');
  assert.equal(rules.planAction(plan('provider', { isEligible: false }), { subscription: null }), 'unavailable', 'Provider is for tradespeople');
  assert.equal(rules.planAction(plan('provider', { prices: [] }), { subscription: null }), 'unavailable');
  assert.equal(rules.planAction(plan('provider'), sub({ channel: 'app_store' })), 'unavailable', 'Another channel must end first');
  assert.equal(rules.planAction(plan('provider'), sub({ status: 'expired' })), 'subscribe', 'An expired plan can be bought again');
  assert.match(rules.subscriptionSummary(sub().subscription), /renew automatically/);
  assert.match(rules.subscriptionSummary(sub({ canRenew: true }).subscription), /renew now/);
  assert.match(rules.subscriptionSummary(sub({ upcomingPlanCode: 'price_list', upcomingStartsAtUtc: '2031-11-12T10:00:00Z', upcomingPaidUntilUtc: '2032-11-12T10:00:00Z' }).subscription,
    [plan('price_list', { name: 'Price list' })]), /Next year is paid: Price list/);
  assert.match(rules.subscriptionSummary(sub({ status: 'suspended' }).subscription), /paused/);
  assert.match(rules.subscriptionSummary(sub({ status: 'expired' }).subscription), /ended/);
  assert.match(rules.renewalReminder(sub({ canRenew: true })), /Renew now/);
  assert.equal(rules.renewalReminder(sub()), null);
  assert.equal(rules.renewalReminder(sub({ canRenew: true, upcomingPlanCode: 'provider' })), null, 'Already prepaid');
  assert.equal(rules.renewalReminder({ subscription: null }), null);
});

test('operation outcomes for annual access: until date, free upgrade, refunded activation', () => {
  assert.match(rules.operationView({ status: 'succeeded', refundRequired: false, amountMinor: 0, accessEndsAtUtc: '2031-11-12T10:00:00Z' }).title, /free/);
  assert.match(rules.operationView({ status: 'succeeded', refundRequired: false, amountMinor: 5000, accessEndsAtUtc: '2031-11-12T10:00:00Z' }).text, /access runs until/);
  assert.match(rules.operationView({ status: 'succeeded', refundRequired: true, refundStatus: 'succeeded' }).text, /was refunded/);
  assert.match(rules.operationView({ status: 'succeeded', refundRequired: true, refundStatus: 'processing' }).text, /being refunded/);
});

test('gates: reads and stopping renewal work during setup; buying needs full access', () => {
  const setup = { id: '1', accessLevel: 'profile_setup', roles: [], permissions: [], profileCompletionRequired: true };
  const full = perms => ({ id: '1', accessLevel: 'full', roles: [], permissions: perms, profileCompletionRequired: false });
  assert.equal(access.canViewPayments(setup), true);
  assert.equal(access.canDeletePayments(setup), true);
  assert.equal(access.canManagePayments(setup), false);
  assert.equal(access.canManagePayments(full(['payments.manage'])), true);
  assert.equal(access.canViewPayments(full([])), false);
});

test('booking cancellation: participants before the scheduled time; the server verdict wins', () => {
  const now = Date.parse('2030-06-01T10:00:00Z');
  const user = { id: '1', accessLevel: 'full', roles: [], permissions: ['inspections.view', 'inspections.manage', 'inspections.delete'], profileCompletionRequired: false };
  const inspection = overrides => ({ status: 'accepted', isHidden: false, requesterUserId: 1, providerUserId: 2, scheduledAtUtc: '2030-06-02T10:00:00Z', canCancel: true, ...overrides });
  assert.equal(inspections.inspectionActions(inspection(), user, now).cancel, true);
  assert.equal(inspections.inspectionActions(inspection({ scheduledAtUtc: '2030-06-01T10:00:00Z' }), user, now).cancel, false, 'At the scheduled time');
  assert.equal(inspections.inspectionActions(inspection({ canCancel: false }), user, now).cancel, false, 'Server says no');
  assert.equal(inspections.inspectionActions(inspection({ status: 'pending', scheduledAtUtc: null }), user, now).cancel, true);
  assert.match(inspections.lateCancelNote(inspection({ scheduledAtUtc: '2030-06-01T09:00:00Z' }), now), /Contact support/);
  assert.equal(inspections.lateCancelNote(inspection(), now), null);
});

test('provider price list: current route', async () => {
  await prices.listCurrentProviderPrices(2);
  assert.equal(calls[0].url, '/api/provider-prices/current');
  assert.deepEqual(plain(calls[0].params), { page: 2, pageSize: 20 });
});
