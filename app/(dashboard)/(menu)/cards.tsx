import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useMyCards } from "@/hooks/useCards";
import { useAuthStore } from "@/stores/authStore";
import { canViewCards } from "@/utility/access";
import { CARD_STATUS_LABELS, cardValidityText } from "@/utility/cardRules";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet } from "react-native";

// Guide 11-b: issued cards for the member and their employees.
export default function CardsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const cards = useMyCards({});

  // Validity is time-based too; refresh when the screen comes back.
  useFocusEffect(useCallback(() => {
    cards.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (!canViewCards(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view cards." /></Screen>;
  }

  const list = cards.data ?? [];

  return (
    <Screen hasHeader title="My cards" subtitle="Cards issued to you and your employees.">
      <PrimaryButton title="Card requests" variant="ghost" leftIcon="document-text-outline" onPress={() => router.push("/(dashboard)/(menu)/card-requests")} style={styles.spaced} />
      {cards.isLoading ? (
        <Loader visible overlay={false} message="Loading cards…" />
      ) : list.length === 0 ? (
        <Notice message="No cards yet. A card is issued after an administrator approves your request." />
      ) : (
        <>
          <ListSection>
            {list.map((card) => (
              <ListRow
                key={card.id}
                icon={card.subjectType === "employee" ? "people-outline" : "card-outline"}
                title={`${card.subjectName} · ${card.cardNumber}`}
                subtitle={`${cardValidityText(card)} · ${CARD_STATUS_LABELS[card.status] ?? card.status}`}
                onPress={() => router.push({ pathname: "/(dashboard)/(menu)/card", params: { id: String(card.id) } })}
              />
            ))}
          </ListSection>
          {cards.hasNextPage ? (
            <PrimaryButton
              title={cards.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => cards.fetchNextPage()}
              loading={cards.isFetchingNextPage}
              disabled={cards.isFetchingNextPage}
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
  spaced: { marginBottom: Spacing.lg },
  end: { textAlign: "center" },
});
