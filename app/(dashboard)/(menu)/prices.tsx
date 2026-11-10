import { SelectInput } from "@/components/form/SelectInput";
import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { PriceInputModal } from "@/components/price/PriceInputModal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useCurrentProviderPrices, useMyProviderPrices, useProviderPriceActions } from "@/hooks/useProviderPrices";
import type { ProviderCurrentPrice } from "@/interfaces/providerPrice.interface";
import { useToastStore } from "@/stores/toastStore";
import { useThemeColor } from "@/hooks/useThemeColor";
import { canViewProviderPrices } from "@/utility/access";
import { formatAud } from "@/utility/apiValues";
import { canWriteProviderPrices, currentUtcYear } from "@/utility/providerPriceRules";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

const ALL = "";

const VIEWS = [
  { label: "Price list", value: "list" },
  { label: "Yearly records", value: "years" },
] as const;

// Guide 14: the provider's yearly prices, with business/year/withdrawn filters.
export default function PricesScreen() {
  const router = useRouter();
  const { user, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const thisYear = currentUtcYear();
  const [view, setView] = useState<"list" | "years">("list");
  const [year, setYear] = useState(ALL);
  const [includeWithdrawn, setIncludeWithdrawn] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const prices = useMyProviderPrices({ year: year ? Number(year) : undefined, includeWithdrawn, includeArchived });

  useFocusEffect(useCallback(() => {
    prices.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (!canViewProviderPrices(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view your prices." /></Screen>;
  }

  const list = prices.data ?? [];
  const canWrite = canWriteProviderPrices(user, userTypeCode) && !!business.data;
  const years = [{ label: "All years", value: ALL }, ...[0, 1, 2, 3].map((back) => ({ label: String(thisYear - back), value: String(thisYear - back) }))];
  const toggle = (label: string, value: boolean, onChange: (next: boolean) => void) => (
    <View style={styles.switchRow}>
      <ThemedText style={styles.switchLabel}>{label}</ThemedText>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: tint, false: border }} accessibilityLabel={label} />
    </View>
  );

  return (
    <Screen hasHeader title="My prices" subtitle={`What your business charges for price-guide items. Prices are per calendar year (${thisYear} now).`}>
      <View style={styles.actions}>
        {canWrite ? <PrimaryButton title="Add a price" leftIcon="add-circle-outline" onPress={() => router.push("/(dashboard)/(menu)/price-submit")} /> : null}
        <PrimaryButton title="Suggest a new item" variant="secondary" leftIcon="bulb-outline" onPress={() => router.push("/(dashboard)/(menu)/price-requests")} />
      </View>

      <SegmentedControl options={VIEWS} value={view} onChange={setView} style={styles.view} />

      {view === "list" ? (
        <CurrentPriceList canWrite={canWrite} />
      ) : (
      <>
      <SelectInput label="Year" value={year} onChange={setYear} options={years} />
      {toggle("Show withdrawn", includeWithdrawn, setIncludeWithdrawn)}
      {toggle("Include deleted businesses", includeArchived, setIncludeArchived)}

      {prices.isLoading ? (
        <Loader visible overlay={false} message="Loading prices…" />
      ) : list.length === 0 ? (
        <Notice message="No prices here yet." />
      ) : (
        <>
          <ListSection>
            {list.map((row) => (
              <ListRow
                key={row.id}
                icon={row.withdrawnAtUtc ? "remove-circle-outline" : "pricetag-outline"}
                title={`${row.itemName} · ${formatAud(row.price)}`}
                subtitle={[String(row.calendarYear), row.businessName, row.withdrawnAtUtc ? "Withdrawn" : null, row.itemStatus === "retired" ? "Item retired" : null]
                  .filter(Boolean).join(" · ")}
                onPress={() => router.push({ pathname: "/(dashboard)/(menu)/price", params: { id: String(row.id) } })}
              />
            ))}
          </ListSection>
          {prices.hasNextPage ? (
            <PrimaryButton
              title={prices.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => prices.fetchNextPage()}
              loading={prices.isFetchingNextPage}
              disabled={prices.isFetchingNextPage}
            />
          ) : (
            <ThemedText type="footnote" tone="muted" style={styles.end}>End of list.</ThemedText>
          )}
        </>
      )}
      </>
      )}
    </Screen>
  );
}

/**
 * Guide 22: the business's price list: per item, the effective price (your latest custom price,
 * or Guide when you have none or withdrew it). Tap a custom price to manage it, or a Guide row
 * to set your own price within the current range.
 */
function CurrentPriceList({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const list = useCurrentProviderPrices();
  const actions = useProviderPriceActions();
  const [pricing, setPricing] = useState<ProviderCurrentPrice | null>(null);

  if (list.isLoading) return <Loader visible overlay={false} message="Loading your price list…" />;
  const rows = list.data ?? [];
  if (rows.length === 0) return <Notice message="No items to price yet. Items appear here when they match one of your active services." />;

  return (
    <>
      <ListSection footer="Without your own price, the Guide price counts as yours. Customers see one combined price per item.">
        {rows.map((row) => {
          const custom = row.priceSource === "custom" && !row.withdrawnAtUtc;
          return (
            <ListRow
              key={row.id}
              icon={custom ? "pricetag" : "pricetag-outline"}
              title={`${row.name} · ${formatAud(row.effectivePrice)}`}
              subtitle={[
                row.occupationName,
                custom ? (row.calendarYear ? `Your ${row.calendarYear} price` : "Your price") : "Guide price",
                `Allowed ${formatAud(row.minProviderPrice)}–${formatAud(row.maxProviderPrice)}`,
              ].join(" · ")}
              onPress={row.submissionId
                ? () => router.push({ pathname: "/(dashboard)/(menu)/price", params: { id: String(row.submissionId) } })
                : canWrite ? () => setPricing(row) : undefined}
            />
          );
        })}
      </ListSection>
      {list.hasNextPage ? (
        <PrimaryButton title={list.isFetchingNextPage ? "Loading..." : "Show more"} variant="secondary" onPress={() => list.fetchNextPage()}
          loading={list.isFetchingNextPage} disabled={list.isFetchingNextPage} />
      ) : null}

      <PriceInputModal
        visible={pricing !== null}
        title={pricing ? pricing.name : ""}
        confirmLabel="Set my price"
        item={pricing}
        isLoading={actions.submit.isPending}
        onCancel={() => setPricing(null)}
        onConfirm={(price) => pricing && actions.submit.mutate({ itemId: pricing.id, price }, {
          onSuccess: () => { setPricing(null); showToast("Your price is saved.", "success"); },
        })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  view: { marginBottom: Spacing.lg },
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
  switchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  switchLabel: { flex: 1 },
  end: { textAlign: "center" },
});
