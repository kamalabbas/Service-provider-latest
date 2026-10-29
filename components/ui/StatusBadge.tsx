import { ThemedText } from "@/components/ThemedText";
import { Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { StyleSheet, View } from "react-native";

export type StatusTone = "info" | "success" | "warning" | "danger" | "neutral";

/** A small colored pill for a record's status. */
export function StatusBadge({ label, tone = "info" }: { label: string; tone?: StatusTone }) {
  const colors = {
    info: { background: useThemeColor({}, "primaryLight"), text: useThemeColor({}, "tint") },
    success: { background: useThemeColor({}, "successSurface"), text: useThemeColor({}, "success") },
    warning: { background: useThemeColor({}, "warningSurface"), text: useThemeColor({}, "warning") },
    danger: { background: useThemeColor({}, "errorSurface"), text: useThemeColor({}, "error") },
    neutral: { background: useThemeColor({}, "muted"), text: useThemeColor({}, "textMuted") },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]} accessibilityLabel={`Status: ${label}`}>
      <ThemedText type="footnote" style={[styles.text, { color: colors.text }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xxs },
  text: { fontWeight: "600" },
});
