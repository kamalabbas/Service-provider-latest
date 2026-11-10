// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // TypeScript already checks namespace members; the import plugin can't follow
    // expo-notifications' `export *` enums and reports false positives.
    files: ['**/*.ts', '**/*.tsx'],
    rules: { 'import/namespace': 'off' },
  },
]);
