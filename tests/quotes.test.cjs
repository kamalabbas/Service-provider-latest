// Run with: node --test tests/*.test.cjs
// Guide 09 quotes: routes, amount/expiry rules, decisions, private PDFs and gates.
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
const apiFiles = {
  documentForm: file => ({ document: file.name }),
  uploadApiFile: async (method, url, form) => { calls.push({ method, url, form }); return { traceId: 'trace', code: 'Success', data: null }; },
  downloadPrivatePdf: async url => { calls.push({ method: 'download', url }); return { data: new ArrayBuffer(1), fileName: 'quote.pdf' }; },
};

const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, encodeURIComponent, ArrayBuffer,
    require: id => {
      if (id === './api') return api;
      if (id === './apiFiles') return apiFiles;
      if (id === 'yup') return require('yup');
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, module.exports);
  return module.exports;
}

const service = load('services/quoteService.ts');
const rules = load('utility/quoteRules.ts');
const access = load('utility/access.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; });

const create = { inspectionId: 4, totalAmount: 1250.5, note: ' Parts and labour ', expiresAt: '2030-01-08T17:00:00+10:00' };

test('member routes: list filters, create, decisions and PDFs', async () => {
  await service.listMyQuotes();
  await service.listMyQuotes({ side: 'customer', status: 'pending' }, 2);
  await service.getQuote(3);
  await service.createQuote(create);
  await service.acceptQuote(3);
  await service.rejectQuote(3, { reason: ' Too high ' });
  await service.withdrawQuote(3);
  await service.uploadQuotePdf(3, { name: 'q.pdf' });
  await service.downloadQuotePdf('/api/quotes/3/pdf');
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/quotes/me', 'get /api/quotes/me', 'get /api/quotes/3', 'post /api/quotes', 'post /api/quotes/3/accept',
    'post /api/quotes/3/reject', 'post /api/quotes/3/withdraw', 'put /api/quotes/3/pdf', 'download /api/quotes/3/pdf',
  ]);
  assert.deepEqual(plain(calls[0].params), { page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[1].params), { status: 'pending', side: 'customer', page: 2, pageSize: 20 });
  assert.deepEqual(plain(calls[3].body), { inspectionId: 4, totalAmount: 1250.5, note: 'Parts and labour', expiresAt: '2030-01-08T07:00:00.000Z' });
  assert.equal(calls[4].body, undefined, 'Accept has no body');
  assert.deepEqual(plain(calls[5].body), { reason: 'Too high' });
  assert.deepEqual(plain(calls[6].body), { reason: null });
  assert.deepEqual(plain(calls[7].form), { document: 'q.pdf' });
});

