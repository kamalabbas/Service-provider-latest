import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useMyPriceItemRequests } from "@/hooks/useProviderPrices";
import { canViewProviderPrices } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { PRICE_REQUEST_STATUS_LABELS, canWriteProviderPrices } from "@/utility/providerPriceRules";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet } from "react-native";

// Guide 14: the provider's suggestions for new price-guide items.
export default function PriceRequestsScreen() {
  const router = useRouter();
  const { user, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const requests = useMyPriceItemRequests({});

  useFocusEffect(useCallback(() => {
    requests.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (!canViewProviderPrices(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view item suggestions." /></Screen>;
  }

  const list = requests.data ?? [];

  return (
    <Screen hasHeader title="Item suggestions" subtitle="Suggest an item that's missing from the price guide. An administrator reviews each one.">
      {canWriteProviderPrices(user, userTypeCode) && business.data ? (
        <PrimaryButton title="Suggest a new item" leftIcon="add-circle-outline" onPress={() => router.push("/(dashboard)/(menu)/price-request-new")} style={styles.spaced} />
      ) : null}

      {requests.isLoading ? (
        <Loader visible overlay={false} message="Loading suggestions…" />
      ) : list.length === 0 ? (
        <Notice message="No suggestions yet." />
      ) : (
        <>
          <ListSection>
            {list.map((request) => (
              <ListRow
                key={request.id}
                icon="bulb-outline"
                title={request.proposedName}
                subtitle={`${PRICE_REQUEST_STATUS_LABELS[request.status] ?? request.status} · ${request.occupationName} · ${formatLocalTimestamp(request.createdAtUtc)}`}
                onPress={() => router.push({ pathname: "/(dashboard)/(menu)/price-request", params: { id: String(request.id) } })}
              />
            ))}
          </ListSection>
          {requests.hasNextPage ? (
            <PrimaryButton
              title={requests.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => requests.fetchNextPage()}
              loading={requests.isFetchingNextPage}
              disabled={requests.isFetchingNextPage}
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
