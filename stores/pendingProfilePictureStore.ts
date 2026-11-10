import type { PictureUploadFile } from '@/services/apiFiles';
import { create } from 'zustand';

// A profile picture chosen before the profile exists (onboarding). It stays on the device (a
// local file reference in memory) and is uploaded right after the profile is saved.
interface PendingProfilePictureState {
  file: PictureUploadFile | null;
  set: (file: PictureUploadFile) => void;
  clear: () => void;
}

export const usePendingProfilePictureStore = create<PendingProfilePictureState>((set) => ({
  file: null,
  set: (file) => set({ file }),
  clear: () => set({ file: null }),
}));
