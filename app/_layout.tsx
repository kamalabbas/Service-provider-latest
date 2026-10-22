import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { Toast } from '@/components/ui/Toast';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeStore } from '@/stores/theme';
import { useToastStore } from '@/stores/toastStore';
import { selectIsAuthenticated, useAuthStore } from '@/stores/authStore';

import { AppUpdatePolicyContext, useAppUpdatePolicy } from '@/hooks/useAppUpdatePolicy';
import { restoreUser } from '@/utility/restoreUser';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/queryClient';
import { getSessionGeneration } from '@/services/authSession';

void SplashScreen.preventAutoHideAsync().catch(() => {
  console.warn('Could not keep the native splash screen visible during startup.');
});

// Effect replay and root remounts share startup, without changing later explicit
// restore triggers or the session service's refresh coordination.
let initialization: Promise<void> | undefined;
function initializeApp() {
  if (!initialization) {
    const generation = getSessionGeneration();
    initialization = (async () => {
      // Preserve saved credentials until a Service Provider backend is configured.
      if (process.env.EXPO_PUBLIC_BASE_URL) {
        await restoreUser();
      } else {
        useAuthStore.getState().clearAuth();
      }
    })().catch(() => {
      console.warn('Session restoration failed during startup.');
      // Normally restoreSession handles failures itself. Settle an unexpected
      // rejection only if startup still owns an unresolved authentication state.
      if (generation === getSessionGeneration() && useAuthStore.getState().user === undefined) {
        useAuthStore.getState().clearAuth();
      }
    });
  }
  return initialization;
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const mounted = useRef(false);
  const splashDismissalRequested = useRef(false);

  const themePref = useThemeStore((s) => s.preference);

  const [fontsLoaded, fontError] = useFonts({ SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf') });
  const systemColorScheme = useColorScheme();

  const colorScheme = themePref === 'system' ? systemColorScheme : themePref;
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const ready = appReady && (fontsLoaded || !!fontError);
  const { visible, message, type, persist, linkText, linkURL } = useToastStore();
  
  useEffect(() => {
    mounted.current = true;
    let active = true;
    const complete = () => {
      if (active) setAppReady(true);
    };
    // Both outcomes release startup; a rejected operation must not strand splash.
    void initializeApp().then(complete, complete);
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (fontError) console.warn('Custom font loading failed; using system fonts.');
  }, [fontError]);

  const onRootLayout = useCallback(() => {
    if (!mounted.current || !ready || splashDismissalRequested.current) return;
    splashDismissalRequested.current = true;
    void SplashScreen.hideAsync().catch(() => {
      if (!mounted.current) return;
      try {
        // Expo also exposes a synchronous hide; make one fallback attempt.
        SplashScreen.hide();
      } catch {
        splashDismissalRequested.current = false;
        console.warn('Could not dismiss the native splash screen.');
      }
    });
  }, [ready]);

  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const updatePolicy = useAppUpdatePolicy(ready);
  const forceUpdate = updatePolicy?.action === 'force';

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <AppUpdatePolicyContext.Provider value={updatePolicy}>
          <View style={{ flex: 1, backgroundColor: theme.colors.background }} onLayout={onRootLayout}>
            <Stack>
              <Stack.Protected guard={forceUpdate || !isAuthenticated}>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              </Stack.Protected>
              <Stack.Protected guard={!forceUpdate && isAuthenticated}>
                <Stack.Screen name="(dashboard)" options={{ headerShown: false }} />
              </Stack.Protected>
              <Stack.Protected guard={!forceUpdate}>
                <Stack.Screen name="+not-found" />
                <Stack.Screen name="_sitemap" />
              </Stack.Protected>
            </Stack>
            <StatusBar style='dark' />
            <Toast visible={visible} message={message} type={type} persist={persist} linkText={linkText} linkURL={linkURL}/>
          </View>
        </AppUpdatePolicyContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
