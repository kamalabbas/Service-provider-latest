import { SelectInput } from "@/components/form/SelectInput";
import { ThemedText } from "@/components/ThemedText";
import { QuoteCard } from "@/components/quote/QuoteCard";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spacing } from "@/constants/Theme";
import { useMyQuotes } from "@/hooks/useQuotes";
import { QuoteSide, QuoteStatus } from "@/interfaces/quote.interface";
import { useAuthStore } from "@/stores/authStore";
import { canViewQuotes } from "@/utility/access";
import { QUOTE_STATUS_LABELS } from "@/utility/quoteRules";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet } from "react-native";

const SIDES = [
  { label: "All", value: "all" },
  { label: "Received", value: "customer" },
  { label: "Sent", value: "provider" },
] as const;

const ANY = "";
const STATUS_OPTIONS = [{ label: "Any status", value: ANY }, ...Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({ label, value }))];

// Guide 09: quotes sent by my business and quotes I received.
export default function QuotesScreen() {
  const user = useAuthStore((state) => state.user);
  const [side, setSide] = useState<QuoteSide>("all");
  const [status, setStatus] = useState(ANY);
  const quotes = useMyQuotes({ side, status: (status || undefined) as QuoteStatus | undefined });

  // Status and expiry come from the server; refresh when returning to the tab.
  useFocusEffect(useCallback(() => {
    quotes.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (!canViewQuotes(user)) {
    return <Screen title="Quotes"><Notice tone="warning" message="You don't have permission to view quotes." /></Screen>;
  }

  const list = quotes.data ?? [];

  return (
    <Screen title="Quotes" subtitle="Quotes follow completed inspections.">
      <SegmentedControl options={SIDES} value={side} onChange={setSide} style={styles.spaced} />
      <SelectInput label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />

      {quotes.isLoading ? (
        <Loader visible overlay={false} message="Loading quotes…" />
      ) : list.length === 0 ? (
        <Notice message="No quotes here yet." />
      ) : (
        <>
          {list.map((quote) => <QuoteCard key={quote.id} quote={quote} userId={user?.id} />)}
          {quotes.hasNextPage ? (
            <PrimaryButton
              title={quotes.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => quotes.fetchNextPage()}
              loading={quotes.isFetchingNextPage}
              disabled={quotes.isFetchingNextPage}
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
