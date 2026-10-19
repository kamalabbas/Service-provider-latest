import { useThemeColor } from '@/hooks/useThemeColor';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface Option {
  label: string;
  value: string;
}

interface SelectInputProps {
  label?: string;
  value?: string | number;
  onChange: (value: string) => void;
  options: Option[] | [];
  placeholder?: string;
  error?: string;
  pickerLabel?: string;
  disabled?: boolean;
}

export const SelectInput: React.FC<SelectInputProps> = ({ label,value, onChange, options, placeholder = 'Select', error, pickerLabel, disabled }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItemLabel, setSelectedItemLabel] = useState<string | undefined>();
  const slideAnim = useState(new Animated.Value(300))[0];

  const borderColor = useThemeColor({}, 'borderColor');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const errorColor = useThemeColor({}, 'error');
  const tint = useThemeColor({}, 'tint');
  const separatorColor = useThemeColor({}, 'separatorColor');
  const optionSeparator = useThemeColor({}, 'optionSeparator');

  useEffect(() => {
    if (value) {
      const found = options.find((o) => o.value === value.toString());      
      setSelectedItemLabel(found?.label);
    } else {
      setSelectedItemLabel(undefined);
    }
  }, [value, options]);

  const openModal = () => {
    setModalVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 200,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: textColor }]}>{label}</Text> : null}

      <TouchableWithoutFeedback onPress={openModal} disabled={disabled}>
        <View style={[styles.input, { borderColor, backgroundColor, opacity: disabled ? 0.5 : 1 }]}>
          <Text style={selectedItemLabel ? styles.text : styles.placeholder}>
            {selectedItemLabel || placeholder}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={24} color={textColor} />
        </View>
      </TouchableWithoutFeedback>

      {!!error && <Text style={[styles.error, { color: errorColor }]}>{error}</Text>}

      <Modal
        visible={modalVisible}
        transparent={true}
        onRequestClose={closeModal}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        animationType="none"
      >
        <View style={styles.overlay}>
          {/* Top area: tapping here will close the modal */}
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          {/* Picker panel: taps inside should NOT close the modal */}
          <Animated.View style={[styles.picker, { transform: [{ translateY: slideAnim }] }]}>
              {(pickerLabel || label) && (
                <>
                  <View style={styles.pickerHeader}>
                    <Text style={{ fontSize: 18, fontWeight: '600' }}>{pickerLabel || label}</Text>
                    <TouchableWithoutFeedback onPress={closeModal}>
                      <Text>
                        <MaterialCommunityIcons name="close" size={24} color={textColor} />
                      </Text>
                    </TouchableWithoutFeedback>
                  </View>
                  <View style={[styles.separator, {backgroundColor: separatorColor}]} />
                </>
              )}

              <FlatList
                data={options}
                keyExtractor={(item) => item.value}
                renderItem={({ item, index }) => {
                  const selected = item.value === value;
                  const isLast = index === options.length - 1;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.option,
                        { borderColor: optionSeparator, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth },
                      ]}
                      onPress={() => {
                        closeModal();
                        onChange(item.value);
                      }}
                    >
                      <Text style={{ color: selected ? tint : textColor, fontWeight: selected ? '600' : '400' }}>{item.label}</Text>
                      {selected && <MaterialCommunityIcons name="check" size={18} color={tint} />}
                    </TouchableOpacity>
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
  container: {
    borderRadius: 8,
    flexDirection: 'column',
    maxWidth: '100%',
    width: '100%',
    marginBottom: 10,
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
    fontSize: 14,
  },
  input: {
    borderRadius: 8,
    flexDirection: 'row',
    maxWidth: '100%',
    height: 45,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholder: {
    color: '#666',
    flex: 1,
  },
  text: { flex: 1 },
  error: {
    marginTop: 4,
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    paddingTop: 30,
  },
  picker: {
    backgroundColor: 'white',
    height: '50%',
    borderRadius: 10,
    padding: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  separator: {
    height: 1,
    marginVertical: 20,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
