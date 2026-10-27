import { selectNeedsProfileSetup, useAuthStore } from "@/stores/authStore";
import { Stack } from "expo-router";

export default function SetupLayout() {
  const needsSetup = useAuthStore(selectNeedsProfileSetup);

  // The root navigator owns fallback navigation; render nothing once access changes.
  if (!needsSetup) return null;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Account Setup", headerShown: false }} />
    </Stack>
  );
}
