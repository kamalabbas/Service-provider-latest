import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useAuthStore } from "@/stores/authStore";
import { canViewAnnouncements } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { announcementPreview } from "@/utility/announcementRules";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet } from "react-native";

// Guide 16: published announcements for the member's current type. No unread tracking.
export default function AnnouncementsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const announcements = useAnnouncements();

  // Retirements and audience changes remove items; refetch whenever the list is shown.
  useFocusEffect(useCallback(() => {
    announcements.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (!canViewAnnouncements(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view announcements." /></Screen>;
  }

  const list = announcements.data ?? [];

  return (
    <Screen hasHeader title="Announcements" subtitle="News and updates from the team.">
      {announcements.isLoading ? (
        <Loader visible overlay={false} message="Loading announcements…" />
      ) : list.length === 0 ? (
        <Notice message="No announcements right now." />
      ) : (
        <>
          <ListSection>
            {list.map((item) => (
              <ListRow
                key={item.id}
                icon="megaphone-outline"
                title={item.title}
                subtitle={`${formatLocalTimestamp(item.publishedAtUtc ?? item.updatedAtUtc)} · ${announcementPreview(item.body)}`}
                onPress={() => router.push({ pathname: "/(dashboard)/(menu)/announcement", params: { id: String(item.id) } })}
              />
            ))}
          </ListSection>
          {announcements.hasNextPage ? (
            <PrimaryButton
              title={announcements.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => announcements.fetchNextPage()}
              loading={announcements.isFetchingNextPage}
              disabled={announcements.isFetchingNextPage}
            />
          ) : (
            <ThemedText type="footnote" tone="muted" style={styles.end}>End of list.</ThemedText>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  end: { textAlign: "center" },
});
