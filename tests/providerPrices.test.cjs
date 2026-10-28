// Run with: node --test tests/*.test.cjs
// Guide 14 provider prices: routes, filter defaults, yearly-row actions, ranges and item requests.
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
    module, exports: module.exports, encodeURIComponent, Intl,
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

const service = load('services/providerPriceService.ts');
const rules = load('utility/providerPriceRules.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

test('member price routes: no year in the body; PUT edits; withdraw and restore', async () => {
  await service.listMyProviderPrices();
  await service.listMyProviderPrices({ businessId: 3, itemId: 8, year: 2030, includeArchived: false, includeWithdrawn: false }, 2);
  await service.listAvailablePriceItems();
  await service.getProviderPrice(5);
  await service.getProviderPriceHistory(5);
  await service.submitProviderPrice({ itemId: 8, price: 1150.5 });
  await service.updateProviderPrice(5, { price: 1200 });
  await service.withdrawProviderPrice(5);
  await service.restoreProviderPrice(5, { price: 1100 });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/provider-prices/me', 'get /api/provider-prices/me', 'get /api/provider-prices/available-items',
    'get /api/provider-prices/5', 'get /api/provider-prices/5/history', 'post /api/provider-prices',
    'put /api/provider-prices/5', 'post /api/provider-prices/5/withdraw', 'post /api/provider-prices/5/restore',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 }, 'Server defaults include archived and withdrawn');
  assert.deepEqual(plain(calls[1].params), { businessId: 3, itemId: 8, year: 2030, includeArchived: false, includeWithdrawn: false, page: 2, pageSize: 20 });
  assert.deepEqual(plain(calls[5].body), { itemId: 8, price: 1150.5 });
  assert.deepEqual(plain(calls[6].body), { price: 1200 });
  assert.equal(calls[7].body, undefined);
  assert.deepEqual(plain(calls[8].body), { price: 1100 });
  assert.throws(() => service.submitProviderPrice({ itemId: 8, price: 10.005 }), /two decimal places/);
  assert.throws(() => service.listMyProviderPrices({ year: 2019 }), /2020 to 9999/);
});

test('item requests: trimmed proposals; admin approve/reject rules', async () => {
  await service.listMyPriceItemRequests({ status: 'pending' });
  await service.getPriceItemRequest(4);
  await service.getPriceItemRequestHistory(4);
  await service.createPriceItemRequest({ occupationCode: 'electrical', proposedName: ' Fan install ', proposedDescription: ' ', suggestedPrice: 250 });
  await service.adminApprovePriceItemRequest(4, { code: 'ELEC_FAN', name: 'Fan installation', guidePrice: 250, minProviderPrice: 150, maxProviderPrice: 400 });
  await service.adminRejectPriceItemRequest(4, { reason: ' Duplicate ' });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/provider-prices/item-requests/me', 'get /api/provider-prices/item-requests/4', 'get /api/provider-prices/item-requests/4/history',
    'post /api/provider-prices/item-requests', 'post /api/admin/provider-prices/item-requests/4/approve', 'post /api/admin/provider-prices/item-requests/4/reject',
  ]);
  assert.deepEqual(plain(calls[0].params), { status: 'pending', page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[3].body), { occupationCode: 'electrical', proposedName: 'Fan install', proposedDescription: null, suggestedPrice: 250 });
  assert.deepEqual(plain(calls[4].body), { code: 'ELEC_FAN', name: 'Fan installation', description: null, guidePrice: 250, minProviderPrice: 150, maxProviderPrice: 400 });
  assert.deepEqual(plain(calls[5].body), { reason: 'Duplicate' });
  assert.throws(() => service.adminRejectPriceItemRequest(4, { reason: '  ' }), /reason/);
  assert.throws(() => service.adminApprovePriceItemRequest(4, { code: 'bad', name: 'x', guidePrice: 1, minProviderPrice: 1, maxProviderPrice: 1 }), /code/);
  assert.throws(() => service.adminApprovePriceItemRequest(4, { code: 'ELEC_FAN', name: 'x', guidePrice: 500, minProviderPrice: 150, maxProviderPrice: 400 }), /between/);
});

