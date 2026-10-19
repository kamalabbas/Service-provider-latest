/* global __dirname */
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || "production";
  const isDevVariant = variant === "dev";

  // Native/cloud identifiers remain in app.json pending ownership decisions.
  const baseAndroidPackage = config?.android?.package;
  const baseIosBundleId = config?.ios?.bundleIdentifier;
  const defaultGoogleServicesFile = config?.android?.googleServicesFile;

  const devGoogleServicesPath = "./google-services.dev.json";
  const hasDevGoogleServices = fs.existsSync(path.resolve(__dirname, devGoogleServicesPath));
  const androidPackage = isDevVariant ? `${baseAndroidPackage}.dev` : baseAndroidPackage;
  const iosBundleIdentifier = isDevVariant ? `${baseIosBundleId}.dev` : baseIosBundleId;

  const googleServicesFile = isDevVariant && hasDevGoogleServices ? devGoogleServicesPath : defaultGoogleServicesFile;

  if (isDevVariant) {
    if (!googleServicesFile) {
      throw new Error(
        "APP_VARIANT=dev requires android.googleServicesFile or google-services.dev.json to be configured."
      );
    }

    const resolvedGoogleServicesPath = path.resolve(__dirname, googleServicesFile);
    if (!fs.existsSync(resolvedGoogleServicesPath)) {
      throw new Error(`Firebase config file not found: ${googleServicesFile}`);
    }

    const googleServices = JSON.parse(fs.readFileSync(resolvedGoogleServicesPath, "utf8"));
    const firebasePackageNames = (googleServices.client || [])
      .map((client) => client?.client_info?.android_client_info?.package_name)
      .filter(Boolean);

    if (!firebasePackageNames.includes(androidPackage)) {
      throw new Error(
        [
          `Firebase package mismatch for dev variant. Expected '${androidPackage}' in ${googleServicesFile}.`,
          "Add a Firebase Android app for this package and download its google-services file.",
          `Found packages: ${firebasePackageNames.join(", ") || "(none)"}`,
        ].join(" ")
      );
    }
  }

  return {
    ...config,
    name: isDevVariant && !String(config.name).endsWith(" - Dev") ? `${config.name} - Dev` : config.name,
    ios: {
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
    },
    android: {
      ...config.android,
      package: androidPackage,
      googleServicesFile,
    },
    extra: {
      ...config.extra,
      appVariant: variant,
    },
  };
};
