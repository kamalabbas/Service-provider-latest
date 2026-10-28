import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { usePriceCatalogueItem } from "@/hooks/usePriceCatalogue";
import { formatAud } from "@/utility/apiValues";
import { priceRangeText, providerAverageText } from "@/utility/priceCatalogueRules";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

// Guide 13: one catalogue item. The guide price and the provider average are shown separately.
export default function PriceItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const { data: item, isLoading, isError } = usePriceCatalogueItem(itemId);

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the item…" /></Screen>;
  if (isError || !item) return <Screen hasHeader><Notice tone="warning" message="This item is no longer in the price guide." /></Screen>;

  return (
    <Screen hasHeader title={item.name} subtitle={`${item.occupationName} · ${item.code}`}>
      <ListSection title="Guide price" footer="Price guidance only. Not a quote, and tax isn't specified.">
        <ListRow icon="pricetag-outline" title={formatAud(item.guidePrice)} subtitle="Guide price" />
        <ListRow icon="swap-horizontal-outline" title={priceRangeText(item)} subtitle="Range providers can submit within" />
      </ListSection>

      <ListSection title="What providers charge">
        <ListRow icon="people-outline" title={providerAverageText(item)} />
      </ListSection>

      {item.description ? (
        <ListSection title="About">
          <View style={styles.description}>
            <ThemedText>{item.description}</ThemedText>
          </View>
        </ListSection>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
});
