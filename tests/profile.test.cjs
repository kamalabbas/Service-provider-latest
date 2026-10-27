// Run with: node --test tests/*.test.cjs
// Guide 04 profiles: service contracts, form rules per member type, picture checks and access gates.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const calls = [];
const record = method => async (url, ...rest) => {
  calls.push({ method, url, body: method === 'put' ? rest[0] : undefined });
  return { traceId: 'trace', code: 'Success', data: null };
};
const api = { getData: record('get'), putData: record('put') };
const uploads = [];
const apiFiles = {
  pictureForm: file => ({ picture: file.name }),
  uploadApiFile: async (method, url, form) => { uploads.push({ method, url, form }); return { traceId: 'trace', code: 'Success', data: null }; },
};
// apiFiles.ts itself is loaded with a stub client so its local checks run for real.
const realModules = { 'yup': require('yup'), 'axios': require('axios') };
const stubs = { '@/services/api': { default: {} }, '@/stores/authStore': { useAuthStore: { getState: () => ({}) } } };

const modules = new Map();
function load(file, overrides = {}) {
  if (modules.has(file)) return modules.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, encodeURIComponent, FormData,
    require: id => {
      if (id in overrides) return overrides[id];
      if (id in realModules) return realModules[id];
      assert.ok(id.startsWith('@/'), `Unexpected module: ${id}`);
      return load(`${id.slice(2)}.ts`);
    },
  }, { filename: file });
  modules.set(file, module.exports);
  return module.exports;
}

const service = load('services/profileService.ts', { './api': api, './apiFiles': apiFiles });
const form = load('utility/profileForm.ts');
const access = load('utility/access.ts');
const { referenceOptions } = load('utility/referenceOptions.ts');
const { pictureForm } = load('services/apiFiles.ts', stubs);
const plain = value => JSON.parse(JSON.stringify(value));

test.beforeEach(() => { calls.length = 0; uploads.length = 0; });

test('member and SuperAdmin profile routes', async () => {
  const body = form.toSaveProfileRequest(form.profileFormValues(null), 'individual');
  const picture = { uri: 'file:///p.jpg', name: 'p.jpg', mimeType: 'image/jpeg', size: 10, width: 10, height: 10 };
  await service.getMyProfile();
  await service.saveMyProfile(body);
  await service.uploadMyProfilePicture(picture);
  await service.adminGetUserProfile(41);
  await service.adminSaveUserProfile(41, body);
  await service.adminGetUserProfileHistory(41);
  await service.adminUploadUserProfilePicture(41, picture);
  assert.deepEqual(calls.map(call => `${call.method} ${call.url}`), [
    'get /api/members/me/profile',
    'put /api/members/me/profile',
    'get /api/admin/users/41/profile',
    'put /api/admin/users/41/profile',
    'get /api/admin/users/41/profile/history',
  ]);
  assert.deepEqual(plain(uploads), [
    { method: 'put', url: '/api/members/me/profile/picture', form: { picture: 'p.jpg' } },
    { method: 'put', url: '/api/admin/users/41/profile/picture', form: { picture: 'p.jpg' } },
  ]);
  assert.throws(() => service.adminGetUserProfile(0), /database ID/);
});

const filled = (overrides = {}) => ({
  ...form.profileFormValues(null),
  firstName: ' Alex ', lastName: 'Taylor', mobilePhone: '+61 412 345 678', streetAddress: '10 Example Street',
  suburb: 'Sydney', regionCode: 'NSW', postalCode: '2000', ...overrides,
});
const errorsOf = async (values, type) => {
  try {
    await form.profileSchema(type).validate(values, { abortEarly: false });
    return [];
  } catch (error) {
    return error.inner.map(item => item.path);
  }
};

test('a null profile starts empty with the postal address the same; the flag is always sent', () => {
  const values = plain(form.profileFormValues(null));
  assert.equal(values.firstName, '');
  assert.equal(values.isPostalSameAsAddress, true);
  assert.deepEqual(values.occupations, []);
  const request = plain(form.toSaveProfileRequest(filled(), 'builder'));
  assert.equal(request.isPostalSameAsAddress, true);
  assert.equal(request.firstName, 'Alex');
  assert.equal(request.postalAddress, null);
  assert.equal(request.landlinePhone, null, 'Blank optional fields are sent as null');
});

test('every member type needs the common fields; only some need type-specific ones', async () => {
  for (const type of ['tradeperson', 'builder', 'individual', 'developer', 'public_government_sector']) {
    const missing = await errorsOf(form.profileFormValues(null), type);
    for (const field of ['firstName', 'lastName', 'mobilePhone', 'streetAddress', 'suburb', 'regionCode', 'postalCode']) {
      assert.ok(missing.includes(field), `${type} requires ${field}`);
    }
  }
  for (const type of ['builder', 'individual', 'developer']) assert.deepEqual(await errorsOf(filled(), type), []);
  assert.deepEqual(await errorsOf(filled(), 'tradeperson'), ['occupations']);
  assert.deepEqual(await errorsOf(filled(), 'public_government_sector'), ['governmentSectorName']);
  assert.deepEqual(await errorsOf(filled({ governmentSectorName: 'Health' }), 'public_government_sector'), []);
});

