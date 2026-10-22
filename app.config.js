/* global __dirname */
const { withDangerousMod } = require("expo/config-plugins");
const { resolveAppConfig, configurationWarnings, nativeConfigurationErrors } = require("./config/environment.cjs");

module.exports = ({ config }) => {
  const resolved = resolveAppConfig(config, process.env, __dirname);
  for (const warning of configurationWarnings(resolved, process.env, __dirname)) console.warn(`[config] ${warning}`);

  // Native-only validation: config inspection, web, and JS export do not run mods.
  // The same check runs before npm run android and on the EAS build worker.
  return withDangerousMod(resolved, ["android", (modConfig) => {
    const errors = nativeConfigurationErrors(modConfig, process.env, modConfig.modRequest.projectRoot, "android");
    if (errors.length) throw new Error(errors.join("\n"));
    return modConfig;
  }]);
};
