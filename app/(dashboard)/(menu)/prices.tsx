import { SelectInput } from "@/components/form/SelectInput";
import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useMyProviderPrices } from "@/hooks/useProviderPrices";
import { useThemeColor } from "@/hooks/useThemeColor";
import { canViewProviderPrices } from "@/utility/access";
import { formatAud } from "@/utility/apiValues";
import { canWriteProviderPrices, currentUtcYear } from "@/utility/providerPriceRules";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

const ALL = "";

// Guide 14: the provider's yearly prices, with business/year/withdrawn filters.
export default function PricesScreen() {
  const router = useRouter();
  const { user, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const thisYear = currentUtcYear();
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

      <SelectInput label="Year" value={year} onChange={setYear} options={years} />
      {toggle("Show withdrawn", includeWithdrawn, setIncludeWithdrawn)}
      {toggle("Include archived businesses", includeArchived, setIncludeArchived)}

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
  switchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  switchLabel: { flex: 1 },
  end: { textAlign: "center" },
});
