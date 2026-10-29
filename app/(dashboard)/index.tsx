import { ActionTile } from "@/components/home/ActionTile";
import { InspectionCard } from "@/components/inspection/InspectionCard";
import { QuoteCard } from "@/components/quote/QuoteCard";
import { ThemedText } from "@/components/ThemedText";
import { Avatar } from "@/components/ui/Avatar";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { BrandMark } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useMyInspections } from "@/hooks/useInspections";
import { useMyMember } from "@/hooks/useMembership";
import { useMyProfile } from "@/hooks/useProfile";
import { useMyQuotes } from "@/hooks/useQuotes";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuthStore } from "@/stores/authStore";
import { canViewAnnouncements, canViewCards, canViewInspections, canViewQuotes, canViewServices, canViewSupport } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, type ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const RECENT = 3;

const greeting = (hour = new Date().getHours()) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

/** "3", or "20+" when more pages exist. */
const countText = (items: readonly unknown[] | undefined, more: boolean) =>
  items?.length ? `${items.length}${more ? "+" : ""}` : null;

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { data: profile } = useMyProfile();
  const { data: member } = useMyMember();
  const onPrimary = useThemeColor({}, "buttonText");
  const primary = useThemeColor({}, "primary");

  // Waiting on someone: pending inspections and quotes, both sides.
  const pendingInspections = useMyInspections({ status: "pending" });
  const pendingQuotes = useMyQuotes({ status: "pending" });
  const recentInspections = useMyInspections({});
  const recentQuotes = useMyQuotes({});
  const announcements = useAnnouncements(RECENT);

  useFocusEffect(useCallback(() => {
    if (canViewInspections(user)) { pendingInspections.refetch(); recentInspections.refetch(); }
    if (canViewQuotes(user)) { pendingQuotes.refetch(); recentQuotes.refetch(); }
    if (canViewAnnouncements(user)) announcements.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]));

  // Screens in other tabs keep their list underneath, so Back works.
  const open = (href: Href) => router.push(href, { withAnchor: true });
  const firstName = profile?.firstName?.trim();
  const inspections = (recentInspections.data ?? []).slice(0, RECENT);
  const quotes = (recentQuotes.data ?? []).slice(0, RECENT);
  const latest = (announcements.data ?? []).slice(0, RECENT);

  // Tab roots switch tabs; Account screens open with the Account list underneath.
  const allActions: (ComponentProps<typeof ActionTile> & { show: boolean })[] = [
    {
      show: canViewInspections(user), icon: "clipboard-outline", label: "Inspections", caption: "Requests and visits",
      count: countText(pendingInspections.data, !!pendingInspections.hasNextPage), onPress: () => router.navigate("/(dashboard)/(inspections)"),
    },
    {
      show: canViewQuotes(user), icon: "document-text-outline", label: "Quotes", caption: "Sent and received",
      count: countText(pendingQuotes.data, !!pendingQuotes.hasNextPage), onPress: () => router.navigate("/(dashboard)/(quotes)"),
    },
    { show: canViewCards(user), icon: "wallet-outline", label: "My cards", caption: "Membership cards", onPress: () => open("/(dashboard)/(menu)/cards") },
    { show: canViewSupport(user), icon: "chatbubbles-outline", label: "Support", caption: "Talk to our team", onPress: () => open("/(dashboard)/(menu)/support") },
  ];
  const actions = allActions.filter((action) => action.show);

  return (
    <Screen
      title={firstName ? `${greeting()}, ${firstName}` : greeting()}
      subtitle={member?.userTypeDisplayName ? `${member.userTypeDisplayName} · Membership ID ${member.membershipId}` : user?.email}
      accessory={
        <Pressable onPress={() => open("/(dashboard)/(menu)/profile")} accessibilityRole="button" accessibilityLabel="Your profile">
          <Avatar name={firstName ?? user?.email} uri={profile?.pictureUrl} />
        </Pressable>
      }
    >
      {canViewServices(user) ? (
        <View style={[styles.hero, Shadow.card, { backgroundColor: primary }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <ThemedText type="headline" style={{ color: onPrimary }}>Find a trusted provider</ThemedText>
              <ThemedText type="callout" style={[styles.heroCaption, { color: onPrimary }]}>
                Search services near you and request an inspection.
              </ThemedText>
            </View>
            <BrandMark size={44} />
          </View>
          <PrimaryButton title="Search services" variant="secondary" size="md" leftIcon="search-outline" onPress={() => router.navigate("/(dashboard)/(find)")} />
        </View>
      ) : null}

      {actions.length ? (
        <View style={styles.grid}>
          {actions.map((action) => (
            <ActionTile key={action.label} icon={action.icon} label={action.label} caption={action.caption} count={action.count} onPress={action.onPress} />
          ))}
        </View>
      ) : null}

      {inspections.length ? (
        <View style={styles.section}>
          <SectionHeader title="Recent inspections" onSeeAll={() => router.navigate("/(dashboard)/(inspections)")} />
          {inspections.map((inspection) => <InspectionCard key={inspection.id} inspection={inspection} userId={user?.id} anchor />)}
        </View>
      ) : null}

      {quotes.length ? (
        <View style={styles.section}>
          <SectionHeader title="Recent quotes" onSeeAll={() => router.navigate("/(dashboard)/(quotes)")} />
          {quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} userId={user?.id} anchor />)}
        </View>
      ) : null}

      {canViewAnnouncements(user) && latest.length ? (
        <ListSection title="Announcements">
          {latest.map((item) => (
            <ListRow
              key={item.id}
              icon="megaphone-outline"
              title={item.title}
              subtitle={formatLocalTimestamp(item.publishedAtUtc ?? item.updatedAtUtc)}
              onPress={() => open({ pathname: "/(dashboard)/(menu)/announcement", params: { id: String(item.id) } })}
            />
          ))}
          <ListRow icon="list-outline" title="See all announcements" onPress={() => open("/(dashboard)/(menu)/announcements")} />
        </ListSection>
      ) : null}
    </Screen>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <Pressable onPress={onSeeAll} accessibilityRole="button" hitSlop={Spacing.sm}>
        <ThemedText type="label" tone="tint">See all</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.xl, gap: Spacing.lg },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  heroText: { flex: 1, gap: Spacing.xs },
  heroCaption: { opacity: 0.85 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginBottom: Spacing.xl },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
});
