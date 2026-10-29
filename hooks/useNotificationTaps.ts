import { handleLiveNotice } from '@/services/liveNotifications';
import { takeNotificationResponse } from '@/services/pushNotifications';
import { selectIsAuthenticated, selectNeedsProfileSetup, useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { normalizePushNotice, routeForNotice } from '@/utility/liveEvents';
import { router } from 'expo-router';
import { useEffect } from 'react';

// Guide 18: open the record a tapped push is about, once startup has restored the
// session. The refetch runs first; the screen then loads the record under the current
// permissions, so the push ID never authorizes anything. Unknown types just open the app.
export default function useNotificationTaps(ready: boolean) {
  const pending = useNotificationStore(state => state.pendingResponse);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  useEffect(() => {
    const response = takeNotificationResponse(ready);
    if (!response) return;
    const notice = normalizePushNotice(response.notification.request);
    if (!notice) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('A tapped notification had no event type; opening the app only.');
      return;
    }
    handleLiveNotice(notice, 'push');
    const auth = useAuthStore.getState();
    const route = routeForNotice(notice, auth.user, selectNeedsProfileSetup(auth));
    if (!route) return;
    // Wait one tick so the signed-in navigator has mounted (cold start). Not cancelled on
    // re-render: taking the response clears `pending`, which re-runs this effect.
    setTimeout(() => router.push(route, { withAnchor: true }), 0);
  }, [ready, pending, isAuthenticated]);
}
