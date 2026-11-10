import { ThemedText } from "@/components/ThemedText";
import { Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

type CodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  hasError?: boolean;
};

/** Digits only, at most `length`; a pasted "123 456" or "Code: 123456" becomes "123456". */
export const toCode = (text: string, length = 6) => text.replace(/\D/g, "").slice(0, length);

// One real text field drawn as separate boxes: pasting the whole code works, and the keyboard
// can suggest a code from Messages or Mail (iOS) or an SMS (Android).
export function CodeInput({ value, onChange, length = 6, hasError }: CodeInputProps) {
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const error = useThemeColor({}, "error");
  const surface = useThemeColor({}, "surface");
  const active = Math.min(value.length, length - 1);

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityRole="none" style={styles.wrap}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length }, (_, index) => {
          const isActive = focused && index === active;
          return (
            <View
              key={index}
              style={[styles.box, { backgroundColor: surface, borderColor: hasError ? error : isActive || value[index] ? tint : border }, isActive && styles.boxActive]}
            >
              <ThemedText type="title">{value[index] ?? ""}</ThemedText>
            </View>
          );
        })}
      </View>
      {/* Covers the boxes so long-press shows Paste; the text itself is drawn in the boxes. */}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(toCode(text, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
        importantForAutofill="yes"
        maxLength={length + 8}
        caretHidden
        contextMenuHidden={false}
        accessibilityLabel={`${length}-digit code`}
        style={styles.hidden}
        autoFocus
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.sm },
  box: { flex: 1, height: 56, borderRadius: Radius.md, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  boxActive: { borderWidth: 2 },
  hidden: { ...StyleSheet.absoluteFill, color: "transparent", opacity: 0.02, fontSize: 1 },
});
