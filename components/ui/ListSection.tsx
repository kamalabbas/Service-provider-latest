import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { Children, ComponentProps, Fragment, PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "../ThemedText";

type IconName = ComponentProps<typeof Ionicons>["name"];

// A titled, grouped card of rows (settings-style).
export function ListSection({ title, footer, children }: PropsWithChildren<{ title?: string; footer?: string }>) {
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");
  const rows = Children.toArray(children);

  return (
    <View style={styles.section}>
      {title ? <ThemedText type="footnote" tone="muted" style={styles.sectionTitle}>{title.toUpperCase()}</ThemedText> : null}
      <View style={[styles.card, Shadow.card, { backgroundColor: surface, borderColor: border }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: border }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <ThemedText type="footnote" tone="muted" style={styles.sectionFooter}>{footer}</ThemedText> : null}
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  destructive?: boolean;
  /** Custom trailing content instead of the chevron. */
  trailing?: ReactNode;
};

export function ListRow({ title, subtitle, icon, onPress, destructive, trailing }: ListRowProps) {
  const tint = useThemeColor({}, "tint");
  const tintSurface = useThemeColor({}, "primaryLight");
  const error = useThemeColor({}, "error");
  const errorSurface = useThemeColor({}, "errorSurface");
  const muted = useThemeColor({}, "textMuted");
  const pressedBackground = useThemeColor({}, "muted");

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: pressedBackground }]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: destructive ? errorSurface : tintSurface }]}>
          <Ionicons name={icon} size={18} color={destructive ? error : tint} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <ThemedText type="defaultSemiBold" style={destructive ? { color: error } : undefined}>{title}</ThemedText>
        {subtitle ? <ThemedText type="caption" tone="muted">{subtitle}</ThemedText> : null}
      </View>
      {trailing ?? (onPress && !destructive ? <Ionicons name="chevron-forward" size={18} color={muted} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.xl },
  sectionTitle: { marginBottom: Spacing.sm, marginLeft: Spacing.xs, letterSpacing: 0.6, fontWeight: "600" },
  sectionFooter: { marginTop: Spacing.sm, marginHorizontal: Spacing.xs },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.lg + 32 + Spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: 60 },
  iconWrap: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: Spacing.xxs },
});
