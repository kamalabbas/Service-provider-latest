import { registerPushInstallation, unregisterPushInstallation } from '@/services/notificationService';
import { refreshPushToken } from '@/services/pushNotifications';
import { selectIsAuthenticated, useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { canRegisterPushInstallation, canUnregisterPushInstallation } from '@/utility/access';
import { getInstallationId } from '@/utility/installationId';
import { isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Installation-scoped: turning push off on this device survives sign-out.
const DISABLED_KEY = 'push_disabled';

let lastKey: string | null = null;
let syncing: Promise<void> | null = null;
let again = false;

const setRegistration = (registration: ReturnType<typeof useNotificationStore.getState>['registration']) =>
  useNotificationStore.setState({ registration });

const isDisabled = async () => {
  try { return (await SecureStore.getItemAsync(DISABLED_KEY)) === '1'; } catch { return false; }
};

async function register() {
  const auth = useAuthStore.getState();
  if (!selectIsAuthenticated(auth)) {
    lastKey = null;
    setRegistration('idle');
    return;
  }
  const token = auth.pushNotificationToken;
  const platform = Platform.OS;
  if (!token || (platform !== 'ios' && platform !== 'android') || !canRegisterPushInstallation(auth.user)) return;
  if (await isDisabled()) {
    setRegistration('disabled');
    return;
  }
  const installationId = await getInstallationId();
  // One registration per account, installation and token; a rotated token or new sign-in re-registers.
  const key = `${auth.user!.id}|${installationId}|${token}`;
  if (key === lastKey) return;
  try {
    await registerPushInstallation({ installationId, platform, expoPushToken: token });
    lastKey = key;
    setRegistration('registered');
  } catch (error) {
    // Owned by another account (or otherwise refused): don't claim it or keep retrying it.
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (status === 400 || status === 403 || status === 409) {
      lastKey = key;
      setRegistration('refused');
    } else {
      setRegistration('error');
    }
  }
}

/** Coalesces bursts of store changes into one registration at a time. */
export function syncPushRegistration(): Promise<void> {
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    do {
      again = false;
      await register();
    } while (again);
  })().finally(() => { syncing = null; });
  return syncing;
}

/** Root lifecycle: re-register after sign-in and whenever the token rotates. */
export function startPushRegistration(): () => void {
  void syncPushRegistration();
  return useAuthStore.subscribe((state, previous) => {
    if (state.pushNotificationToken !== previous.pushNotificationToken ||
        state.user?.id !== previous.user?.id ||
        Boolean(state.accessToken) !== Boolean(previous.accessToken)) {
      void syncPushRegistration();
    }
  });
}

/** Removes this installation's destination; re-enable registers again. */
export async function disablePushOnThisDevice() {
  const user = useAuthStore.getState().user;
  if (!canUnregisterPushInstallation(user)) throw new Error("You don't have permission to turn off notifications.");
  await unregisterPushInstallation(await getInstallationId());
  await SecureStore.setItemAsync(DISABLED_KEY, '1');
  lastKey = null;
  setRegistration('disabled');
}

export async function enablePushOnThisDevice() {
  await SecureStore.deleteItemAsync(DISABLED_KEY);
  lastKey = null;
  setRegistration('idle');
  // Ask for OS permission now if needed, then register the real token.
  await refreshPushToken({ requestPermission: true });
  await syncPushRegistration();
}
