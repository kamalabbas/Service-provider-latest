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
      <Stack.Screen name="my-services" options={{ title: "My services" }} />
      <Stack.Screen name="my-service" options={{ title: "Listing" }} />
      <Stack.Screen name="my-service-edit" options={{ title: "Listing details" }} />
      <Stack.Screen name="employees" options={{ title: "Employees" }} />
      <Stack.Screen name="employee" options={{ title: "Employee" }} />
      <Stack.Screen name="employee-edit" options={{ title: "Employee details" }} />
      <Stack.Screen name="card-requests" options={{ title: "Membership cards" }} />
      <Stack.Screen name="card-request" options={{ title: "Card request" }} />
      <Stack.Screen name="card-request-employee" options={{ title: "Employee card" }} />
      <Stack.Screen name="changeEmailPassword" options={{ title: "Email & password" }} />
    </Stack>
  );
}
