import { createUuid, UUID_PATTERN as UUID } from '@/utility/uuid';
import * as SecureStore from 'expo-secure-store';

// Not a secret: it identifies this installation's push destination.
const INSTALLATION_ID_KEY = 'installation_id';

let pending: Promise<string> | undefined;

/** One stable UUID per installation; it survives sign-out (guides 01 and 17). */
export function getInstallationId(): Promise<string> {
  pending ??= (async () => {
    const saved = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
    if (saved && UUID.test(saved)) return saved;
    const created = createUuid();
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, created);
    return created;
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
