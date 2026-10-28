import type { Notification, NotificationResponse } from 'expo-notifications';
import { create } from 'zustand';

export type PushTokenStatus = 'idle' | 'loading' | 'available' | 'denied' | 'unavailable' | 'error';

/** Guide 17: whether this installation is registered with the backend for the signed-in account. */
export type PushRegistrationStatus = 'idle' | 'registered' | 'disabled' | 'refused' | 'error';

interface NotificationState {
  tokenStatus: PushTokenStatus;
  registration: PushRegistrationStatus;
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
  notification: null,
  pendingResponse: null,
}));
