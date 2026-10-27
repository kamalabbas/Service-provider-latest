import { ThemedText } from "@/components/ThemedText";
import { Layout, Radius, Spacing, Typography } from "@/constants/Theme";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useThemeStore } from "@/stores/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

type DateTimeInputProps = {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  error?: string;
  /** Earliest selectable moment, e.g. now for future appointments. */
  minimumDate?: Date;
  placeholder?: string;
};

const format = (value: Date) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(value);

// Date and time in the device's local zone; callers send it with an explicit offset.
export function DateTimeInput({ label, value, onChange, error, minimumDate, placeholder = "Choose a date and time" }: DateTimeInputProps) {
  const [step, setStep] = useState<"date" | "time" | null>(null);
  const [draft, setDraft] = useState<Date | null>(null);
  const systemScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const scheme = preference === "system" ? systemScheme : preference;
  const borderColor = useThemeColor({}, "borderColor");
  const surface = useThemeColor({}, "surface");
  const textColor = useThemeColor({}, "text");
  const placeholderColor = useThemeColor({}, "placeholder");
  const errorColor = useThemeColor({}, "error");
  const muted = useThemeColor({}, "textMuted");
  const tint = useThemeColor({}, "tint");

  // Android shows separate date and time dialogs; iOS shows one inline picker.
  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed" || !selected) return setStep(null);
    if (step === "date") {
      setDraft(selected);
      setStep("time");
      return;
    }
    const combined = new Date(draft ?? selected);
    combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setStep(null);
    onChange(combined);
  };

  return (
    <View style={styles.container}>
      <ThemedText type="label" style={styles.label}>{label}</ThemedText>
      {Platform.OS === "ios" ? (
        <View style={[styles.field, { borderColor: error ? errorColor : borderColor, backgroundColor: surface }]}>
          <DateTimePicker
            value={value ?? minimumDate ?? new Date()}
            mode="datetime"
            display="compact"
            minimumDate={minimumDate}
            accentColor={tint}
            themeVariant={scheme === "dark" ? "dark" : "light"}
            onChange={(_, selected) => { if (selected) onChange(selected); }}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => setStep("date")}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[styles.field, { borderColor: error ? errorColor : borderColor, backgroundColor: surface }]}
        >
          <Text style={[styles.text, { color: value ? textColor : placeholderColor }]}>{value ? format(value) : placeholder}</Text>
          <Ionicons name="calendar-outline" size={20} color={muted} />
        </Pressable>
      )}
      {Platform.OS !== "ios" && step ? (
        <DateTimePicker
          value={(step === "time" ? draft : value) ?? minimumDate ?? new Date()}
          mode={step}
          display="default"
          minimumDate={step === "date" ? minimumDate : undefined}
          onChange={onAndroidChange}
        />
      ) : null}
      {error ? <ThemedText type="caption" tone="error" style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: Layout.controlHeight,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  text: { flex: 1, ...Typography.body },
  error: { marginTop: Spacing.sm },
});
