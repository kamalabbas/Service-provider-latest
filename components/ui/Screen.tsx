import { ThemedText } from "@/components/ThemedText";
import { Layout, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  /** Rendered to the right of the title, e.g. an avatar. */
  accessory?: ReactNode;
  /** Use the muted grouped background behind cards and list sections. */
  grouped?: boolean;
}>;

// Scrollable page for signed-in tabs, with a large title header.
export function Screen({ title, subtitle, accessory, grouped = true, children }: ScreenProps) {
  const background = useThemeColor({}, grouped ? "muted" : "background");
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText type="display">{title}</ThemedText>
            {subtitle ? <ThemedText type="callout" tone="muted" style={styles.subtitle}>{subtitle}</ThemedText> : null}
          </View>
          {accessory}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Layout.screenPadding - Spacing.xs,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  headerText: { flex: 1 },
  subtitle: { marginTop: Spacing.xs },
});
