import { useThemeColor } from "@/hooks/useThemeColor";
import { StyleSheet, Text, View } from "react-native";
import { ImageComponent } from "./imageComponent";

// The profile picture (guide 04) when there is one, otherwise an initial.
export function Avatar({ name, uri, size = 48 }: { name?: string; uri?: string | null; size?: number }) {
  const background = useThemeColor({}, "primaryLight");
  const tint = useThemeColor({}, "tint");
  const initial = name?.trim().charAt(0).toUpperCase() || "?";

  if (uri) return <ImageComponent source={uri} width={size} height={size} />;

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
