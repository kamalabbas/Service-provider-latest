import { documentDirectory, readAsStringAsync, writeAsStringAsync } from "expo-file-system/legacy";

export type RestorePolicy = "allowed" | "blocked";

const policyPath = () => {
  if (!documentDirectory) throw new Error("Persistent restore-policy storage is unavailable.");
  return `${documentDirectory}session-restore-policy.json`;
};

// Only an explicit, supported record permits restoration. Native read errors
// propagate to session handling; missing/corrupt records never imply permission.
export const readRestorePolicy = async (): Promise<RestorePolicy | null> => {
  const contents = await readAsStringAsync(policyPath());
  try {
    const record = JSON.parse(contents);
    return record?.version === 1 && (record.state === "allowed" || record.state === "blocked") ? record.state : null;
  } catch {
    return null;
  }
};

export const writeRestorePolicy = async (state: RestorePolicy): Promise<void> => {
  await writeAsStringAsync(policyPath(), JSON.stringify({ version: 1, state }));
  if (await readRestorePolicy() !== state) throw new Error("Restore-policy persistence could not be verified.");
};
