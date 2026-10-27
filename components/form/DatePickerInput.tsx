import { useColorScheme } from "@/hooks/useColorScheme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useThemeStore } from "@/stores/theme";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface DatePickerInputProps {
  label: string;
  value?: Date | null;
  onChange: (date: Date) => void;
  error?: string;
  placeholder?: string;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({ label, value, onChange, error, placeholder = "Select date" }) => {
  const [showPicker, setShowPicker] = useState(false);
  // Follow the in-app theme preference, not only the system setting.
  const systemColorScheme = useColorScheme();
  const themePref = useThemeStore((s) => s.preference);
  const colorScheme = themePref === "system" ? systemColorScheme : themePref;
  const displayValue = value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : "";
  const borderColor = useThemeColor({}, "borderColor");
  const labelColor = useThemeColor({}, "text");
  const inputTextColor = useThemeColor({}, "text");
  const errorColor = useThemeColor({}, "error");
  const placeholderColor = useThemeColor({}, "placeholder");
  const tint = useThemeColor({}, "tint");

  const backgroundColor = useThemeColor({}, "background");

  const openPicker = () => {
    setShowPicker(true);
  };

  return (
    <View style={[styles.container, { width: "100%" }]}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      {Platform.OS === "ios" ? (
        <View style={[styles.input, styles.iosInputShell, { borderColor, backgroundColor }]}>
          <Text style={{ color: displayValue ? inputTextColor : placeholderColor, fontSize: 16 }}>{displayValue || placeholder}</Text>
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display="compact"
            accentColor={tint}
            themeVariant={colorScheme === "dark" ? "dark" : "light"}
            onChange={(_, selectedDate) => {
              if (selectedDate) {
                onChange(selectedDate);
              }
            }}
            style={styles.hiddenIosPicker}
          />
        </View>
      ) : (
        <TouchableOpacity style={[styles.input, { borderColor, backgroundColor }]} onPress={openPicker}>
          <Text style={{ color: displayValue ? inputTextColor : placeholderColor, fontSize: 16 }}>{displayValue || placeholder}</Text>
        </TouchableOpacity>
      )}

      {showPicker && Platform.OS === "android" && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            if (event.type === "dismissed") {
              setShowPicker(false);
              return;
            }

            if (!selectedDate) {
              return;
            }

            onChange(selectedDate);
            setShowPicker(false);
          }}
        />
      )}
      {error && <Text style={[styles.error, { color: errorColor }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  label: {
    marginBottom: 6,
    fontWeight: "600",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  iosInputShell: {
    justifyContent: "center",
    position: "relative",
  },
  hiddenIosPicker: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.02,
  },
  error: {
    marginTop: 4,
    fontSize: 13,
  },
});
