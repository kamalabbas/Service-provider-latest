import { Stack } from "expo-router";
import { useContext } from "react";
import { AppUpdatePolicyContext } from "@/hooks/useAppUpdatePolicy";
import { selectIsAuthenticated, useAuthStore } from "@/stores/authStore";

export default function AuthLayout() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const forceUpdate = useContext(AppUpdatePolicyContext)?.action === "force";

  return (
    <Stack>
      <Stack.Protected guard={!forceUpdate && !isAuthenticated}>
        <Stack.Screen name="index" options={{ title: "Sign In", headerShown: false }} />
        <Stack.Screen name="register" options={{ title: "Register", headerShown: true }} />
        <Stack.Screen name="forgot-password" options={{ title: "Forgot Password", headerShown: true }} />
        <Stack.Screen name="otp-forgot-password" options={{ title: "Verify OTP", headerShown: true }} />
        <Stack.Screen name="otp-register" options={{ title: "Verify Registration OTP", headerShown: true }} />
        <Stack.Screen name="set-new-password" options={{ title: "Set New Password", headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={forceUpdate}>
        <Stack.Screen name="forced-update" options={{ title: "App Update Required", headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
