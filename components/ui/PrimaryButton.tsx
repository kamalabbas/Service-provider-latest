import { Layout, Radius, Spacing, Typography } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** primary: main action; secondary: outlined; ghost: text-only; danger: destructive. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  leftIcon?: IconName;
  rightIcon?: IconName;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
};

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  size = "lg",
  leftIcon,
  rightIcon,
  style,
  textStyle,
}: Props) {
  const primary = useThemeColor({}, "primary");
  const primaryPressed = useThemeColor({}, "primaryPressed");
  const onPrimary = useThemeColor({}, "buttonText");
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const surface = useThemeColor({}, "surface");
  const muted = useThemeColor({}, "muted");
  const error = useThemeColor({}, "error");
  const text = useThemeColor({}, "text");

  const palette = {
    primary: { background: primary, pressed: primaryPressed, content: onPrimary, border: "transparent" },
    secondary: { background: surface, pressed: muted, content: text, border },
    ghost: { background: "transparent", pressed: muted, content: tint, border: "transparent" },
    danger: { background: error, pressed: error, content: onPrimary, border: "transparent" },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        size === "md" ? styles.medium : styles.large,
        {
          backgroundColor: pressed ? palette.pressed : palette.background,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.5 : pressed && variant === "danger" ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.content} />
        ) : leftIcon ? (
          <Ionicons name={leftIcon} size={18} color={palette.content} />
        ) : null}
        <Text style={[styles.text, size === "md" && styles.textMedium, { color: palette.content }, textStyle]} numberOfLines={1}>
          {title}
        </Text>
        {rightIcon && !loading ? <Ionicons name={rightIcon} size={18} color={palette.content} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  large: { minHeight: Layout.controlHeight },
  medium: { minHeight: 44 },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm },
  text: { ...Typography.bodyStrong },
  textMedium: { ...Typography.label },
});
