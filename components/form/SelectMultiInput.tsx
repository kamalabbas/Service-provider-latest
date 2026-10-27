import { Layout, Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { SelectOption } from "@/utility/referenceOptions";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "../ThemedText";
import { PrimaryButton } from "../ui/PrimaryButton";
import { FormInput } from "./FormInput";

interface SelectMultiInputProps {
  label?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  pickerLabel?: string;
  error?: string;
  loading?: boolean;
}

// Selection UI accepts options from its caller and has no account or API dependency.
export function SelectMultiInput({ label, values, onChange, options, placeholder = "Select", pickerLabel, error, loading }: SelectMultiInputProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const surface = useThemeColor({}, "surface");
  const borderColor = useThemeColor({}, "borderColor");
  const separatorColor = useThemeColor({}, "separatorColor");
  const tint = useThemeColor({}, "tint");
  const muted = useThemeColor({}, "textMuted");
  const errorColor = useThemeColor({}, "error");
  const placeholderColor = useThemeColor({}, "placeholder");
  const overlay = useThemeColor({}, "overlay");
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));

  // A retired (disabled) choice can be removed but never added.
  const toggle = (option: SelectOption) => {
    const selected = values.includes(option.value);
    if (option.disabled && !selected) return;
    onChange(selected ? values.filter((value) => value !== option.value) : [...values, option.value]);
  };

  return (
    <View style={styles.container}>
      {label ? <ThemedText type="label" style={styles.label}>{label}</ThemedText> : null}
      <Pressable
        style={[styles.input, { backgroundColor: surface, borderColor: error ? errorColor : borderColor }]}
        onPress={() => { setSearch(""); setVisible(true); }}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <ThemedText numberOfLines={1} style={[styles.value, selectedLabels.length ? undefined : { color: placeholderColor }]}>
          {selectedLabels.join(", ") || placeholder}
        </ThemedText>
        {loading ? <ActivityIndicator size="small" color={muted} /> : <Ionicons name="chevron-down" size={20} color={muted} />}
      </Pressable>
      {error ? <ThemedText type="caption" tone="error" style={styles.error}>{error}</ThemedText> : null}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={[styles.overlay, { backgroundColor: overlay }]}>
          <Pressable style={styles.backdrop} onPress={() => setVisible(false)} accessibilityLabel="Close options" />
          <View style={[styles.panel, { backgroundColor: surface }]}>
            <ThemedText type="headline">{pickerLabel || label || placeholder}</ThemedText>
            <FormInput placeholder="Search" leftIcon="search-outline" value={search} onChangeText={setSearch} />
            <FlatList
              data={filteredOptions}
              keyExtractor={(option) => option.value}
              renderItem={({ item }) => {
                const checked = values.includes(item.value);
                return (
                  <Pressable
                    style={[styles.option, { borderColor: separatorColor }]}
                    onPress={() => toggle(item)}
                    disabled={item.disabled && !checked}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked, disabled: !!item.disabled && !checked }}
                  >
                    <ThemedText style={[styles.optionText, item.disabled ? { color: muted } : checked ? { color: tint } : undefined]}>{item.label}</ThemedText>
                    <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={checked ? tint : muted} />
                  </Pressable>
                );
              }}
              ListEmptyComponent={<ThemedText tone="muted" style={styles.empty}>No choices found.</ThemedText>}
            />
            <PrimaryButton title="Done" onPress={() => setVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.sm },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: Layout.controlHeight,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  value: { flex: 1 },
  error: { marginTop: Spacing.sm },
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1 },
  panel: { height: "70%", padding: Spacing.xl, gap: Spacing.md, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  option: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { flex: 1 },
  empty: { paddingVertical: Spacing.lg, textAlign: "center" },
});
