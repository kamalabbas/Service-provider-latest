const fs = require("node:fs");
const path = require("node:path");

// Build-time configuration only. Never import this Node module into app code.
function validateApiUrl(value) {
  if (value === undefined || value === "") return;
  let url;
  try { url = new URL(value); } catch { /* Report only controlled configuration text. */ }
  if (!url || value !== value.trim() || !/^https?:\/\//i.test(value) ||
      !url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error("EXPO_PUBLIC_BASE_URL must be an absolute HTTP(S) API base URL without credentials, query parameters, fragments, or surrounding whitespace.");
  }
}

function resolveAppConfig(config, env, projectRoot) {
  const variant = env.APP_VARIANT === undefined ? "dev" : env.APP_VARIANT;
  if (!["dev", "preview", "production"].includes(variant)) {
    throw new Error("APP_VARIANT must be dev, preview, or production. Unset defaults to dev for local tooling.");
  }
  validateApiUrl(env.EXPO_PUBLIC_BASE_URL);
  const isDev = variant === "dev";
  const devFile = "./google-services.dev.json";
  const googleServicesFile = env.GOOGLE_SERVICES_JSON ||
    (isDev && fs.existsSync(path.resolve(projectRoot, devFile)) ? devFile : config.android?.googleServicesFile);

  return {
    ...config,
    name: isDev && !String(config.name).endsWith(" - Dev") ? `${config.name} - Dev` : config.name,
    ios: { ...config.ios, bundleIdentifier: isDev ? `${config.ios.bundleIdentifier}.dev` : config.ios.bundleIdentifier },
    android: { ...config.android, package: isDev ? `${config.android.package}.dev` : config.android.package, googleServicesFile },
    extra: { ...config.extra, appVariant: variant },
  };
}

function configurationWarnings(config, env, projectRoot) {
  const warnings = [];
  if (!env.EXPO_PUBLIC_BASE_URL) {
    warnings.push("EXPO_PUBLIC_BASE_URL is unset; backend-dependent features remain disabled. Supply an approved URL locally or in the selected EAS environment.");
  }
  if (!config.android?.googleServicesFile || !fs.existsSync(path.resolve(projectRoot, config.android.googleServicesFile))) {
    warnings.push("Android Firebase input is missing. Config inspection, web, and JavaScript exports can continue; native Android builds require a matching google-services file. See README.");
  }
  return warnings;
}

function nativeConfigurationErrors(config, env, projectRoot, platform, { easProfile, packageJson } = {}) {
  const errors = [];
  if (!["android", "ios"].includes(platform)) return ["Native configuration validation requires platform android or ios."];
  if (easProfile) {
    if (env.APP_VARIANT !== easProfile.env?.APP_VARIANT) {
      errors.push("APP_VARIANT must explicitly match the selected eas.json build profile.");
    }
    if (["preview", "production"].includes(config.extra.appVariant) && !env.EXPO_PUBLIC_BASE_URL) {
      errors.push("EXPO_PUBLIC_BASE_URL is required for EAS preview/production builds. Configure it in the selected EAS environment; no API host is supplied by this repository.");
    }
    if (easProfile.developmentClient && !packageJson?.dependencies?.["expo-dev-client"]) {
      errors.push("The development profile requires expo-dev-client, which is not installed. Approve its installation separately before using this profile; the dev profile remains a standalone internal build.");
    }
  }
  if (platform === "android") {
    const file = config.android?.googleServicesFile;
    let googleServices;
    try {
      if (!file) throw new Error();
      googleServices = JSON.parse(fs.readFileSync(path.resolve(projectRoot, file), "utf8"));
    } catch {
      errors.push("Android Firebase configuration is missing, unreadable, or invalid JSON. Supply GOOGLE_SERVICES_JSON or the existing google-services file for this variant.");
      return errors;
    }
    const clients = Array.isArray(googleServices?.client) ? googleServices.client : [];
    if (!clients.some(client => client?.client_info?.android_client_info?.package_name === config.android.package)) {
      errors.push(`Android Firebase package mismatch: the selected file must contain a client for ${config.android.package}. Supply a matching file from the existing Firebase project owner.`);
    }
  }
  return errors;
}

module.exports = { resolveAppConfig, configurationWarnings, nativeConfigurationErrors };
