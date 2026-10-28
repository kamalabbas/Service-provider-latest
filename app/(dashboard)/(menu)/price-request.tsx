import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { usePriceItemRequest, usePriceItemRequestHistory } from "@/hooks/useProviderPrices";
import { formatAud, formatLocalTimestamp } from "@/utility/apiValues";
import { PRICE_REQUEST_STATUS_LABELS } from "@/utility/providerPriceRules";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

const STATUS_NOTES: Record<string, string> = {
  pending: "An administrator will review this suggestion.",
  approved: "Approved. The item will appear in the price guide once it's published; then you can submit your price.",
  rejected: "Rejected. See the reason below.",
  cancelled: "Cancelled, for example because the business was archived.",
};

// Guide 14: one item suggestion and its history.
export default function PriceRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const { data: request, isLoading } = usePriceItemRequest(requestId);
  const history = usePriceItemRequestHistory(requestId);

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the suggestion…" /></Screen>;
  if (!request) return <Screen hasHeader><Notice tone="warning" message="This suggestion is unavailable." /></Screen>;

  return (
    <Screen hasHeader title={request.proposedName} subtitle={PRICE_REQUEST_STATUS_LABELS[request.status] ?? request.status}>
      <Notice tone={request.status === "rejected" ? "warning" : "info"} message={STATUS_NOTES[request.status] ?? ""} style={styles.notice} />

      <ListSection title="Suggestion">
        <ListRow icon="construct-outline" title="Occupation" subtitle={request.occupationName} />
        <ListRow icon="business-outline" title="Business" subtitle={request.businessName} />
        {request.suggestedPrice != null ? <ListRow icon="pricetag-outline" title="Suggested price" subtitle={formatAud(request.suggestedPrice)} /> : null}
        {request.proposedDescription ? (
          <View style={styles.description}><ThemedText>{request.proposedDescription}</ThemedText></View>
        ) : null}
      </ListSection>

      {request.decisionReason ? (
        <ListSection title="Decision">
          <ListRow icon="chatbox-outline" title={PRICE_REQUEST_STATUS_LABELS[request.status]} subtitle={request.decisionReason} />
        </ListSection>
      ) : null}

      {(history.data ?? []).length ? (
        <ListSection title="History">
          {(history.data ?? []).map((event) => (
            <ListRow
              key={event.id}
              icon="time-outline"
              title={PRICE_REQUEST_STATUS_LABELS[event.status as keyof typeof PRICE_REQUEST_STATUS_LABELS] ?? event.action}
              subtitle={[formatLocalTimestamp(event.createdAtUtc), event.reason].filter(Boolean).join(" · ")}
            />
          ))}
        </ListSection>
      ) : null}
      {history.hasNextPage ? <PrimaryButton title="Show more history" variant="ghost" onPress={() => history.fetchNextPage()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.lg },
  description: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
});
