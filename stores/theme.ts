import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

// Keep browser writes synchronous and serialize native writes so rapid changes
// cannot leave an older preference saved after the newest one.
let pendingWrite = Promise.resolve();
function updateStorage(operation: () => void | Promise<void>) {
  const warn = () => console.warn('Could not save the theme preference.');
  if (Platform.OS === 'web') {
    try {
      operation();
    } catch {
      warn();
    }
    return;
  }
  pendingWrite = pendingWrite.then(operation).catch(warn);
  return pendingWrite;
}

const themeStorage: StateStorage = {
  getItem: (name) => Platform.OS === 'web'
    ? localStorage.getItem(name)
    : SecureStore.getItemAsync(name),
  setItem: (name, value) => updateStorage(() => Platform.OS === 'web'
    ? localStorage.setItem(name, value)
    : SecureStore.setItemAsync(name, value)),
  removeItem: (name) => updateStorage(() => Platform.OS === 'web'
    ? localStorage.removeItem(name)
    : SecureStore.deleteItemAsync(name)),
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
      // Hydrate after mounting, including on Web where static rendering has no
      // localStorage. The root waits for this attempt before displaying content.
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
