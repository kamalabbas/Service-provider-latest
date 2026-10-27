import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";
import { selectIsAuthenticated, selectNeedsProfileSetup, useAuthStore } from "@/stores/authStore";
import { canViewInspections, canViewQuotes, canViewServices } from "@/utility/access";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function DashboardLayout() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const needsSetup = useAuthStore(selectNeedsProfileSetup);
  const canFind = useAuthStore((state) => canViewServices(state.user));
  const canInspect = useAuthStore((state) => canViewInspections(state.user));
  const canQuote = useAuthStore((state) => canViewQuotes(state.user));
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
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: tabBorder,
          elevation: 0,
          shadowOpacity: 0,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
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
        name="(find)"
        options={{
          title: "Find",
          // Hidden without services.view; the screen also says so on direct navigation.
          href: canFind ? undefined : null,
          tabBarIcon: ({ color, size }) => <IconSymbol name="magnifyingglass" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(inspections)"
        options={{
          title: "Inspections",
          href: canInspect ? undefined : null,
          tabBarIcon: ({ color, size }) => <IconSymbol name="list.clipboard" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(quotes)"
        options={{
          title: "Quotes",
          href: canQuote ? undefined : null,
          tabBarIcon: ({ color, size }) => <IconSymbol name="doc.text" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(menu)"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => <IconSymbol name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
