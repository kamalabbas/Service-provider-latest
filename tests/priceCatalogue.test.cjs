// Run with: node --test tests/*.test.cjs
// Guide 13 price catalogue: routes, filters, price rules, manager actions and delegated permissions.
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
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, module.exports);
  return module.exports;
}

const service = load('services/priceCatalogueService.ts');
const rules = load('utility/priceCatalogueRules.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

const prices = { name: ' Switchboard upgrade ', description: ' ', guidePrice: 1200, minProviderPrice: 900.5, maxProviderPrice: 1800 };

test('member routes: empty filters omitted, search trimmed', async () => {
  await service.listPriceCatalogue();
  await service.listPriceCatalogue({ search: ' switch ', occupationCode: 'electrical' }, 2);
  await service.listPriceCatalogue({ search: '   ' });
  await service.getPriceCatalogueItem(8);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/price-catalogue', 'get /api/price-catalogue', 'get /api/price-catalogue', 'get /api/price-catalogue/8',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[1].params), { occupationCode: 'electrical', search: 'switch', page: 2, pageSize: 20 });
  assert.deepEqual(plain(calls[2].params), { page: 1, pageSize: 20 });
});

test('management routes: create with code and occupation, update without them', async () => {
  await service.adminListPriceCatalogue({ status: 'retired' });
  await service.adminGetPriceCatalogueItem(8);
  await service.adminCreatePriceCatalogueItem({ code: 'ELEC_SWB-01', occupationCode: 'electrical', ...prices });
  await service.adminUpdatePriceCatalogueItem(8, prices);
  await service.adminGetPriceCatalogueHistory(8, 2);
  await service.adminPublishPriceCatalogueItem(8);
  await service.adminRetirePriceCatalogueItem(8);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/price-catalogue', 'get /api/admin/price-catalogue/8', 'post /api/admin/price-catalogue',
    'put /api/admin/price-catalogue/8', 'get /api/admin/price-catalogue/8/history',
    'post /api/admin/price-catalogue/8/publish', 'post /api/admin/price-catalogue/8/retire',
  ]);
  assert.deepEqual(plain(calls[0].params), { status: 'retired', page: 1, pageSize: 20 });
  const expected = { name: 'Switchboard upgrade', description: null, guidePrice: 1200, minProviderPrice: 900.5, maxProviderPrice: 1800 };
  assert.deepEqual(plain(calls[2].body), { code: 'ELEC_SWB-01', occupationCode: 'electrical', ...expected });
  assert.deepEqual(plain(calls[3].body), expected, 'Code and occupation are immutable');
  assert.deepEqual(plain(calls[4].params), { page: 2, pageSize: 20 });
  assert.equal(calls[5].body, undefined);
});

test('local checks: code pattern, inverted range, precision and positive prices', () => {
  for (const code of ['elec', 'E', '1ELEC', 'ELEC SWB', 'E'.repeat(31)]) {
    assert.throws(() => service.adminCreatePriceCatalogueItem({ code, occupationCode: 'electrical', ...prices }), /code/, code);
  }
  assert.throws(() => service.adminUpdatePriceCatalogueItem(8, { ...prices, guidePrice: 2000 }), /between the minimum and maximum/);
  assert.throws(() => service.adminUpdatePriceCatalogueItem(8, { ...prices, minProviderPrice: 1300 }), /between the minimum and maximum/);
  assert.throws(() => service.adminUpdatePriceCatalogueItem(8, { ...prices, guidePrice: 1200.005 }), /two decimal places/);
  assert.throws(() => service.adminUpdatePriceCatalogueItem(8, { ...prices, minProviderPrice: 0 }), /AUD/);
  assert.equal(calls.length, 0);
  assert.deepEqual(plain(rules.checkedPrices({ ...prices, minProviderPrice: 1200, maxProviderPrice: 1200 })).guidePrice, 1200, 'Equal bounds are allowed');
});

test('provider average is separate from the guide price; no data is not zero', () => {
  assert.equal(rules.providerAverageText({ providerAveragePrice: null, providerSubmissionCount: 0 }), 'No provider prices yet');
  assert.match(rules.providerAverageText({ providerAveragePrice: 1150.5, providerSubmissionCount: 1 }), /^Providers average .*1,150\.50 \(1 price\)$/);
  assert.match(rules.providerAverageText({ providerAveragePrice: 1000, providerSubmissionCount: 4 }), /\(4 prices\)$/);
  assert.match(rules.priceRangeText({ minProviderPrice: 900, maxProviderPrice: 1800 }), /900\.00 – .*1,800\.00/);
});

const user = (permissions, roles = []) => ({ id: '1', accessLevel: 'full', roles, permissions, profileCompletionRequired: false });

test('manager actions follow the state table and delegated permissions', () => {
  const manager = user(['price-catalogue-admin.view', 'price-catalogue.manage', 'price-catalogue.delete']);
  assert.deepEqual(plain(rules.catalogueManagerActions({ status: 'pending' }, manager)), { edit: true, publish: true, retire: true });
  assert.deepEqual(plain(rules.catalogueManagerActions({ status: 'published' }, manager)), { edit: true, publish: false, retire: true });
  assert.deepEqual(plain(rules.catalogueManagerActions({ status: 'retired' }, manager)), { edit: false, publish: true, retire: false }, 'Republish before editing');
  assert.deepEqual(plain(rules.catalogueManagerActions({ status: 'pending' }, user(['price-catalogue.manage']))), { edit: true, publish: true, retire: false });
  assert.deepEqual(plain(rules.catalogueManagerActions({ status: 'pending' }, user(['price-catalogue.delete']))), { edit: false, publish: false, retire: true });
  assert.deepEqual(plain(rules.catalogueManagerActions({ status: 'pending' }, user([], ['SuperAdmin']))), { edit: true, publish: true, retire: true }, 'SuperAdmin bypasses');
  assert.equal(access.canViewPriceCatalogue(user(['price-catalogue.view'])), true);
  assert.equal(access.canViewPriceCatalogueAdmin(user(['price-catalogue-admin.view'])), true, 'Delegated, not SuperAdmin-only');
  assert.equal(access.canViewPriceCatalogueAdmin(user(['price-catalogue.view'])), false);
});
