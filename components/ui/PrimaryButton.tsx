import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";
import { ActivityIndicator, StyleSheet, TextStyle, TouchableOpacity, View, ViewStyle } from "react-native";
import { ThemedText } from "../ThemedText";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
};

export function PrimaryButton({ title, onPress, disabled, loading, style, textStyle }: Props) {
  // Theme colors
  const backgroundColor = useThemeColor({}, "primary");
  const color = useThemeColor({}, "buttonText");

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor, opacity: disabled || loading ? 0.6 : 1 }, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color={color} style={{ marginRight: 8 }} />
          <ThemedText style={[styles.text, { color }, textStyle]}>{title}</ThemedText>
        </View>
      ) : (
        <ThemedText style={[styles.text, { color }, textStyle]}>{title}</ThemedText>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  text: {
    fontWeight: "600",
    fontSize: 16,
  },
});
