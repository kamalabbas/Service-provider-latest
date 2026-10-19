import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface LoaderProps {
  visible?: boolean;
  message?: string;
  overlay?: boolean;
  size?: "small" | "large" | number;
  color?: string;
}

export function Loader({ visible = false, message, overlay = true, size = "large", color }: LoaderProps) {
  // theme colors
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");

  if (!visible) return null;

  const indicatorColor = color ?? primary;

  if (overlay) {
    return (
      <View style={styles.overlay} pointerEvents="auto">
        <ActivityIndicator size={size as any} color={indicatorColor} />
        {message ? <Text style={[styles.message, { color: textColor }]}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.inline} pointerEvents="none">
      <ActivityIndicator size={size as any} color={indicatorColor} />
      {message ? <Text style={[styles.messageInline, { color: textColor }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  message: {
    marginTop: 8,
    fontSize: 14,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  messageInline: {
    marginLeft: 8,
    fontSize: 13,
  },
});
