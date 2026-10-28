import { FormInput } from "@/components/form/FormInput";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PriceCatalogueItem } from "@/interfaces/priceCatalogue.interface";
import { audToCents, centsToAud } from "@/utility/apiValues";
import { priceRangeText } from "@/utility/priceCatalogueRules";
import { priceRangeError } from "@/utility/providerPriceRules";
import { useEffect, useState } from "react";

type PriceInputModalProps = {
  visible: boolean;
  title: string;
  confirmLabel: string;
  /** The item's current range; null when it can't be loaded (the server still checks). */
  item: Pick<PriceCatalogueItem, "minProviderPrice" | "maxProviderPrice"> | null;
  initialPrice?: number | null;
  isLoading: boolean;
  onConfirm: (price: number) => void;
  onCancel: () => void;
};

// Guide 14: enter an AUD price, checked against the item's current range before sending.
export function PriceInputModal({ visible, title, confirmLabel, item, initialPrice, isLoading, onConfirm, onCancel }: PriceInputModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

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

  return (
    <ConfirmModal
      visible={visible}
      icon="pricetag-outline"
      title={title}
      message={item ? `Allowed range: ${priceRangeText(item)} (AUD).` : "Enter your price in AUD."}
      confirmLabel={confirmLabel}
      isLoading={isLoading}
      onConfirm={confirm}
      onCancel={onCancel}
      customContent={
        <FormInput label="Your price (AUD)" value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="0.00" leftIcon="cash-outline" error={error} />
      }
    />
  );
}
