import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useCreatePriceItemRequest } from "@/hooks/useProviderPrices";
import { useMyServices } from "@/hooks/useServices";
import { mapApiValidation } from "@/services/apiError";
import { useToastStore } from "@/stores/toastStore";
import { audToCents, centsToAud } from "@/utility/apiValues";
import { PRICE_ITEM_REQUEST_FIELDS, PriceItemRequestFormValues, canWriteProviderPrices, priceItemRequestSchema } from "@/utility/providerPriceRules";
import { yupResolver } from "@hookform/resolvers/yup";
import { useRouter } from "expo-router";
import { ComponentProps } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet } from "react-native";

// Guide 14: suggest a missing item. The occupation must match one of your active listings.
export default function PriceRequestNewScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const { user, member, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const services = useMyServices();
  const create = useCreatePriceItemRequest();
  const { control, handleSubmit, setError, formState: { errors } } = useForm<PriceItemRequestFormValues>({
    resolver: yupResolver(priceItemRequestSchema),
    defaultValues: { occupationCode: "", proposedName: "", proposedDescription: "", suggestedPrice: "" },
  });

  if (member.isLoading || business.isLoading || services.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;
  if (!canWriteProviderPrices(user, userTypeCode) || !business.data) {
    return <Screen hasHeader><Notice tone="warning" message="You need an active business and permission to suggest items." /></Screen>;
  }

  // One option per occupation with an active listing.
  const occupations = new Map((services.data ?? []).filter((service) => !service.archivedAtUtc).map((service) => [service.occupationCode, service.occupationName]));
  const options = [...occupations].map(([value, label]) => ({ label, value }));

  const onSubmit = (values: PriceItemRequestFormValues) => {
    if (create.isPending) return;
    create.mutate({
      occupationCode: values.occupationCode,
      proposedName: values.proposedName,
      proposedDescription: values.proposedDescription,
      suggestedPrice: values.suggestedPrice.trim() ? centsToAud(audToCents(values.suggestedPrice.trim())) : null,
    }, {
      onSuccess: () => {
        showToast("Suggestion sent for review.", "success");
        router.back();
      },
      onError: (error) => {
        const { fieldErrors } = mapApiValidation(error, PRICE_ITEM_REQUEST_FIELDS);
        PRICE_ITEM_REQUEST_FIELDS.forEach((field) => { if (fieldErrors[field]) setError(field, { message: fieldErrors[field] }); });
      },
    });
  };

  const text = (name: Exclude<keyof PriceItemRequestFormValues, "occupationCode">, label: string, extra: Partial<ComponentProps<typeof FormInput>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <FormInput label={label} value={value} onChangeText={onChange} onBlur={onBlur} error={errors[name]?.message} {...extra} />
      )}
    />
  );

  return (
    <Screen hasHeader title="Suggest a new item" subtitle="If approved, the item is added to the price guide later; you then submit your price separately.">
      {options.length === 0 ? (
        <Notice tone="warning" message="You need an active service listing to suggest an item for its occupation." style={styles.notice} />
      ) : null}
      <Controller
        control={control}
        name="occupationCode"
        render={({ field: { onChange, value } }) => (
          <SelectInput label="Occupation" placeholder="Choose an occupation" value={value} onChange={onChange} options={options} error={errors.occupationCode?.message} />
        )}
      />
      {text("proposedName", "Item name", { maxLength: 150, placeholder: "e.g. Ceiling fan installation" })}
      {text("proposedDescription", "Description (optional)", { multiline: true, maxLength: 2000 })}
      {text("suggestedPrice", "Suggested price (optional, AUD)", { keyboardType: "decimal-pad", placeholder: "0.00" })}
      <PrimaryButton
        title={create.isPending ? "Sending..." : "Send suggestion"}
        leftIcon="send-outline"
        onPress={handleSubmit(onSubmit)}
        loading={create.isPending}
        disabled={create.isPending || options.length === 0}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.lg },
});
