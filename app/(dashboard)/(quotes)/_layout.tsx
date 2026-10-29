import { useThemeColor } from "@/hooks/useThemeColor";
import { Stack } from "expo-router";

// Screens opened from another tab or a notification keep the list underneath, so Back works.
export const unstable_settings = { initialRouteName: "index" };

export default function QuotesLayout() {
  const background = useThemeColor({}, "muted");
  const text = useThemeColor({}, "text");

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: background },
        headerTintColor: text,
        headerTitleStyle: { fontWeight: "600" },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Quotes", headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Quote" }} />
      <Stack.Screen name="new" options={{ title: "New quote" }} />
    </Stack>
  );
}
