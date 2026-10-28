import { ThemedText } from "@/components/ThemedText";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { Radius, Spacing } from "@/constants/Theme";
import { useAnnouncement } from "@/hooks/useAnnouncements";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

// Guide 16: one announcement. The body is plain text and rendered as text, never as HTML.
export default function AnnouncementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const announcementId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const announcement = useAnnouncement(announcementId);
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");

  useFocusEffect(useCallback(() => {
    announcement.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (announcement.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the announcement…" /></Screen>;
  // Retired or no longer for this member's type.
  if (!announcement.data) return <Screen hasHeader><Notice tone="warning" message="This announcement is no longer available." /></Screen>;

  const item = announcement.data;
  const edited = item.publishedAtUtc && Date.parse(item.updatedAtUtc) > Date.parse(item.publishedAtUtc);

  return (
    <Screen hasHeader title={item.title} subtitle={formatLocalTimestamp(item.publishedAtUtc ?? item.updatedAtUtc)}>
      <View style={[styles.body, { backgroundColor: surface, borderColor: border }]}>
        <ThemedText selectable>{item.body}</ThemedText>
      </View>
      {edited ? (
        <ThemedText type="footnote" tone="muted" style={styles.edited}>{`Updated ${formatLocalTimestamp(item.updatedAtUtc)}`}</ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  edited: { marginTop: Spacing.sm },
});
