import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";
import { selectIsAuthenticated, selectNeedsProfileSetup, useAuthStore } from "@/stores/authStore";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function DashboardLayout() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const needsSetup = useAuthStore(selectNeedsProfileSetup);
  const insets = useSafeAreaInsets();
  const tabActive = useThemeColor({}, "tabIconSelected");
  const tabInactive = useThemeColor({}, "tabIconDefault");
  const tabBackground = useThemeColor({}, "surface");
  const tabBorder = useThemeColor({}, "separatorColor");

  // The root navigator owns fallback navigation. Keep descendants unrendered
  // while an existing native route is being removed after access changes.
  if (!isAuthenticated || needsSetup) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: tabActive,
        tabBarInactiveTintColor: tabInactive,
        tabBarStyle: {
          backgroundColor: tabBackground,
          borderTopWidth: 1,
          borderTopColor: tabBorder,
          elevation: 0,
          shadowOpacity: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <IconSymbol name="house.fill" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(menu)"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, size }) => <IconSymbol name="line.3.horizontal" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
