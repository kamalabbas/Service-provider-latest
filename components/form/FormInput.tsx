import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

interface FormInputProps extends TextInputProps {
  label?: string;
  error?: string;
  labelStyle?: object;
  showPasswordRule?: boolean;
}

export const FormInput = forwardRef<TextInput, FormInputProps>(
  ({ label, error, labelStyle, style, secureTextEntry, showPasswordRule = true, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = !!secureTextEntry;
  const passwordRuleText = "Password must be at least 8 characters, include one uppercase letter, and one number.";

  // Theme colors
  const borderColor = useThemeColor({}, "borderColor");
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const errorColor = useThemeColor({}, "error");

  return (
    <ThemedView style={[styles.container, styles.transparentBackground]}>
      {label && <ThemedText style={[styles.label, { color: textColor }, labelStyle]}>{label}</ThemedText>}
      <View>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            { borderColor, backgroundColor, color: textColor },
            style,
            isPasswordField && styles.passwordInput,
            error && { borderColor: errorColor },
          ]}
          placeholderTextColor={borderColor}
          secureTextEntry={isPasswordField ? !showPassword : secureTextEntry}
          {...props}
        />

        {isPasswordField && (
          <Pressable
            style={styles.passwordToggle}
            onPress={() => setShowPassword((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          >
            <ThemedText style={styles.passwordToggleText}>{showPassword ? "Hide" : "Show"}</ThemedText>
          </Pressable>
        )}
      </View>
      {isPasswordField && showPasswordRule && <ThemedText style={[styles.passwordRule, { color: borderColor }]}>{passwordRuleText}</ThemedText>}
      {!!error && <Text style={[styles.error, { color: errorColor }]}>{error}</Text>}
    </ThemedView>
  );
});

FormInput.displayName = "FormInput";

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 10,
  },
  transparentBackground: {
    backgroundColor: "transparent",
  },
  label: {
    paddingBottom: 6,
    fontWeight: "600",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  passwordInput: {
    paddingRight: 64,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  passwordToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  passwordRule: {
    marginTop: 4,
    fontSize: 12,
  },
  error: {
    marginTop: 4,
    fontSize: 13,
  },
});
