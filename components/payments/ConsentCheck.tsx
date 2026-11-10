import { ThemedText } from "@/components/ThemedText";
import { Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet } from "react-native";

// Explicit consent before any charge or card setup (guide 21): the amount is in the label.
export function ConsentCheck({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const surface = useThemeColor({}, "surface");

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={[styles.row, { backgroundColor: surface, borderColor: checked ? tint : border }]}
    >
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? tint : border} />
      <ThemedText type="callout" style={styles.text}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md, borderWidth: 1.5, marginBottom: Spacing.lg },
  text: { flex: 1 },
});
