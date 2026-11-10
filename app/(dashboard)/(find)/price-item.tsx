import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { usePriceCatalogueItem } from "@/hooks/usePriceCatalogue";
import { formatAud } from "@/utility/apiValues";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

// Guide 13/22: one item of the Global price list. Members see a single price (the admin override,
// else the provider average, else Guide); Guide, Min/Max and averages aren't returned to them.
export default function PriceItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const { data: item, isLoading, isError } = usePriceCatalogueItem(itemId);

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the item…" /></Screen>;
  if (isError || !item) return <Screen hasHeader><Notice tone="warning" message="This item is no longer in the price guide." /></Screen>;

  return (
    <Screen hasHeader title={item.name} subtitle={item.occupationName}>
      <ListSection title="Typical price" footer="Based on what providers charge. A guide only, not a quote; tax isn't specified.">
        <ListRow icon="pricetag-outline" title={formatAud(item.price)} subtitle="Typical price in AUD" />
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
