import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RecordCard } from "@/components/ui/RecordCard";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useCardAllowances, useMyCardRequests } from "@/hooks/useCardRequests";
import { useMyCards } from "@/hooks/useCards";
import { canUseMembershipCards, canViewCardRequests, canViewCards } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { CARD_REQUEST_STATUS_LABELS, canRequestEmployeeCard, canRequestPersonalCard, hasOpenCardRequest } from "@/utility/cardRequestRules";
import { CARD_STATUS_LABELS, cardSummary } from "@/utility/cardRules";
import { formatMinor } from "@/utility/paymentRules";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

const SUBJECTS = [
  { label: "All", value: "all" },
  { label: "Mine", value: "personal" },
  { label: "Employees", value: "employee" },
] as const;

// Guides 11/11-b/22: one page for membership cards (a tradesperson feature): request a card for
// yourself or an employee, follow requests, and manage the cards that were issued.
export default function MembershipCardsScreen() {
  const router = useRouter();
  const { user, member, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const [subject, setSubject] = useState<"all" | "personal" | "employee">("all");
  const cards = useMyCards({});
  const requests = useMyCardRequests(subject === "all" ? {} : { subjectType: subject });
  // Checked against personal requests whatever filter is shown; the server still decides.
  const personal = useMyCardRequests({ subjectType: "personal" });
  const allowances = useCardAllowances();

  // Validity is time-based too; refresh when the screen comes back.
  useFocusEffect(useCallback(() => {
    if (canViewCards(user)) cards.refetch();
    if (canViewCardRequests(user)) requests.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]));

  if (member.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;
  if (!canUseMembershipCards(user, userTypeCode)) {
    return <Screen hasHeader><Notice message="Membership cards are for tradespeople." /></Screen>;
  }

  const cardList = cards.data ?? [];
  const requestList = requests.data ?? [];
  const paused = allowances.data ? !allowances.data.cardRequestsEnabled : false;
  const showPersonal = canRequestPersonalCard(user, userTypeCode) && !personal.isLoading && !hasOpenCardRequest(personal.data ?? [], {});
  const showEmployee = canRequestEmployeeCard(user, userTypeCode) && !!business.data;

  return (
    <Screen hasHeader title="Membership cards" subtitle="Request a physical card for yourself or an employee. An administrator reviews each request.">
      <View style={styles.actions}>
        {showPersonal ? <PrimaryButton title="Request my card" leftIcon="card-outline" disabled={paused}
          onPress={() => router.push({ pathname: "/(dashboard)/(menu)/card-request-new", params: { kind: "personal" } })} /> : null}
        {showEmployee ? (
          <PrimaryButton title="Request for an employee" variant="secondary" leftIcon="people-outline" disabled={paused}
            onPress={() => router.push({ pathname: "/(dashboard)/(menu)/card-request-new", params: { kind: "employee" } })} />
        ) : null}
      </View>
      {paused ? <Notice tone="warning" message="Card requests are paused right now. Please try again later." style={styles.spaced} /> : null}
      {allowances.data && !paused ? (
        <Notice
          message={allowances.data.available > 0
            ? `You have ${allowances.data.available} free card credit${allowances.data.available === 1 ? "" : "s"}; your next request uses one.`
            : allowances.data.cardFeeMinor != null ? `Each card costs ${formatMinor(allowances.data.cardFeeMinor)}, delivery included.` : "The card fee isn't set yet."}
          style={styles.spaced}
        />
      ) : null}

      {canViewCards(user) ? (
        <>
          <ThemedText type="label" tone="muted" style={styles.label}>YOUR CARDS</ThemedText>
          {cards.isLoading ? (
            <Loader visible overlay={false} message="Loading cards…" />
          ) : cardList.length === 0 ? (
            <Notice message="No cards yet. A card appears here once it's made after your request is approved." style={styles.spaced} />
          ) : (
            <>
              {cardList.map((card) => {
                const summary = cardSummary(card);
                return (
                  <RecordCard
                    key={card.id}
                    icon={card.subjectType === "employee" ? "people-outline" : "card-outline"}
                    title={card.subjectName}
                    status={{ label: summary.title, tone: summary.tone }}
                    details={[
                      { icon: "card-outline", text: `Card ${card.cardNumber}` },
                      { icon: "cube-outline", text: CARD_STATUS_LABELS[card.status] ?? card.status },
                      { icon: "hourglass-outline", text: `Expires ${formatLocalTimestamp(card.expiresAtUtc)}` },
                    ]}
                    onPress={() => router.push({ pathname: "/(dashboard)/(menu)/card", params: { id: String(card.id) } })}
                  />
                );
              })}
              {cards.hasNextPage ? (
                <PrimaryButton title={cards.isFetchingNextPage ? "Loading..." : "Show more cards"} variant="secondary"
                  onPress={() => cards.fetchNextPage()} loading={cards.isFetchingNextPage} disabled={cards.isFetchingNextPage} style={styles.spaced} />
              ) : null}
            </>
          )}
        </>
      ) : null}

      {canViewCardRequests(user) ? (
        <>
          <ThemedText type="label" tone="muted" style={styles.label}>REQUESTS</ThemedText>
          <SegmentedControl options={SUBJECTS} value={subject} onChange={setSubject} style={styles.spaced} />
          {requests.isLoading ? (
            <Loader visible overlay={false} message="Loading card requests…" />
          ) : requestList.length === 0 ? (
            <Notice message="No card requests yet." />
          ) : (
            <>
              <ListSection>
                {requestList.map((request) => (
                  <ListRow
                    key={request.id}
                    icon={request.subjectType === "employee" ? "people-outline" : "card-outline"}
                    title={request.subjectName}
                    subtitle={`${CARD_REQUEST_STATUS_LABELS[request.status] ?? request.status} · ${formatLocalTimestamp(request.createdAtUtc)}`}
                    onPress={() => router.push({ pathname: "/(dashboard)/(menu)/card-request", params: { id: String(request.id) } })}
                  />
                ))}
              </ListSection>
              {requests.hasNextPage ? (
                <PrimaryButton title={requests.isFetchingNextPage ? "Loading..." : "Show more requests"} variant="secondary"
                  onPress={() => requests.fetchNextPage()} loading={requests.isFetchingNextPage} disabled={requests.isFetchingNextPage} />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
  spaced: { marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.sm, marginLeft: Spacing.xs, letterSpacing: 0.6 },
});
