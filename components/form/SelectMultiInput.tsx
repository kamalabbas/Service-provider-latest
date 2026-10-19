import { useThemeColor } from "@/hooks/useThemeColor";
import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "../ThemedText";
import { FormInput } from "./FormInput";

interface Option {
  label: string;
  value: string;
}

interface SelectMultiInputProps {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: Option[];
  placeholder?: string;
  pickerLabel?: string;
  error?: string;
}

// Selection UI accepts options from its caller and has no account or API dependency.
export function SelectMultiInput({ label, values, onChange, options, placeholder = "Select", pickerLabel, error }: SelectMultiInputProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const backgroundColor = useThemeColor({}, "background");
  const borderColor = useThemeColor({}, "borderColor");
  const tint = useThemeColor({}, "tint");
  const errorColor = useThemeColor({}, "error");
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));

  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((selected) => selected !== value) : [...values, value]);

  return (
    <View style={styles.container}>
      {label ? <ThemedText>{label}</ThemedText> : null}
      <Pressable
        style={[styles.input, { backgroundColor, borderColor }]}
        onPress={() => { setSearch(""); setVisible(true); }}
        accessibilityRole="button"
      >
        <ThemedText numberOfLines={1}>{selectedLabels.join(", ") || placeholder}</ThemedText>
      </Pressable>
      {error ? <ThemedText style={{ color: errorColor }}>{error}</ThemedText> : null}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setVisible(false)} accessibilityLabel="Close options" />
          <View style={[styles.panel, { backgroundColor }]}>
            <ThemedText type="subtitle">{pickerLabel || label || placeholder}</ThemedText>
            <FormInput placeholder="Search options" value={search} onChangeText={setSearch} />
            <FlatList
              data={filteredOptions}
              keyExtractor={(option) => option.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => toggle(item.value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: values.includes(item.value) }}
                >
                  <ThemedText style={values.includes(item.value) ? { color: tint } : undefined}>
                    {values.includes(item.value) ? "✓ " : ""}{item.label}
                  </ThemedText>
                </Pressable>
              )}
              ListEmptyComponent={<ThemedText>No options found.</ThemedText>}
            />
            <Pressable onPress={() => setVisible(false)} accessibilityRole="button">
              <ThemedText type="link">Done</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12, gap: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  backdrop: { flex: 1 },
  panel: { height: "65%", padding: 24, gap: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  option: { paddingVertical: 12 },
});
