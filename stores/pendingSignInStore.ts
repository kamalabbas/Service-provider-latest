import { create } from 'zustand';

// The credentials just used to register (or an unverified sign-in), so verifying the email can
// sign straight in. Memory only: never stored on the device, in route params or in logs, and
// cleared after the attempt or on sign-out.
interface PendingSignInState {
  email: string | null;
  password: string | null;
  set: (email: string, password: string) => void;
  clear: () => void;
}

export const usePendingSignInStore = create<PendingSignInState>((set) => ({
  email: null,
  password: null,
  set: (email, password) => set({ email, password }),
  clear: () => set({ email: null, password: null }),
}));

/** The saved credentials for this email, taken once (cleared on read). */
export function takePendingSignIn(email: string): { email: string; password: string } | null {
  const state = usePendingSignInStore.getState();
  state.clear();
  if (!state.email || !state.password || state.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
  return { email: state.email, password: state.password };
}
