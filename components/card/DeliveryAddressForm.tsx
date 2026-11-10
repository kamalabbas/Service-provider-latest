import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Spacing } from "@/constants/Theme";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { CardDeliveryAddress } from "@/interfaces/cardRequest.interface";
import { deliveryAddressSchema, deliveryAddressValues } from "@/utility/cardRequestRules";
import { referenceOptions } from "@/utility/referenceOptions";
import { yupResolver } from "@hookform/resolvers/yup";
import { ComponentProps, ReactNode, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";

type DeliveryAddressFormProps = {
  initial?: CardDeliveryAddress | null;
  submitLabel: string;
  submitIcon?: ComponentProps<typeof PrimaryButton>["leftIcon"];
  isSaving: boolean;
  /** Blocks the submit button, e.g. until consent is given. */
  disabled?: boolean;
  /** Rendered between the fields and the buttons (fees, consent). */
  footer?: ReactNode;
  onCancel?: () => void;
  onSave: (address: CardDeliveryAddress, setFieldError: (field: keyof CardDeliveryAddress, message: string) => void) => void;
};

/** All four Australian address fields are required; the saved address is a snapshot on the request. */
export function DeliveryAddressForm({ initial, submitLabel, submitIcon, isSaving, disabled, footer, onCancel, onSave }: DeliveryAddressFormProps) {
  const regions = useReferenceChoices("regions");
  const { control, handleSubmit, setError, reset, formState: { errors, isDirty } } = useForm<CardDeliveryAddress>({
    resolver: yupResolver(deliveryAddressSchema),
    defaultValues: deliveryAddressValues(initial),
  });

  // Prefill once the profile or business arrives, unless the member already typed.
  useEffect(() => {
    if (initial && !isDirty) reset(deliveryAddressValues(initial));
  }, [initial, isDirty, reset]);

  const text = (name: "streetAddress" | "suburb" | "postalCode", label: string, extra: object = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <FormInput label={label} value={value} onChangeText={onChange} onBlur={onBlur} error={errors[name]?.message} {...extra} />
      )}
    />
  );

  return (
    <View style={styles.form}>
      {text("streetAddress", "Street address", { autoComplete: "street-address" })}
      {text("suburb", "Suburb")}
      <Controller
        control={control}
        name="regionCode"
        render={({ field: { onChange, value } }) => (
          <SelectInput label="State or territory" value={value} onChange={onChange}
            options={referenceOptions(regions.data, initial?.regionCode)} loading={regions.isLoading} error={errors.regionCode?.message} />
        )}
      />
      {text("postalCode", "Postcode", { keyboardType: "number-pad", autoComplete: "postal-code" })}
      {footer}
      <View style={styles.actions}>
        <PrimaryButton title={isSaving ? "Please wait..." : submitLabel} leftIcon={submitIcon}
          onPress={handleSubmit((values) => onSave(values, (field, message) => setError(field, { message })))} loading={isSaving} disabled={isSaving || disabled} />
        {onCancel ? <PrimaryButton title="Discard changes" variant="ghost" onPress={onCancel} disabled={isSaving} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: Spacing.xl },
  actions: { gap: Spacing.md, marginTop: Spacing.sm },
});
