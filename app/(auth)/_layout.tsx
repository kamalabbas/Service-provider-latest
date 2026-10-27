import { Stack } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { selectIsAuthenticated, useAuthStore } from "@/stores/authStore";

export default function AuthLayout() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");

  // Screens render their own large titles; the header only provides back navigation.
  return (
    <Stack
      screenOptions={{
        headerTitle: "",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: background },
        headerTintColor: text,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: background },
      }}
    >
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="index" options={{ title: "Sign In", headerShown: false }} />
        <Stack.Screen name="register" options={{ title: "Register" }} />
        <Stack.Screen name="forgot-password" options={{ title: "Forgot Password" }} />
        <Stack.Screen name="otp-forgot-password" options={{ title: "Verify Code" }} />
        <Stack.Screen name="otp-register" options={{ title: "Verify Email" }} />
        <Stack.Screen name="set-new-password" options={{ title: "Set New Password", headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