test('a different postal address needs all four postal fields', async () => {
  const different = filled({ isPostalSameAsAddress: false });
  assert.deepEqual(await errorsOf(different, 'individual'), ['postalAddress', 'postalSuburb', 'postalRegionCode', 'postalPostalCode']);
  const complete = filled({ isPostalSameAsAddress: false, postalAddress: 'PO Box 1', postalSuburb: 'Sydney', postalRegionCode: 'NSW', postalPostalCode: '2001' });
  assert.deepEqual(await errorsOf(complete, 'individual'), []);
  assert.equal(form.toSaveProfileRequest(complete, 'individual').postalAddress, 'PO Box 1');
});

test('tradeperson occupations: distinct, each with licence text; other types clear them', async () => {
  const one = { occupationCode: 'electrical_services', licence: 'L1' };
  assert.deepEqual(await errorsOf(filled({ occupations: [one] }), 'tradeperson'), []);
  assert.deepEqual(await errorsOf(filled({ occupations: [{ ...one, licence: '  ' }] }), 'tradeperson'), ['occupations[0].licence']);
  assert.deepEqual(await errorsOf(filled({ occupations: [one, one] }), 'tradeperson'), ['occupations']);
  const saved = filled({ occupations: [one], governmentSectorName: 'Health' });
  assert.deepEqual(plain(form.toSaveProfileRequest(saved, 'tradeperson').occupations), [one]);
  const asBuilder = plain(form.toSaveProfileRequest(saved, 'builder'));
  assert.deepEqual(asBuilder.occupations, [], 'Saving replaces the occupation set');
  assert.equal(asBuilder.governmentSectorName, null);
});

test('optional contact fields: valid email, absolute website, phone format', async () => {
  const bad = filled({ contactEmail: 'nope', website: 'example.com', landlinePhone: 'abc' });
  assert.deepEqual((await errorsOf(bad, 'individual')).sort(), ['contactEmail', 'landlinePhone', 'website']);
  assert.deepEqual(await errorsOf(filled({ contactEmail: 'a@b.com.au', website: 'https://b.com.au', landlinePhone: '(02) 9999 0000' }), 'individual'), []);
});

test('saved values reload as-is and a retired saved region stays visible but not selectable', () => {
  const profile = {
    ...filled(), firstName: 'Alex', isPostalSameAsAddress: false, postalAddress: 'PO Box 1', postalSuburb: 'Sydney',
    postalRegionCode: 'OLD', postalPostalCode: '2001', occupations: [{ occupationCode: 'x', occupationName: 'X', licence: 'L' }],
  };
  const values = plain(form.profileFormValues(profile));
  assert.equal(values.postalRegionCode, 'OLD', 'No silent substitution of a retired code');
  assert.deepEqual(values.occupations, [{ occupationCode: 'x', licence: 'L' }]);
  assert.deepEqual(plain(referenceOptions([{ code: 'NSW', displayName: 'New South Wales' }], ['NSW', 'OLD'])), [
    { label: 'New South Wales', value: 'NSW' },
    { label: 'OLD (retired)', value: 'OLD', disabled: true },
  ]);
});

test('picture checks: JPEG/PNG only, 5 MB and 16 million pixels', () => {
  const file = { uri: 'file:///p.png', name: 'p.png', mimeType: 'image/png', size: 1000, width: 4000, height: 4000 };
  assert.ok(pictureForm(file) instanceof FormData);
  assert.throws(() => pictureForm({ ...file, mimeType: 'image/gif' }), /JPEG or PNG/);
  assert.throws(() => pictureForm({ ...file, width: 4001 }), /16 million/);
  assert.throws(() => pictureForm({ ...file, size: 5 * 1024 * 1024 + 1 }), /size limit/);
  assert.throws(() => pictureForm({ ...file, uri: 'https://example.com/p.png' }), /local file/);
});

const user = (permissions, accessLevel = 'full', roles = []) => ({
  id: '1', accessLevel, roles, permissions, profileCompletionRequired: accessLevel === 'profile_setup',
});

test('profile gates: setup exception for own profile; SuperAdmin-only target routes', () => {
  assert.equal(access.canViewOwnProfile(user([], 'profile_setup')), true);
  assert.equal(access.canEditOwnProfile(user([], 'profile_setup')), true);
  assert.equal(access.canViewOwnProfile(user(['profiles.view'])), true);
  assert.equal(access.canEditOwnProfile(user(['profiles.view'])), false, 'View-only member');
  assert.equal(access.canViewOwnProfile(user([])), false);
  assert.equal(access.canManageUserProfiles(user(['profiles.manage', 'users.manage'])), false);
  assert.equal(access.canManageUserProfiles(user([], 'full', ['SuperAdmin'])), true);
  assert.equal(access.canManageUserProfiles(user([], 'profile_setup', ['SuperAdmin'])), false);
});
