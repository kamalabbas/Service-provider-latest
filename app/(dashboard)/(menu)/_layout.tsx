import { useThemeColor } from "@/hooks/useThemeColor";
import { Stack } from "expo-router";

export default function MenuLayout() {
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
      <Stack.Screen name="index" options={{ title: "Account", headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="business" options={{ title: "My business" }} />
      <Stack.Screen name="business-edit" options={{ title: "Business details" }} />
      <Stack.Screen name="changeEmailPassword" options={{ title: "Email & password" }} />
    </Stack>
  );
}
