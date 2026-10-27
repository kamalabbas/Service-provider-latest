import { create } from 'zustand';

interface ToastState {
  // Changes on every showToast, so a repeated message restarts its timer.
  id: number;
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
  persist: boolean,
  linkText: string,
  linkURL: string,
  showToast: (message: string, type?: 'success' | 'error' | 'info', persist?: boolean, linkText?: string, linkURL?: string) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  id: 0,
  visible: false,
  message: '',
  type: 'error',
  persist: false,
  linkText: '',
  linkURL: '',
  showToast: (message, type = 'error', persist = false, linkText?, linkURL?) => set((state) => ({ id: state.id + 1, visible: true, message, type, persist, linkText, linkURL })),
  hideToast: () => set({ visible: false, message: '', type: 'error' }),
}));
