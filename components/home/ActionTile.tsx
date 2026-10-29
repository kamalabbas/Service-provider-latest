import { ThemedText } from "@/components/ThemedText";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";

type ActionTileProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  caption?: string;
  /** Shown as a small counter, e.g. items waiting for you. */
  count?: string | null;
  onPress: () => void;
};

// A quick-action tile for the Home grid.
export function ActionTile({ icon, label, caption, count, onPress }: ActionTileProps) {
  const surface = useThemeColor({}, "surface");
  const pressedBackground = useThemeColor({}, "muted");
  const border = useThemeColor({}, "separatorColor");
  const tint = useThemeColor({}, "tint");
  const tintSurface = useThemeColor({}, "primaryLight");
  const badge = useThemeColor({}, "primary");
  const onBadge = useThemeColor({}, "buttonText");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} waiting` : label}
      style={({ pressed }) => [styles.tile, Shadow.card, { backgroundColor: pressed ? pressedBackground : surface, borderColor: border }]}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: tintSurface }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        {count ? (
          <View style={[styles.badge, { backgroundColor: badge }]}>
            <ThemedText type="footnote" style={[styles.badgeText, { color: onBadge }]}>{count}</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText type="label">{label}</ThemedText>
      {caption ? <ThemedText type="footnote" tone="muted" numberOfLines={2}>{caption}</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.xs },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 24, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xxs, alignItems: "center" },
  badgeText: { fontWeight: "700" },
});
