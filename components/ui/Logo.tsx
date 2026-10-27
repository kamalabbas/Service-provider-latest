import { useThemeColor } from "@/hooks/useThemeColor";
import { Image, ImageProps, ImageStyle, StyleProp, StyleSheet, View } from "react-native";
import { ThemedText } from "../ThemedText";

type LogoProps = {
  large?: boolean;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageProps["resizeMode"];
};

export const Logo = ({ large = true, style, resizeMode = "contain" }: LogoProps) => {
  const tint = useThemeColor({}, "tint");

  return (
    <View style={styles.container}>
      <Image
        source={require("@/assets/images/service-provider-icon.png")}
        style={[large ? styles.large : styles.small, style]}
        resizeMode={resizeMode}
        accessibilityRole="image"
        accessibilityLabel="Service Provider"
      />
      <ThemedText type="subtitle" style={{ color: tint }}>Service Provider</ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 12, marginBottom: 24 },
  large: { width: 96, height: 96, borderRadius: 20 },
  small: { width: 48, height: 48, borderRadius: 10 },
});