test('admin price routes target IDs and businesses', async () => {
  await service.adminListProviderPrices({ year: 2030 });
  await service.adminSubmitProviderPrice(3, { itemId: 8, price: 100 });
  await service.adminCreatePriceItemRequest(3, { occupationCode: 'electrical', proposedName: 'Fan' });
  await service.adminListPriceItemRequests({ providerUserId: 20, status: 'approved' });
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/provider-prices', 'post /api/admin/provider-prices/businesses/3',
    'post /api/admin/provider-prices/businesses/3/item-requests', 'get /api/admin/provider-prices/item-requests',
  ]);
  assert.deepEqual(plain(calls[3].params), { providerUserId: 20, status: 'approved', page: 1, pageSize: 20 });
});

const now = Date.parse('2030-06-01T00:00:00Z');
const owner = (permissions = ['prices.view', 'prices.manage', 'prices.delete']) => ({ id: '20', accessLevel: 'full', roles: [], permissions, profileCompletionRequired: false });
const row = overrides => ({
  id: 1, businessId: 3, itemId: 8, providerUserId: 20, calendarYear: 2030, withdrawnAtUtc: null, itemStatus: 'published', businessArchivedAtUtc: null, ...overrides,
});
const actions = (target, rows = [target], user = owner(), type = 'builder') => plain(rules.providerPriceActions(target, rows, user, type, now));

test('yearly rows: current year editable; older latest row can only be withdrawn', () => {
  assert.equal(rules.currentUtcYear(now), 2030);
  assert.deepEqual(actions(row()), { edit: true, restore: false, withdraw: true });
  assert.deepEqual(actions(row({ withdrawnAtUtc: '2030-05-01T00:00:00Z' })), { edit: false, restore: true, withdraw: false });
  const older = row({ id: 2, calendarYear: 2029 });
  assert.deepEqual(actions(older, [older]), { edit: false, restore: false, withdraw: true }, 'Latest older row');
  assert.deepEqual(actions(older, [older, row({ id: 3, calendarYear: 2030 })]), { edit: false, restore: false, withdraw: false }, 'Superseded by a newer year');
  assert.deepEqual(actions(row({ id: 4, calendarYear: 2029, withdrawnAtUtc: '2029-12-01T00:00:00Z' })), { edit: false, restore: false, withdraw: false }, 'Older rows cannot be restored');
});

test('retired items allow withdrawal only; archived history and ineligible providers are read-only', () => {
  assert.deepEqual(actions(row({ itemStatus: 'retired' })), { edit: false, restore: false, withdraw: true });
  assert.deepEqual(actions(row({ itemStatus: 'retired', withdrawnAtUtc: '2030-05-01T00:00:00Z' })), { edit: false, restore: false, withdraw: false });
  assert.deepEqual(actions(row({ businessArchivedAtUtc: '2030-05-01T00:00:00Z' })), { edit: false, restore: false, withdraw: false });
  assert.deepEqual(actions(row(), [row()], owner(), 'individual'), { edit: false, restore: false, withdraw: false }, 'View is not eligibility');
  assert.deepEqual(actions(row(), [row()], owner(['prices.view', 'prices.delete'])), { edit: false, restore: false, withdraw: true });
  assert.deepEqual(actions(row(), [row()], { ...owner(), id: '99' }), { edit: false, restore: false, withdraw: false });
  assert.equal(rules.canWriteProviderPrices(owner(), 'tradeperson'), true);
  assert.equal(rules.canWriteProviderPrices(owner(['prices.view']), 'tradeperson'), false);
  assert.equal(access.canViewProviderPrices(owner(['prices.view'])), true);
});

test('price range and suggestion form checks', async () => {
  const item = { minProviderPrice: 150, maxProviderPrice: 400 };
  assert.equal(rules.priceRangeError('250', item), null);
  assert.equal(rules.priceRangeError('150.00', item), null);
  assert.match(rules.priceRangeError('400.01', item), /within the allowed range/);
  assert.match(rules.priceRangeError('100', item), /within the allowed range/);
  assert.match(rules.priceRangeError('250.555', item), /2 decimal places/);
  const values = { occupationCode: 'electrical', proposedName: 'Fan', proposedDescription: '', suggestedPrice: '' };
  assert.equal(await rules.priceItemRequestSchema.isValid(values), true, 'Suggested price is optional');
  assert.equal(await rules.priceItemRequestSchema.isValid({ ...values, suggestedPrice: '0' }), false);
  assert.equal(await rules.priceItemRequestSchema.isValid({ ...values, proposedName: ' ' }), false);
});
