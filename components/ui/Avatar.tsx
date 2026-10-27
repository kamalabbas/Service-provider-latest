import { useThemeColor } from "@/hooks/useThemeColor";
import { StyleSheet, Text, View } from "react-native";

// Initial-based avatar until profile pictures arrive with guide 04.
export function Avatar({ name, size = 48 }: { name?: string; size?: number }) {
  const background = useThemeColor({}, "primaryLight");
  const tint = useThemeColor({}, "tint");
  const initial = name?.trim().charAt(0).toUpperCase() || "?";

  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initial, { color: tint, fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  initial: { fontWeight: "700" },
});
