/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const test = require("node:test");
const vm = require("node:vm");
const { resolveAppConfig, configurationWarnings, nativeConfigurationErrors } = require("../config/environment.cjs");

const root = path.resolve(__dirname, "..");
const base = require("../app.json").expo;
const eas = require("../eas.json");
const packageJson = require("../package.json");
const api = "https://api.example.test";
const configSource = fs.readFileSync(path.join(root, "app.config.js"), "utf8");
const scriptSource = fs.readFileSync(path.join(root, "scripts/check-config.cjs"), "utf8");
const localRequire = createRequire(path.join(root, "app.config.js"));

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "service-provider-config-"));
  t.after(() => {
    // Verify the resolved recursive-delete target remains in the intended temp directory.
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("service-provider-config-"));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

function firebase(directory, filename, packages) {
  const file = path.join(directory, filename);
  fs.writeFileSync(file, JSON.stringify({ client: packages.map(package_name => ({
    client_info: { android_client_info: { package_name } },
  })) }));
  return file;
}

function dynamic(env, directory) {
  const module = { exports: {} }, warnings = [];
  vm.runInNewContext(configSource, {
    module, require: localRequire, __dirname: directory, process: { env },
    console: { warn: message => warnings.push(message) },
  });
  return { config: module.exports({ config: structuredClone(base) }), warnings };
}

function cli(env = {}, args = [], pkg = packageJson) {
  const logs = [], imports = [], process = { env, argv: ["node", "check-config.cjs", ...args] };
  vm.runInNewContext(scriptSource, {
    __dirname: path.join(root, "scripts"), process,
    console: Object.fromEntries(["log", "warn", "error"].map(level => [level, message => logs.push([level, message])])),
    require: id => {
      imports.push(id);
      if (id === "@expo/env") return { loadProjectEnv: () => {} };
      if (id === "../package.json") return pkg;
      return createRequire(path.join(root, "scripts/check-config.cjs"))(id);
    },
  });
  return { code: process.exitCode ?? 0, output: logs.map(([, message]) => message).join("\n"), imports };
}

test("an unset local variant uses dev without altering base identity", t => {
  const config = resolveAppConfig(structuredClone(base), {}, fixture(t));
  assert.equal(config.extra.appVariant, "dev");
  assert.equal(config.name, "Service Provider - Dev");
  assert.equal(base.name, "Service Provider");
  assert.equal(base.android.package, "com.kimzaster.serviceprovider");
  assert.equal(base.ios.bundleIdentifier, "com.kimzaster.serviceprovider");
  assert.equal(base.scheme, "service-provider");
  assert.deepEqual(base.platforms, ["android", "ios"]);
  assert.equal(base.extra.eas.projectId, "02557e69-e417-490c-81ea-6d46a925c66a");
  assert.equal(config.extra.eas.projectId, base.extra.eas.projectId);
  assert.equal(config.scheme, base.scheme);
  assert.equal(config.android.googleServicesFile, "./google-services.json");
});

for (const [profile, variant, environment, suffix] of [
  ["development", "dev", "development", ".dev"],
  ["dev", "dev", "development", ".dev"],
  ["preview", "preview", "preview", ""],
  ["production", "production", "production", ""],
]) {
  test(`${profile} resolves its approved variant, environment, and native identities`, t => {
    const config = resolveAppConfig(base, eas.build[profile].env, fixture(t));
    assert.equal(config.extra.appVariant, variant);
    assert.equal(eas.build[profile].environment, environment);
    assert.equal(config.android.package, base.android.package + suffix);
    assert.equal(config.ios.bundleIdentifier, base.ios.bundleIdentifier + suffix);
    assert.equal(config.name, suffix ? "Service Provider - Dev" : "Service Provider");
    assert.equal(config.scheme, "service-provider");
    assert.deepEqual(Array.from(config.platforms), ["android", "ios"]);
    assert.equal(config.extra.eas.projectId, base.extra.eas.projectId);
    assert.equal(Object.hasOwn(eas.build[profile].env, "EXPO_PUBLIC_BASE_URL"), false);
  });
}

for (const variant of ["", "development", "prod", "staging", "PRODUCTION", " production "]) {
  test(`rejects unsupported APP_VARIANT ${JSON.stringify(variant)}`, t => {
    assert.throws(() => dynamic({ APP_VARIANT: variant }, fixture(t)), /APP_VARIANT must be dev, preview, or production/);
  });
}

for (const value of [" ", "/api", "api.example.test", "http://localhost:3000", "https://api.example.test/api", "https://api.example.test/v1", "ftp://api.example.test", "https:/api.example.test", " https://api.example.test", "https://user:private@api.example.test", "https://api.example.test?token=private", "https://api.example.test#private"]) {
  test(`invalid API URL case ${JSON.stringify(value.split("private")[0])} produces a safe configuration error`, t => {
    assert.throws(() => dynamic({ EXPO_PUBLIC_BASE_URL: value }, fixture(t)), error => {
      assert.match(error.message, /EXPO_PUBLIC_BASE_URL must be an absolute HTTP/);
      assert.equal(error.message.includes("private"), false);
      return true;
    });
  });
}

test("HTTPS origins with optional trailing slash are accepted without modifying the environment", t => {
  const directory = fixture(t);
  for (const value of [api, api + "/"]) {
    const env = { EXPO_PUBLIC_BASE_URL: value };
    assert.equal(dynamic(env, directory).config.extra.appVariant, "dev");
    assert.equal(env.EXPO_PUBLIC_BASE_URL, value);
  }
});

test("all local variants permit missing API/Firebase inputs with clear diagnostics", t => {
  for (const APP_VARIANT of ["dev", "preview", "production"]) {
    const { config, warnings } = dynamic({ APP_VARIANT }, fixture(t));
    assert.equal(config.android.googleServicesFile, base.android.googleServicesFile);
    assert.equal(warnings.length, 2);
    assert.match(warnings.join("\n"), /backend-dependent features remain disabled/);
    assert.match(warnings.join("\n"), /JavaScript exports can continue/);
    assert.deepEqual(nativeConfigurationErrors(config, {}, root, "ios"), []);
  }
});

test("dev Firebase selection and explicit EAS file-variable override preserve existing references", t => {
  const directory = fixture(t);
  firebase(directory, "google-services.dev.json", [base.android.package + ".dev"]);
  assert.equal(resolveAppConfig(base, {}, directory).android.googleServicesFile, "./google-services.dev.json");
  assert.equal(resolveAppConfig(base, { APP_VARIANT: "preview" }, directory).android.googleServicesFile, "./google-services.json");
  const override = firebase(directory, "file-variable.json", [base.android.package]);
  const config = resolveAppConfig(base, { APP_VARIANT: "production", GOOGLE_SERVICES_JSON: override }, directory);
  assert.equal(config.android.googleServicesFile, override);
  assert.deepEqual(nativeConfigurationErrors(config, {}, directory, "android"), []);
});

test("dev fallback accepts the existing base file only if it contains the dev package", t => {
  const directory = fixture(t);
  firebase(directory, "google-services.json", [base.android.package]);
  const config = resolveAppConfig(base, {}, directory);
  assert.match(nativeConfigurationErrors(config, {}, directory, "android").join("\n"), /package mismatch/);
  firebase(directory, "google-services.json", [base.android.package, base.android.package + ".dev"]);
  assert.deepEqual(nativeConfigurationErrors(config, {}, directory, "android"), []);
});

for (const content of [null, "{invalid-json-private", "null", '{"client":{}}', '{"client":[]}']) {
  test(`native Android rejects missing/malformed/unmatched Firebase input ${JSON.stringify(content)}`, async t => {
    const directory = fixture(t);
    if (content !== null) fs.writeFileSync(path.join(directory, "google-services.json"), content);
    const { config } = dynamic({}, directory);
    // Execute Expo's real registered mod, which is deferred until native prebuild.
    await assert.rejects(config.mods.android.dangerous({ ...config, modRequest: { projectRoot: directory } }), error => {
      assert.match(error.message, /Firebase/);
      assert.equal(error.message.includes("private"), false);
      return true;
    });
  });
}

test("registered Android prebuild validation accepts a matching client", async t => {
  const directory = fixture(t);
  firebase(directory, "google-services.dev.json", [base.android.package + ".dev"]);
  const { config } = dynamic({}, directory);
  const result = await config.mods.android.dangerous({ ...config, modRequest: { projectRoot: directory } });
  assert.equal(result.android.package, base.android.package + ".dev");
  assert.deepEqual(configurationWarnings(config, { EXPO_PUBLIC_BASE_URL: api }, directory), []);
});

test("local CLI checks permit unconfigured tooling and reject invalid flags/platforms", () => {
  assert.equal(cli().code, 0);
  assert.equal(cli({}, ["--platform", "ios"]).code, 0);
  assert.equal(cli({}, ["--platform", "android"]).code, 1);
  for (const args of [["--unknown"], ["--platform"], ["--platform", "web"]]) assert.equal(cli({}, args).code, 1);
});

for (const profile of ["preview", "production"]) {
  test(`EAS ${profile} requires an explicit matching variant and API URL`, () => {
    const env = { EAS_BUILD_PROFILE: profile, EAS_BUILD_PLATFORM: "ios", APP_VARIANT: profile };
    assert.match(cli(env, ["--eas"]).output, /EXPO_PUBLIC_BASE_URL is required/);
    assert.equal(cli({ ...env, EXPO_PUBLIC_BASE_URL: api }, ["--eas"]).code, 0);
    assert.match(cli({ ...env, APP_VARIANT: undefined, EXPO_PUBLIC_BASE_URL: api }, ["--eas"]).output, /explicitly match/);
    assert.match(cli({ ...env, APP_VARIANT: "dev", EXPO_PUBLIC_BASE_URL: api }, ["--eas"]).output, /explicitly match/);
  });
}

test("EAS standalone dev permits no API, checks Firebase, and needs no installed dependencies", t => {
  const file = firebase(fixture(t), "firebase.json", [base.android.package + ".dev"]);
  const env = { EAS_BUILD_PROFILE: "dev", EAS_BUILD_PLATFORM: "android", APP_VARIANT: "dev", GOOGLE_SERVICES_JSON: file };
  const result = cli(env, ["--eas"]);
  assert.equal(result.code, 0);
  assert.equal(result.imports.includes("@expo/env"), false);
  assert.match(result.output, /backend-dependent features remain disabled/);
  assert.equal(cli({ ...env, GOOGLE_SERVICES_JSON: "missing.json" }, ["--eas"]).code, 1);
});

test("EAS development-client profile reports its existing missing dependency without installing it", () => {
  const env = { EAS_BUILD_PROFILE: "development", EAS_BUILD_PLATFORM: "ios", APP_VARIANT: "dev" };
  assert.match(cli(env, ["--eas"]).output, /expo-dev-client, which is not installed/);
  const readyPackage = { dependencies: { ...packageJson.dependencies, "expo-dev-client": "test-only" } };
  assert.equal(cli(env, ["--eas"], readyPackage).code, 0);
});

test("EAS worker checks reject missing/unknown context", () => {
  for (const env of [{}, { EAS_BUILD_PROFILE: "unknown", EAS_BUILD_PLATFORM: "ios" }, { EAS_BUILD_PROFILE: "dev" }]) {
    assert.match(cli(env, ["--eas"]).output, /known EAS_BUILD_PROFILE and EAS_BUILD_PLATFORM/);
  }
});
