import { ThemedText } from "@/components/ThemedText";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type RecordCardProps = {
  icon: IconName;
  title: string;
  status: { label: string; tone: StatusTone };
  /** Short facts shown with an icon each, e.g. who and when. */
  details: { icon: IconName; text: string }[];
  /** Right-aligned headline value, e.g. a quote total. */
  amount?: string;
  onPress: () => void;
};

// A tappable list card for a record with a status, e.g. an inspection or a quote.
export function RecordCard({ icon, title, status, details, amount, onPress }: RecordCardProps) {
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");
  const tint = useThemeColor({}, "tint");
  const tintSurface = useThemeColor({}, "primaryLight");
  const muted = useThemeColor({}, "textMuted");
  const pressed = useThemeColor({}, "muted");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed: isPressed }) => [styles.card, Shadow.card, { backgroundColor: isPressed ? pressed : surface, borderColor: border }]}
    >
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: tintSurface }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <View style={styles.heading}>
          <ThemedText type="headline" numberOfLines={2}>{title}</ThemedText>
          <StatusBadge label={status.label} tone={status.tone} />
        </View>
        {amount ? <ThemedText type="headline" style={{ color: tint }}>{amount}</ThemedText> : null}
        <Ionicons name="chevron-forward" size={18} color={muted} />
      </View>
      <View style={styles.details}>
        {details.map((detail) => (
          <View key={`${detail.icon}-${detail.text}`} style={styles.detail}>
            <Ionicons name={detail.icon} size={14} color={muted} />
            <ThemedText type="caption" tone="muted" numberOfLines={1} style={styles.detailText}>{detail.text}</ThemedText>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.md },
  top: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  iconWrap: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1, gap: Spacing.xs },
  details: { gap: Spacing.xs, paddingLeft: 36 + Spacing.md },
  detail: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  detailText: { flex: 1 },
});
