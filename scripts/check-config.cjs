/* global __dirname */
const path = require("node:path");
const { resolveAppConfig, configurationWarnings, nativeConfigurationErrors } = require("../config/environment.cjs");

const projectRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const easBuild = args.includes("--eas");

try {
  // EAS supplies its selected environment on the worker. Do not load a local
  // dotenv file there, and keep this pre-install check dependency-free.
  if (!easBuild) require("@expo/env").loadProjectEnv(projectRoot, { silent: true });
  let platform = easBuild ? process.env.EAS_BUILD_PLATFORM : undefined;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--eas") continue;
    if (args[index] === "--platform" && !easBuild) {
      platform = args[++index];
      if (!["android", "ios"].includes(platform)) throw new Error("--platform requires android or ios.");
    } else {
      throw new Error("Usage: npm run config:check -- [--platform android|ios]. EAS uses --eas on its build worker.");
    }
  }
  const config = resolveAppConfig(require("../app.json").expo, process.env, projectRoot);
  let easProfile;
  if (easBuild) {
    const profiles = require("../eas.json").build;
    easProfile = Object.hasOwn(profiles, process.env.EAS_BUILD_PROFILE) ? profiles[process.env.EAS_BUILD_PROFILE] : undefined;
    if (!easProfile || !platform) throw new Error("EAS configuration validation requires a known EAS_BUILD_PROFILE and EAS_BUILD_PLATFORM.");
  }
  const errors = platform ? nativeConfigurationErrors(config, process.env, projectRoot, platform, {
    easProfile, packageJson: require("../package.json"),
  }) : [];
  if (errors.length) throw new Error(errors.join("\n"));
  for (const warning of configurationWarnings(config, process.env, projectRoot)) console.warn(`[config] ${warning}`);
  console.log(`[config] ${config.extra.appVariant}${platform ? ` / ${platform}` : ""}: configuration checks passed${platform ? "" : " (native build inputs not required)"}.`);
} catch (error) {
  // All configuration errors above contain controlled text, never env values or Firebase payloads.
  console.error(`[config] ${error.message}`);
  process.exitCode = 1;
}
