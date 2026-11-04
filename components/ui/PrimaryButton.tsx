import { Layout, Radius, Shadow, Spacing, Typography } from "@/constants/Theme";
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
  /** primary: main action; secondary: tinted and outlined; ghost: tinted, no outline (minor actions); danger: destructive. */
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
  const tintSurface = useThemeColor({}, "primaryLight");
  const error = useThemeColor({}, "error");

  const palette = {
    primary: { background: primary, pressed: primaryPressed, content: onPrimary, border: "transparent" },
    // Every variant has a visible fill so it reads as a button, not as text.
    secondary: { background: tintSurface, pressed: tintSurface, content: tint, border: tint },
    ghost: { background: tintSurface, pressed: tintSurface, content: tint, border: "transparent" },
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
        variant === "primary" || variant === "danger" ? Shadow.card : null,
        {
          backgroundColor: pressed ? palette.pressed : palette.background,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.45 : pressed && variant !== "primary" ? 0.8 : 1,
          transform: [{ scale: pressed && !inactive ? 0.98 : 1 }],
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
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  large: { minHeight: Layout.controlHeight },
  medium: { minHeight: 44 },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm },
  text: { ...Typography.bodyStrong, fontWeight: "700" },
  textMedium: { ...Typography.label },
});
