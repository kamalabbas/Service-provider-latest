import { useThemeColor } from "@/hooks/useThemeColor";
import { selectNeedsProfileSetup, useAuthStore } from "@/stores/authStore";
import { Stack } from "expo-router";

export default function SetupLayout() {
  const needsSetup = useAuthStore(selectNeedsProfileSetup);
  const background = useThemeColor({}, "muted");
  const text = useThemeColor({}, "text");

  // The root navigator owns fallback navigation; render nothing once access changes.
  if (!needsSetup) return null;

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
      <Stack.Screen name="index" options={{ title: "Account Setup", headerShown: false }} />
      <Stack.Screen name="member-type" options={{ title: "Member Type" }} />
    </Stack>
  );
}
