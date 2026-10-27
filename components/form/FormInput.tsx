import { ThemedText } from "@/components/ThemedText";
import { Layout, Radius, Spacing, Typography } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { PASSWORD_RULE_TEXT } from "@/utility/passwordPolicy";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ComponentProps, forwardRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from "react-native";

interface FormInputProps extends TextInputProps {
  label?: string;
  error?: string;
  labelStyle?: object;
  showPasswordRule?: boolean;
  /** Optional leading icon, e.g. "mail-outline". */
  leftIcon?: ComponentProps<typeof Ionicons>["name"];
  helperText?: string;
}

export const FormInput = forwardRef<TextInput, FormInputProps>(
  ({ label, error, labelStyle, style, secureTextEntry, showPasswordRule = true, leftIcon, helperText, onFocus, onBlur, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPasswordField = !!secureTextEntry;

  // Theme colors
  const borderColor = useThemeColor({}, "borderColor");
  const surface = useThemeColor({}, "surface");
  const textColor = useThemeColor({}, "text");
  const errorColor = useThemeColor({}, "error");
  const placeholderColor = useThemeColor({}, "placeholder");
  const mutedTextColor = useThemeColor({}, "textMuted");
  const tint = useThemeColor({}, "tint");

  const frameColor = error ? errorColor : focused ? tint : borderColor;
  const helper = helperText ?? (isPasswordField && showPasswordRule ? PASSWORD_RULE_TEXT : undefined);

  return (
    <View style={styles.container}>
      {label && <ThemedText type="label" style={[styles.label, labelStyle]}>{label}</ThemedText>}
      <View style={[styles.field, { borderColor: frameColor, backgroundColor: surface }, focused && !error && styles.focused]}>
        {leftIcon ? <Ionicons name={leftIcon} size={20} color={focused ? tint : mutedTextColor} style={styles.leftIcon} /> : null}
        <TextInput
          ref={ref}
          style={[styles.input, { color: textColor }, style]}
          placeholderTextColor={placeholderColor}
          secureTextEntry={isPasswordField ? !showPassword : secureTextEntry}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          {...props}
        />
        {isPasswordField && (
          <Pressable
            style={styles.passwordToggle}
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          >
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={mutedTextColor} />
          </Pressable>
        )}
      </View>
      {error ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={errorColor} style={styles.messageIcon} />
          <ThemedText type="caption" tone="error" style={styles.messageText}>{error}</ThemedText>
        </View>
      ) : helper ? (
        <ThemedText type="footnote" style={[styles.helper, { color: mutedTextColor }]}>{helper}</ThemedText>
      ) : null}
    </View>
  );
});

FormInput.displayName = "FormInput";

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: Layout.controlHeight,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  focused: {
    borderWidth: 1.5,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.md,
  },
  passwordToggle: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  message: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.sm,
  },
  messageIcon: {
    marginTop: 2,
    marginRight: Spacing.xs,
  },
  messageText: {
    flex: 1,
  },
  helper: {
    marginTop: Spacing.sm,
  },
});
