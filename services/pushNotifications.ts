import { getSessionGeneration } from '@/services/authSession';
import { selectIsAuthenticated, useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
const enabled = () => isNative && Boolean(process.env.EXPO_PUBLIC_BASE_URL);

if (isNative) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let acquisition: Promise<string | null> | null = null;
let startupAttempted = false;
let channelCreated = false;
let forceRefresh = false;
let deviceToken: Notifications.DevicePushToken | undefined;
let deviceTokenRevision = 0;

const setToken = (token: string | null) => useAuthStore.getState().setPushNotificationToken(token);
const hasPermission = (permission: Notifications.NotificationPermissionsStatus) =>
  permission.granted || permission.status === 'granted' ||
  permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
  permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;

// Token acquisition is installation-scoped, not an account registration. It can
// complete across a login/logout without authorizing a backend request.
export function refreshPushToken({ requestPermission = false, force = false } = {}): Promise<string | null> {
  if (!enabled() || !Device.isDevice || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    useNotificationStore.setState({ tokenStatus: 'unavailable' });
    return Promise.resolve(null);
  }
  forceRefresh ||= force;
  if (acquisition) return acquisition;

  const operation = (async () => {
    useNotificationStore.setState({ tokenStatus: 'loading' });
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        setToken(null);
        useNotificationStore.setState({ tokenStatus: 'unavailable' });
        return null;
      }
      if (Platform.OS === 'android' && !channelCreated) {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#ffffff',
        });
        channelCreated = true;
      }
      let permission = await Notifications.getPermissionsAsync();
      if (!hasPermission(permission) && requestPermission && permission.canAskAgain !== false) {
        permission = await Notifications.requestPermissionsAsync();
      }
      if (!hasPermission(permission)) {
        setToken(null);
        useNotificationStore.setState({ tokenStatus: 'denied' });
        return null;
      }
      const existing = useAuthStore.getState().pushNotificationToken;
      if (existing && !forceRefresh) {
        useNotificationStore.setState({ tokenStatus: 'available' });
        return existing;
      }
      // A native token can rotate while Expo is resolving an older token.
      // Re-resolve the latest native token before publishing, without parallel requests.
      while (true) {
        const revision = deviceTokenRevision;
        const result = await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken: deviceToken });
        if (revision !== deviceTokenRevision) continue;
        if (typeof result.data !== 'string' || !result.data) throw new Error('Empty push token');
        setToken(result.data);
        useNotificationStore.setState({ tokenStatus: 'available' });
        return result.data;
      }
    } catch {
      setToken(null);
      useNotificationStore.setState({ tokenStatus: 'error' });
      console.warn('Could not acquire the Expo push token.');
      return null;
    }
  })().finally(() => {
    if (acquisition === operation) {
      acquisition = null;
      forceRefresh = false;
    }
  });
  acquisition = operation;
  return operation;
}

const responseKey = (response: Notifications.NotificationResponse) =>
  JSON.stringify([response.notification.request.identifier, response.actionIdentifier]);
const seenResponses = new Set<string>();

function captureResponse(response: Notifications.NotificationResponse) {
  const key = responseKey(response);
  if (seenResponses.has(key)) return;
  seenResponses.add(key);
  // Bound memory while retaining deduplication across root remounts.
  if (seenResponses.size > 64) seenResponses.delete(seenResponses.values().next().value!);
  const auth = useAuthStore.getState();
  useNotificationStore.setState({ pendingResponse: {
    response,
    generation: getSessionGeneration(),
    userId: selectIsAuthenticated(auth) ? auth.user!.id : null,
  } });
}

// Future route integration must supply root readiness and validate the payload
// against an approved contract. This handoff does not interpret data or navigate.
export function takeNotificationResponse(ready: boolean): Notifications.NotificationResponse | null {
  const auth = useAuthStore.getState();
  const pending = useNotificationStore.getState().pendingResponse;
  if (!ready || !selectIsAuthenticated(auth) || !pending) return null;
  useNotificationStore.setState({ pendingResponse: null });
  if (pending.generation !== getSessionGeneration() ||
      (pending.userId !== null && pending.userId !== auth.user!.id)) return null;
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last && responseKey(last) === responseKey(pending.response)) Notifications.clearLastNotificationResponse();
  } catch {
    console.warn('Could not clear the last notification response.');
  }
  return pending.response;
}

let owners = 0;
let dispose: (() => void) | undefined;
let observedGeneration = getSessionGeneration();
let observedUserId = useAuthStore.getState().user?.id;

function synchronizeSession() {
  const generation = getSessionGeneration();
  const userId = useAuthStore.getState().user?.id;
  if (observedGeneration !== generation || (observedUserId != null && observedUserId !== userId)) {
    useNotificationStore.setState({ notification: null, pendingResponse: null });
  }
  observedGeneration = generation;
  observedUserId = userId;
}

// The root owns this lifecycle. Reference counting also protects against an
// accidental second consumer; effect replay/remounts share token acquisition.
export function startPushNotifications(): () => void {
  if (!enabled()) return () => {};
  owners += 1;
  if (owners === 1) {
    let active = true;
    synchronizeSession();
    const cleanup: (() => void)[] = [];
    dispose = () => {
      active = false;
      for (const remove of cleanup.splice(0)) remove();
    };
    try {
      const received = Notifications.addNotificationReceivedListener(notification => {
        if (active) useNotificationStore.setState({ notification });
      });
      cleanup.push(() => received.remove());
      const responses = Notifications.addNotificationResponseReceivedListener(response => {
        if (active) captureResponse(response);
      });
      cleanup.push(() => responses.remove());
      const tokens = Notifications.addPushTokenListener(token => {
        if (!active || JSON.stringify(token) === JSON.stringify(deviceToken)) return;
        deviceToken = token;
        deviceTokenRevision += 1;
        setToken(null);
        void refreshPushToken({ force: true });
      });
      cleanup.push(() => tokens.remove());
      const appState = AppState.addEventListener('change', state => {
        if (active && state === 'active') void refreshPushToken();
      });
      cleanup.push(() => appState.remove());
      cleanup.push(useAuthStore.subscribe((auth, previous) => {
        if (!active) return;
        synchronizeSession();
        if (selectIsAuthenticated(auth) && !selectIsAuthenticated(previous) && !auth.pushNotificationToken) {
          void refreshPushToken();
        }
      }));
      try {
        const lastResponse = Notifications.getLastNotificationResponse();
        if (lastResponse) captureResponse(lastResponse);
      } catch {
        console.warn('Could not read the last notification response.');
      }
      if (!startupAttempted) {
        startupAttempted = true;
        void refreshPushToken({ requestPermission: true });
      } else if (!useAuthStore.getState().pushNotificationToken) {
        void refreshPushToken();
      }
    } catch {
      dispose();
      console.warn('Could not start notification listeners.');
    }
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owners -= 1;
    if (owners === 0) {
      dispose?.();
      dispose = undefined;
    }
  };
}
