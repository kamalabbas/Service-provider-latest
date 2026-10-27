// Run with: node --test tests/*.test.cjs
// Map pin and device-location helpers shared by business, listing and search screens.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const sandbox = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'utility/coordinates.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
vm.runInNewContext(code, { module: sandbox, exports: sandbox.exports, require: id => (id === 'yup' ? require('yup') : assert.fail(id)) });
const coordinates = sandbox.exports;
const plain = value => JSON.parse(JSON.stringify(value));

test('form text parses to a pin only when valid; zero is a valid pin', () => {
  assert.deepEqual(plain(coordinates.parseCoordinates('0', '0')), { latitude: 0, longitude: 0 });
  assert.deepEqual(plain(coordinates.parseCoordinates('-33.8688', '151.2093')), { latitude: -33.8688, longitude: 151.2093 });
  assert.equal(coordinates.parseCoordinates('', ''), null, 'No pin yet');
  assert.equal(coordinates.parseCoordinates('91', '0'), null);
  assert.equal(coordinates.parseCoordinates('1', 'east'), null);
  assert.equal(coordinates.coordinateText(0), '0');
  assert.equal(coordinates.coordinateText(null), '');
});

test('pins round to six decimals; the map shows Australia until a pin is set', () => {
  assert.equal(coordinates.roundCoordinate(-33.868812345), -33.868812);
  assert.deepEqual(plain(coordinates.mapRegion(null)), plain(coordinates.AUSTRALIA_REGION));
  assert.deepEqual(plain(coordinates.mapRegion({ latitude: 0, longitude: 0 })), { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 });
});

test('a missing pin asks the member to set the location, not to type coordinates', async () => {
  await assert.rejects(coordinates.coordinateField('latitude').validate(''), /use your current location or tap the map/);
  assert.equal(await coordinates.coordinateField('longitude').isValid('-180'), true);
  assert.equal(await coordinates.coordinateField('longitude').isValid('180.5'), false);
});
