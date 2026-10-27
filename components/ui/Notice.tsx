import { Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { ThemedText } from "../ThemedText";

type NoticeProps = {
  message: string;
  tone?: "info" | "warning" | "error";
  style?: StyleProp<ViewStyle>;
};

// Inline, non-dismissible status message within a screen.
export function Notice({ message, tone = "info", style }: NoticeProps) {
  const colors = {
    info: { surface: useThemeColor({}, "primaryLight"), accent: useThemeColor({}, "tint"), icon: "information-circle" as const },
    warning: { surface: useThemeColor({}, "warningSurface"), accent: useThemeColor({}, "warning"), icon: "warning" as const },
    error: { surface: useThemeColor({}, "errorSurface"), accent: useThemeColor({}, "error"), icon: "alert-circle" as const },
  }[tone];

  return (
    <View style={[styles.notice, { backgroundColor: colors.surface }, style]} accessibilityRole="text">
      <Ionicons name={colors.icon} size={18} color={colors.accent} style={styles.icon} />
      <ThemedText type="caption" style={styles.text}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  icon: { marginTop: 1 },
  text: { flex: 1 },
});
