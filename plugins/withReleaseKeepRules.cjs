const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

// Release builds are shrunk by R8 (Expo SDK 58 turns it on by default). WorkManager, which
// expo-notifications pulls in, creates its Room database class by name at app start; once R8
// renames or drops that class the app closes before the first screen. Keep those classes.
const MARKER = "# service-provider: keep WorkManager / Room";
const RULES = `
${MARKER}
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.** { *; }
-keep class androidx.room.** { *; }
`;

function addKeepRules(contents) {
  return contents.includes(MARKER) ? contents : `${contents.trimEnd()}\n${RULES}`;
}

function withReleaseKeepRules(config) {
  return withDangerousMod(config, ["android", (modConfig) => {
    const { platformProjectRoot, projectRoot } = modConfig.modRequest;
    const file = path.join(platformProjectRoot ?? path.join(projectRoot, "android"), "app", "proguard-rules.pro");
    // Prebuild always generates this file; without it there is nothing to shrink.
    if (fs.existsSync(file)) fs.writeFileSync(file, addKeepRules(fs.readFileSync(file, "utf8")));
    return modConfig;
  }]);
}

module.exports = { withReleaseKeepRules, addKeepRules };
