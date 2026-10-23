import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

// Serialize native writes so rapid changes cannot leave an older preference
// saved after the newest one.
let pendingWrite = Promise.resolve();
function updateStorage(operation: () => void | Promise<void>) {
  const warn = () => console.warn('Could not save the theme preference.');
  pendingWrite = pendingWrite.then(operation).catch(warn);
  return pendingWrite;
}

const themeStorage: StateStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => updateStorage(() => SecureStore.setItemAsync(name, value)),
  removeItem: (name) => updateStorage(() => SecureStore.deleteItemAsync(name)),
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'light',
      setPreference: (pref) => set({ preference: pref }),
    }),
    {
      name: 'theme-preference',
      storage: createJSONStorage(() => themeStorage),
      partialize: ({ preference }) => ({ preference }),
      // The root waits for hydration before displaying content.
      skipHydration: true,
      merge: (persistedState, currentState) => {
        const saved = persistedState as { preference?: unknown } | null | undefined;
        const preference = saved?.preference;
        return {
          ...currentState,
          preference: preference === 'light' || preference === 'dark' || preference === 'system'
            ? preference
            : currentState.preference,
        };
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.warn('Could not restore the theme preference; using the current theme.');
      },
    }
  )
);

let initialization: Promise<void> | undefined;
export function initializeTheme() {
  // Effect replay and root remounts must share the same restoration attempt.
  initialization ??= Promise.resolve(useThemeStore.persist.rehydrate());
  return initialization;
}