test('local checks: amount precision, expiry offset and PDF link are validated before sending', () => {
  assert.throws(() => service.createQuote({ ...create, totalAmount: 10.005 }), /two decimal places/);
  assert.throws(() => service.createQuote({ ...create, totalAmount: 0 }), /AUD/);
  assert.throws(() => service.createQuote({ ...create, expiresAt: '2030-01-08T17:00' }), /offset/);
  assert.throws(() => service.downloadQuotePdf('https://evil.example/pdf'), /isn't valid/);
  assert.equal(calls.length, 0);
});

test('admin routes need an audit reason', async () => {
  await service.adminListQuotes({ status: 'expired', customerUserId: 9 });
  await service.adminCreateQuote(create);
  await service.adminGetQuote(3);
  await service.adminDecideQuote(3, { action: 'withdraw', reason: ' Duplicate ' });
  await service.adminUploadQuotePdf(3, { name: 'q.pdf' });
  await service.adminDownloadQuotePdf(3);
  assert.deepEqual(plain(calls).map(call => `${call.method} ${call.url}`), [
    'get /api/admin/quotes', 'post /api/admin/quotes', 'get /api/admin/quotes/3', 'post /api/admin/quotes/3/decision',
    'put /api/admin/quotes/3/pdf', 'download /api/admin/quotes/3/pdf',
  ]);
  assert.deepEqual(plain(calls[0].params), { status: 'expired', customerUserId: 9, page: 1, pageSize: 20 });
  assert.deepEqual(plain(calls[3].body), { action: 'withdraw', reason: 'Duplicate' });
  assert.throws(() => service.adminDecideQuote(3, { action: 'accept', reason: '' }), /audit reason/);
});

const user = (id, permissions = ['quotes.view', 'quotes.manage', 'quotes.delete']) =>
  ({ id, accessLevel: 'full', roles: [], permissions, profileCompletionRequired: false });
const now = Date.parse('2030-01-01T00:00:00Z');
const quote = (overrides = {}) => ({ status: 'pending', expiresAtUtc: '2030-01-02T00:00:00Z', canAccept: true, providerUserId: 20, customerUserId: 10, ...overrides });
const enabled = actions => Object.entries(plain(actions)).filter(([, on]) => on).map(([name]) => name).sort();

test('decision matrix: customer accepts/rejects, provider withdraws/uploads, only while open', () => {
  assert.deepEqual(enabled(rules.quoteActions(quote(), user('10'), now)), ['accept', 'reject']);
  assert.deepEqual(enabled(rules.quoteActions(quote(), user('20'), now)), ['uploadPdf', 'withdraw']);
  assert.deepEqual(enabled(rules.quoteActions(quote({ canAccept: false }), user('10'), now)), ['reject'], 'canAccept is advisory but respected');
  assert.deepEqual(enabled(rules.quoteActions(quote({ expiresAtUtc: '2029-12-31T23:59:00Z' }), user('10'), now)), [], 'Past the deadline');
  for (const status of ['accepted', 'rejected', 'withdrawn', 'expired']) {
    assert.deepEqual(enabled(rules.quoteActions(quote({ status }), user('20'), now)), [], `${status} is final and locks the PDF`);
  }
  assert.deepEqual(enabled(rules.quoteActions(quote(), user('99'), now)), [], 'Permissions never make an outsider a participant');
  assert.deepEqual(enabled(rules.quoteActions(quote(), user('10', ['quotes.view', 'quotes.delete']), now)), ['reject']);
  assert.deepEqual(enabled(rules.quoteActions(quote(), user('20', ['quotes.view', 'quotes.manage']), now)), ['uploadPdf']);
  assert.equal(access.canViewQuotes(user('1', ['quotes.view'])), true);
  assert.equal(access.canViewQuotes(user('1', [])), false);
});

test('issuing: only the provider of a completed or rated inspection with quotes.manage', () => {
  const inspection = status => ({ status, requesterUserId: 10, providerUserId: 20 });
  assert.equal(rules.canIssueQuoteFor(inspection('completed'), user('20')), true);
  assert.equal(rules.canIssueQuoteFor(inspection('rated'), user('20')), true);
  assert.equal(rules.canIssueQuoteFor(inspection('accepted'), user('20')), false);
  assert.equal(rules.canIssueQuoteFor(inspection('completed'), user('10')), false, 'The customer cannot quote');
  assert.equal(rules.canIssueQuoteFor(inspection('completed'), user('20', ['quotes.view'])), false);
});

test('quote form: positive amount with 2 decimals, future expiry, optional note', async () => {
  const schema = rules.quoteSchema(() => now);
  const later = new Date(now + 86400000);
  assert.equal(await schema.isValid({ totalAmount: '1250.50', note: '', expiresAt: later }), true);
  assert.equal(await schema.isValid({ totalAmount: '1250.505', note: '', expiresAt: later }), false);
  assert.equal(await schema.isValid({ totalAmount: '0', note: '', expiresAt: later }), false);
  assert.equal(await schema.isValid({ totalAmount: '-5', note: '', expiresAt: later }), false);
  assert.equal(await schema.isValid({ totalAmount: '100', note: '', expiresAt: new Date(now - 1) }), false);
  assert.equal(await schema.isValid({ totalAmount: '100', note: '', expiresAt: null }), false);
  assert.deepEqual(plain(rules.toCreateQuoteRequest(4, { totalAmount: ' 99.9 ', note: ' ', expiresAt: later })),
    { inspectionId: 4, totalAmount: 99.9, note: null, expiresAt: '2030-01-02T00:00:00.000Z' });
  assert.equal(rules.defaultQuoteExpiry(new Date(now)).toISOString(), '2030-01-08T00:00:00.000Z');
});

test('countdown text and safe PDF file names', () => {
  assert.equal(rules.expiryText('2030-01-01T00:30:00Z', now), 'Expires in 30 min');
  assert.equal(rules.expiryText('2030-01-01T05:15:00Z', now), 'Expires in 5 h 15 min');
  assert.equal(rules.expiryText('2030-01-05T00:00:00Z', now), 'Expires in 4 days');
  assert.equal(rules.expiryText('2029-12-31T00:00:00Z', now), 'Expired');
  assert.equal(rules.isQuoteOpen(quote(), now), true);
  assert.equal(rules.quotePdfFileName('Q-2030/0001'), 'Q-2030_0001.pdf');
});
