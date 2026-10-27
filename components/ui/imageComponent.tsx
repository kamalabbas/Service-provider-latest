import { useThemeColor } from "@/hooks/useThemeColor";
import { resolvePublicMediaUrl } from '@/utility/apiTransport';
import { Image, StyleSheet } from "react-native";

interface CustomImageProps {
  source?: string | null;
  width?: number;
  height?: number;
  style?: any;
}


export function ImageComponent({ source, width, height, style, ...props }: CustomImageProps) {
  // theme colors
  const backgroundColor = useThemeColor({}, "background");

  const defaultSize = 56;
  const w = width ?? defaultSize;
  const h = height ?? defaultSize;

  const containerStyle = { backgroundColor, width: w, height: h, borderRadius: Math.min(w, h) / 2 };
  const shadowStyle = styles.shadow;
  let uri = source;
  if (uri?.startsWith('/')) {
    try { uri = resolvePublicMediaUrl(uri); } catch { uri = null; }
  }

  return <Image source={uri ? { uri } : require("@/assets/images/service-provider-icon.png")} style={[containerStyle, shadowStyle, style]} {...props} />;
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
