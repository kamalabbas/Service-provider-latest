import { PriceInputModal } from "@/components/price/PriceInputModal";
import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useAvailablePriceItems, useProviderPriceActions } from "@/hooks/useProviderPrices";
import { PriceCatalogueItem } from "@/interfaces/priceCatalogue.interface";
import { useToastStore } from "@/stores/toastStore";
import { formatAud } from "@/utility/apiValues";
import { priceRangeText } from "@/utility/priceCatalogueRules";
import { canWriteProviderPrices, currentUtcYear } from "@/utility/providerPriceRules";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

// Guide 14: pick an item this business can price (matching active listing), then submit this year's price.
export default function PriceSubmitScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const { user, member, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const items = useAvailablePriceItems();
  const actions = useProviderPriceActions();
  const [selected, setSelected] = useState<PriceCatalogueItem | null>(null);

  if (member.isLoading || business.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;
  if (!canWriteProviderPrices(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to submit prices." /></Screen>;
  }
  if (!business.data) return <Screen hasHeader><Notice tone="warning" message="Add your business first." /></Screen>;

  const list = items.data ?? [];

  return (
    <Screen hasHeader title="Add a price" subtitle={`Your ${currentUtcYear()} price for an item. You can price items that match one of your active service listings.`}>
      {items.isLoading ? (
        <Loader visible overlay={false} message="Loading items…" />
      ) : list.length === 0 ? (
        <Notice message="No items are available to price. You need an active service listing for the item's occupation." />
      ) : (
        <>
          <ListSection>
            {list.map((item) => (
              <ListRow
                key={item.id}
                icon="pricetag-outline"
                title={`${item.name} · guide ${formatAud(item.guidePrice)}`}
                subtitle={`${item.occupationName} · range ${priceRangeText(item)}`}
                onPress={() => setSelected(item)}
              />
            ))}
          </ListSection>
          {items.hasNextPage ? (
            <PrimaryButton
              title={items.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => items.fetchNextPage()}
              loading={items.isFetchingNextPage}
              disabled={items.isFetchingNextPage}
            />
          ) : (
            <ThemedText type="footnote" tone="muted" style={styles.end}>
              {"Already priced an item this year? Edit it from My prices instead."}
            </ThemedText>
          )}
        </>
      )}

      <PriceInputModal
        visible={selected !== null}
        title={selected ? selected.name : ""}
        confirmLabel="Submit price"
        item={selected}
        isLoading={actions.submit.isPending}
        onCancel={() => setSelected(null)}
        onConfirm={(price) => selected && actions.submit.mutate({ itemId: selected.id, price }, {
          onSuccess: () => {
            setSelected(null);
            showToast("Price submitted.", "success");
            router.back();
          },
        })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  end: { textAlign: "center", marginTop: Spacing.sm },
});
