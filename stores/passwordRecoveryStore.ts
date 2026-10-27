import { create } from 'zustand';

// Guide 02: the recovery email and code live only in transient memory, never
// in route params (URLs), storage, analytics or logs.
interface PasswordRecoveryState {
  email: string | null;
  code: string | null;
  setEmail: (email: string) => void;
  setCode: (code: string | null) => void;
  clear: () => void;
}

export const usePasswordRecoveryStore = create<PasswordRecoveryState>((set) => ({
  email: null,
  code: null,
  // A new request replaces the old code, so forget any previously checked one.
  setEmail: (email) => set({ email, code: null }),
  setCode: (code) => set({ code }),
  clear: () => set({ email: null, code: null }),
}));
