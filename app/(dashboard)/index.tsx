import { ThemedText } from "@/components/ThemedText";
import { Avatar } from "@/components/ui/Avatar";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { BrandMark } from "@/components/ui/Logo";
import { Screen } from "@/components/ui/Screen";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuthStore } from "@/stores/authStore";
import { canViewAnnouncements } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

const LATEST = 3;

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const primary = useThemeColor({}, "primary");
  const onPrimary = useThemeColor({}, "buttonText");
  const roles = user?.roles.length ? user.roles.join(", ") : "Member";
  const router = useRouter();
  // Guide 16: the latest few announcements; the full list lives under Account.
  const announcements = useAnnouncements(LATEST);
  const latest = (announcements.data ?? []).slice(0, LATEST);

  useFocusEffect(useCallback(() => {
    if (canViewAnnouncements(user)) announcements.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]));

  return (
    <Screen title="Welcome" subtitle={user?.email} accessory={<Avatar name={user?.email} />}>
      <View style={[styles.hero, Shadow.card, { backgroundColor: primary }]}>
        <View style={styles.heroMark}>
          <BrandMark size={44} />
        </View>
        <ThemedText type="headline" style={{ color: onPrimary }}>Your account is ready</ThemedText>
        <ThemedText type="callout" style={[styles.heroText, { color: onPrimary }]}>
          Services, inspections and quotes will appear here as they become available.
        </ThemedText>
      </View>

      {canViewAnnouncements(user) && latest.length ? (
        <ListSection title="Announcements">
          {latest.map((item) => (
            <ListRow
              key={item.id}
              icon="megaphone-outline"
              title={item.title}
              subtitle={formatLocalTimestamp(item.publishedAtUtc ?? item.updatedAtUtc)}
              onPress={() => router.push({ pathname: "/(dashboard)/(menu)/announcement", params: { id: String(item.id) } })}
            />
          ))}
          <ListRow icon="list-outline" title="See all announcements" onPress={() => router.push("/(dashboard)/(menu)/announcements")} />
        </ListSection>
      ) : null}

      <ListSection title="Account">
        <ListRow icon="mail-outline" title="Signed in as" subtitle={user?.email ?? "Unknown"} />
        <ListRow icon="shield-checkmark-outline" title="Access" subtitle={user?.accessLevel === "full" ? "Full access" : "Profile setup"} />
        <ListRow icon="people-outline" title="Roles" subtitle={roles} />
      </ListSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  heroMark: {
    alignSelf: "flex-start",
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.35)",
    marginBottom: Spacing.sm,
  },
  heroText: {
    opacity: 0.85,
  },
});
