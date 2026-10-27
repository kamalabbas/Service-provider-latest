import { Spacing, Typography } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

type LogoProps = {
  /** large: stacked mark and name; otherwise a compact inline lockup. */
  large?: boolean;
  /** Hide the app name and show only the mark. */
  markOnly?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Brand mark from the logo: a white lightning bolt in a green circle.
export function BrandMark({ size = 40 }: { size?: number }) {
  const primary = useThemeColor({}, "primary");
  return (
    <View
      style={[styles.mark, { width: size, height: size, borderRadius: size / 2, backgroundColor: primary }]}
      accessibilityRole="image"
      accessibilityLabel="Service Provider"
    >
      <Ionicons name="flash" size={size * 0.55} color="#FFFFFF" />
    </View>
  );
}

export const Logo = ({ large = true, markOnly = false, style }: LogoProps) => {
  const tint = useThemeColor({}, "tint");

  return (
    <View style={[large ? styles.stacked : styles.inline, style]}>
      <BrandMark size={large ? 72 : 36} />
      {markOnly ? null : (
        <Text style={[large ? styles.nameLarge : styles.name, { color: tint }]}>Service Provider</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center" },
  stacked: { alignItems: "center", gap: Spacing.md },
  inline: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  nameLarge: { ...Typography.title },
  name: { ...Typography.headline, letterSpacing: -0.2 },
});
