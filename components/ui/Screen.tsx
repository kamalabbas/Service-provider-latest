import { ThemedText } from "@/components/ThemedText";
import { Layout, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useQueryClient } from "@tanstack/react-query";
import { PropsWithChildren, ReactNode, useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  /** Rendered to the right of the title, e.g. an avatar. */
  accessory?: ReactNode;
  /** Use the muted grouped background behind cards and list sections. */
  grouped?: boolean;
  /** A stack header above the screen already reserves the top inset. */
  hasHeader?: boolean;
  /** Pull down to reload. Defaults to refetching every query on screen. */
  onRefresh?: () => Promise<unknown>;
  /** Turn pull-to-refresh off, e.g. on forms. */
  refreshable?: boolean;
}>;

// Scrollable page for signed-in tabs, with a large title header and pull-to-refresh.
export function Screen({ title, subtitle, accessory, grouped = true, hasHeader = false, onRefresh, refreshable = true, children }: ScreenProps) {
  const background = useThemeColor({}, grouped ? "muted" : "background");
  const tint = useThemeColor({}, "tint");
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // The queries that are mounted are the ones this page (and its visible tabs) show.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await (onRefresh ? onRefresh() : queryClient.refetchQueries({ type: "active" }));
    } catch {
      // Request errors already show their own message.
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, queryClient]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={[styles.content, { paddingTop: (hasHeader ? 0 : insets.top) + Spacing.lg }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshable ? (
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={tint} colors={[tint]} progressViewOffset={hasHeader ? 0 : insets.top} />
      ) : undefined}
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
