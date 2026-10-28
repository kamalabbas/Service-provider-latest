import type { Notification, NotificationResponse } from 'expo-notifications';
import { create } from 'zustand';

export type PushTokenStatus = 'idle' | 'loading' | 'available' | 'denied' | 'unavailable' | 'error';

/** Guide 17: whether this installation is registered with the backend for the signed-in account. */
export type PushRegistrationStatus = 'idle' | 'registered' | 'disabled' | 'refused' | 'error';

/** Guide 18: the live notification hub connection for the signed-in account. */
export type LiveConnectionStatus = 'off' | 'connecting' | 'live' | 'reconnecting' | 'retrying';

interface NotificationState {
  tokenStatus: PushTokenStatus;
  registration: PushRegistrationStatus;
  live: LiveConnectionStatus;
  notification: Notification | null;
  pendingResponse: {
    response: NotificationResponse;
    generation: number;
    userId: string | null;
  } | null;
}

// Notification payloads stay in memory. The existing auth store retains the
// installation's token for compatibility with the established logout request.
export const useNotificationStore = create<NotificationState>(() => ({
  tokenStatus: 'idle',
  registration: 'idle',
  live: 'off',
  notification: null,
  pendingResponse: null,
}));
