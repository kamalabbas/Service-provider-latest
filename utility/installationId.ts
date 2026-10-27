import * as SecureStore from 'expo-secure-store';

const INSTALLATION_ID_KEY = 'installation_id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Not a secret: it identifies this installation's push destination.
function createUuid(): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
