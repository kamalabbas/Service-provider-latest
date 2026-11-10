import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { usePaymentAccount } from "@/hooks/usePayments";
import { usePriceCatalogue } from "@/hooks/usePriceCatalogue";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useAuthStore } from "@/stores/authStore";
import { canViewPriceCatalogue } from "@/utility/access";
import { formatAud } from "@/utility/apiValues";
import { referenceOptions } from "@/utility/referenceOptions";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet } from "react-native";

const ANY = "";

// Guide 13: shared AUD price guidance, separate from listings and quotes.
export default function PriceGuideScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const occupations = useReferenceChoices("occupations");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [occupation, setOccupation] = useState(ANY);
  const account = usePaymentAccount();
  // Guide 22: the Global list is a paid benefit (either plan); the server decides who has it.
  const hasAccess = account.data?.hasPriceListAccess === true;
  const items = usePriceCatalogue({ search: search || undefined, occupationCode: occupation || undefined }, hasAccess);

  // Averages and benefits change without a notification; refresh on return (refetch ignores
  // `enabled`, so only with access).
  useFocusEffect(useCallback(() => {
    account.refetch();
    if (hasAccess) items.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]));

  if (!canViewPriceCatalogue(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view the price guide." /></Screen>;
  }

  if (account.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;
  if (!hasAccess) {
    return (
      <Screen hasHeader title="Price guide" subtitle="Typical prices for common jobs, based on what providers charge.">
        <Notice message="The price guide is included with the Price list and Provider plans." style={styles.spaced} />
        <PrimaryButton title="See plans" leftIcon="pricetags-outline" onPress={() => router.push("/(dashboard)/(menu)/billing", { withAnchor: true })} />
      </Screen>
    );
  }

  const list = items.data ?? [];

  return (
    <Screen hasHeader title="Price guide" subtitle="Typical prices for common jobs. A guide only, not a quote; tax isn't specified.">
      <FormInput
        placeholder="Search items"
        leftIcon="search-outline"
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={() => setSearch(searchText.trim())}
        returnKeyType="search"
        maxLength={100}
        onBlur={() => setSearch(searchText.trim())}
      />
      <SelectInput
        label="Occupation"
        value={occupation}
        onChange={setOccupation}
        options={[{ label: "Any occupation", value: ANY }, ...referenceOptions(occupations.data)]}
        loading={occupations.isLoading}
      />

      {items.isLoading ? (
        <Loader visible overlay={false} message="Loading prices…" />
      ) : list.length === 0 ? (
        <Notice message={search || occupation ? "No items match. Try another search or occupation." : "The price guide is empty for now."} />
      ) : (
        <>
          <ListSection>
            {list.map((item) => (
              <ListRow
                key={item.id}
                icon="pricetag-outline"
                title={`${item.name} · ${formatAud(item.price)}`}
                subtitle={item.occupationName}
                onPress={() => router.push({ pathname: "/(dashboard)/(find)/price-item", params: { id: String(item.id) } })}
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
            <ThemedText type="footnote" tone="muted" style={styles.end}>End of list.</ThemedText>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  end: { textAlign: "center", marginTop: Spacing.sm },
  spaced: { marginBottom: Spacing.lg },
});
