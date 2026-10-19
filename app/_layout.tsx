import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { Toast } from '@/components/ui/Toast';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeStore } from '@/stores/theme';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';

import { useUserStateRedirect } from '@/hooks/useUserStateRedirect';
import { restoreUser } from '@/utility/restoreUser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a single QueryClient instance for the app so it's not recreated on every render.
const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // States
  const [appReady, setAppReady] = useState(false);

  // Theme Preference
  const themePref = useThemeStore((s) => s.preference);

  const [loaded] = useFonts({ SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf') });
  const systemColorScheme = useColorScheme();

  const colorScheme = themePref === 'system' ? systemColorScheme : themePref;
  const { visible, message, type, persist, linkText, linkURL } = useToastStore();
  
  useEffect(() => {
    async function init() {
      // Preserve saved credentials until a Service Provider backend is configured.
      if (process.env.EXPO_PUBLIC_BASE_URL) {
        await restoreUser();
      } else {
        useAuthStore.getState().clearAuth();
      }
      setAppReady(true);
      await SplashScreen.hideAsync();
    }
    init();
  }, []);

  useUserStateRedirect(loaded && appReady);

  if (!loaded || !appReady) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(dashboard)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style='dark' />
        <Toast visible={visible} message={message} type={type} persist={persist} linkText={linkText} linkURL={linkURL}/>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
