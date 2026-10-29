import { useThemeColor } from "@/hooks/useThemeColor";
import { Stack } from "expo-router";

// Screens opened from another tab or a notification keep the list underneath, so Back works.
export const unstable_settings = { initialRouteName: "index" };

export default function FindLayout() {
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
      <Stack.Screen name="index" options={{ title: "Find services", headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Service" }} />
      <Stack.Screen name="price-guide" options={{ title: "Price guide" }} />
      <Stack.Screen name="price-item" options={{ title: "Price" }} />
    </Stack>
  );
}
