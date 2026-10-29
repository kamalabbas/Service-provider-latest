import { FormInput } from "@/components/form/FormInput";
import { ThemedText } from "@/components/ThemedText";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { PriceCatalogueItem } from "@/interfaces/priceCatalogue.interface";
import { audToCents, centsToAud, formatAud } from "@/utility/apiValues";
import { priceRangeError } from "@/utility/providerPriceRules";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

type PriceInputModalProps = {
  visible: boolean;
  title: string;
  confirmLabel: string;
  /** The item's current range; null when it can't be loaded (the server still checks). */
  item: (Pick<PriceCatalogueItem, "minProviderPrice" | "maxProviderPrice"> & Partial<Pick<PriceCatalogueItem, "guidePrice">>) | null;
  initialPrice?: number | null;
  isLoading: boolean;
  onConfirm: (price: number) => void;
  onCancel: () => void;
};

// Guide 14: enter an AUD price, checked against the item's current range before sending.
export function PriceInputModal({ visible, title, confirmLabel, item, initialPrice, isLoading, onConfirm, onCancel }: PriceInputModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const tileBackground = useThemeColor({}, "muted");
  const tint = useThemeColor({}, "tint");

  useEffect(() => {
    if (visible) {
      setValue(initialPrice == null ? "" : initialPrice.toFixed(2));
      setError(undefined);
    }
  }, [visible, initialPrice]);

  const confirm = () => {
    const problem = item ? priceRangeError(value, item) : null;
    if (problem) return setError(problem);
    try {
      onConfirm(centsToAud(audToCents(value.trim())));
    } catch {
      setError("Enter a positive amount with at most 2 decimal places.");
    }
  };

  const tile = (label: string, amount: number) => (
    <View style={[styles.tile, { backgroundColor: tileBackground }]}>
      <ThemedText type="footnote" tone="muted">{label}</ThemedText>
      <ThemedText type="headline" style={{ color: tint }}>{formatAud(amount)}</ThemedText>
    </View>
  );

  return (
    <ConfirmModal
      visible={visible}
      icon="pricetag-outline"
      title={title}
      confirmLabel={confirmLabel}
      isLoading={isLoading}
      onConfirm={confirm}
      onCancel={onCancel}
      customContent={
        <View style={styles.content}>
          {item ? (
            <>
              <View style={styles.tiles}>
                {tile("Minimum", item.minProviderPrice)}
                {tile("Maximum", item.maxProviderPrice)}
              </View>
              {item.guidePrice != null ? (
                <ThemedText type="caption" tone="muted">{`Guide price ${formatAud(item.guidePrice)}. Your price must be within the range above.`}</ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText type="caption" tone="muted">Enter your price in AUD.</ThemedText>
          )}
          <FormInput label="Your price (AUD)" value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="0.00" leftIcon="cash-outline" error={error} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.md },
  tiles: { flexDirection: "row", gap: Spacing.sm },
  tile: { flex: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xxs },
});
