import { ThemedText } from '@/components/ThemedText';
import { Layout, Radius, Spacing, Typography } from '@/constants/Theme';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { SelectOption } from '@/utility/referenceOptions';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface SelectInputProps {
  label?: string;
  value?: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  pickerLabel?: string;
  disabled?: boolean;
  /** Show a spinner while options load (e.g. reference choices). */
  loading?: boolean;
}

export const SelectInput: React.FC<SelectInputProps> = ({ label, value, onChange, options, placeholder = 'Select', error, pickerLabel, disabled, loading }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(300))[0];

  const borderColor = useThemeColor({}, 'borderColor');
  const surface = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const errorColor = useThemeColor({}, 'error');
  const tint = useThemeColor({}, 'tint');
  const separatorColor = useThemeColor({}, 'separatorColor');
  const placeholderColor = useThemeColor({}, 'placeholder');
  const overlay = useThemeColor({}, 'overlay');

  const selectedValue = value == null ? undefined : value.toString();
  const selectedLabel = options.find((o) => o.value === selectedValue)?.label;
  const inactive = disabled || loading;

  const openModal = () => {
    setModalVisible(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true })
      .start(() => setModalVisible(false));
  };

  return (
    <View style={styles.container}>
      {label ? <ThemedText type="label" style={styles.label}>{label}</ThemedText> : null}

      <Pressable
        onPress={openModal}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        style={[styles.input, { borderColor: error ? errorColor : borderColor, backgroundColor: surface, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={[styles.text, { color: selectedLabel ? textColor : placeholderColor }]} numberOfLines={1}>
          {selectedLabel || placeholder}
        </Text>
        {loading ? <ActivityIndicator size="small" color={mutedColor} /> : <Ionicons name="chevron-down" size={20} color={mutedColor} />}
      </Pressable>

      {!!error && <ThemedText type="caption" tone="error" style={styles.error}>{error}</ThemedText>}

      <Modal visible={modalVisible} transparent onRequestClose={closeModal} presentationStyle="overFullScreen" statusBarTranslucent animationType="none">
        <View style={[styles.overlay, { backgroundColor: overlay }]}>
          <Pressable style={{ flex: 1 }} onPress={closeModal} accessibilityLabel="Close options" />
          <Animated.View style={[styles.picker, { backgroundColor: surface, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.pickerHeader}>
              <ThemedText type="headline">{pickerLabel || label || placeholder}</ThemedText>
              <Pressable onPress={closeModal} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={textColor} />
              </Pressable>
            </View>
            <View style={[styles.separator, { backgroundColor: separatorColor }]} />

            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              ListEmptyComponent={<ThemedText tone="muted" style={styles.empty}>No choices available.</ThemedText>}
              renderItem={({ item, index }) => {
                const selected = item.value === selectedValue;
                return (
                  <Pressable
                    disabled={item.disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !!item.disabled }}
                    style={[styles.option, { borderColor: separatorColor, borderBottomWidth: index === options.length - 1 ? 0 : StyleSheet.hairlineWidth }]}
                    onPress={() => {
                      closeModal();
                      onChange(item.value);
                    }}
                  >
                    <Text style={[styles.optionText, { color: item.disabled ? mutedColor : selected ? tint : textColor }, selected && styles.optionSelected]}>
                      {item.label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={18} color={tint} />}
                  </Pressable>
                );
              }}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.sm },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.controlHeight,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  text: { flex: 1, ...Typography.body },
  error: { marginTop: Spacing.sm },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  picker: {
    maxHeight: '60%',
    padding: Spacing.xl,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.lg },
  option: { paddingVertical: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionText: { ...Typography.body, flex: 1 },
  optionSelected: { fontWeight: '600' },
  empty: { paddingVertical: Spacing.lg, textAlign: 'center' },
});
