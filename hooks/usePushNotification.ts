import { startPushNotifications } from '@/services/pushNotifications';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useEffect } from 'react';

export type UsePushNotificationResult = { expoPushToken: string | null } & Pick<
  ReturnType<typeof useNotificationStore.getState>, 'notification' | 'pendingResponse' | 'tokenStatus'
>;

// Mount once in the root layout. Other components can read notificationStore
// without creating listeners or starting another permission/token request.
export default function usePushNotification(): UsePushNotificationResult {
  useEffect(() => startPushNotifications(), []);

  const expoPushToken = useAuthStore(state => state.pushNotificationToken);
  const notification = useNotificationStore(state => state.notification);
  const pendingResponse = useNotificationStore(state => state.pendingResponse);
  const tokenStatus = useNotificationStore(state => state.tokenStatus);
  return { expoPushToken, notification, pendingResponse, tokenStatus };
}
