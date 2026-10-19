import { useThemeColor } from "@/hooks/useThemeColor";
import React, { FC, PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

interface CardContainerProps {
  style?: ViewStyle;
}

export const CardContainer: FC<PropsWithChildren<CardContainerProps>> = ({
  children,
  style,
}) => {
  const cardBg = useThemeColor({}, "white");

  return (
    <View style={[styles.card, { backgroundColor: cardBg }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
