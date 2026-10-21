import { User } from '@/interfaces/user.interface';
import { queryClient } from '@/services/queryClient';
import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;  
  user: User | null | undefined;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  pushNotificationToken: string | null,
  setPushNotificationToken: (token: string) => void
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: undefined,
  pushNotificationToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  clearAuth: () => set({ accessToken: null, user: null }),
  setPushNotificationToken: (token) => set({pushNotificationToken: token})
}));

// Reset before other store subscribers can start queries for the new identity.
// Token rotation within the same account keeps its cache.
useAuthStore.subscribe((state, previous) => {
  const sessionEnded = state.user === null && previous.user !== null;
  if (sessionEnded || state.user?.id !== previous.user?.id || Boolean(state.accessToken) !== Boolean(previous.accessToken)) {
    queryClient.clear();
  }
});
