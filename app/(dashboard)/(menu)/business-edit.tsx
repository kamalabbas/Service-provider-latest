import { FormInput } from "@/components/form/FormInput";
import { LocationPicker } from "@/components/form/LocationPicker";
import { SelectInput } from "@/components/form/SelectInput";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { useBusinessAccess, useMyBusiness, useSaveMyBusiness } from "@/hooks/useBusiness";
import { useInvalidateReferenceChoices, useReferenceChoices } from "@/hooks/useReferenceChoices";
import { Business } from "@/interfaces/business.interface";
import { mapApiValidation, toAppError } from "@/services/apiError";
import { useToastStore } from "@/stores/toastStore";
import { canManageOwnBusiness } from "@/utility/access";
import { parseCoordinates } from "@/utility/coordinates";
import { BUSINESS_FIELDS, BusinessFormValues, businessFormValues, businessSchema, toSaveBusinessRequest } from "@/utility/businessForm";
import { referenceOptions } from "@/utility/referenceOptions";
import { yupResolver } from "@hookform/resolvers/yup";
import { useRouter } from "expo-router";
import { ComponentProps } from "react";
import { Controller, useForm } from "react-hook-form";

// Guide 05: create (POST, only when none is active) or edit (PUT) the business.
export default function BusinessEditScreen() {
  const { user, member, userTypeCode } = useBusinessAccess();
  const { data: business, isLoading } = useMyBusiness();

  if (member.isLoading || isLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading your business…" /></Screen>;
  }
  if (!canManageOwnBusiness(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to change business details." /></Screen>;
  }
  // Remount with the saved record so a create becomes an edit.
  return <BusinessForm key={business?.id ?? "new"} business={business ?? null} />;
}

function BusinessForm({ business }: { business: Business | null }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const regions = useReferenceChoices("regions");
  const invalidateChoices = useInvalidateReferenceChoices();
  const { refetch } = useMyBusiness();
  const save = useSaveMyBusiness(Boolean(business));

  const { control, handleSubmit, setError, setValue, watch, formState: { errors } } = useForm<BusinessFormValues>({
    resolver: yupResolver(businessSchema),
    defaultValues: businessFormValues(business),
  });
  // A retired saved region stays visible while unchanged; new choices must be active.
  const regionOptions = referenceOptions(regions.data, business?.regionCode);
  const [latitude, longitude] = watch(["latitude", "longitude"]);

  const onSubmit = (values: BusinessFormValues) => {
    if (save.isPending) return;
    save.mutate(toSaveBusinessRequest(values), {
      onSuccess: () => {
        showToast(business ? "Your business has been updated." : "Your business has been added.", "success");
        router.back();
      },
      onError: (error) => {
        const info = toAppError(error);
        // Timeouts and conflicts (e.g. a business already active) need the server's current state.
        if (info.kind === "timeout" || info.status === 400 || info.status === 409) refetch();
        if (info.status === 400) invalidateChoices();
        const { fieldErrors } = mapApiValidation(error, BUSINESS_FIELDS);
        BUSINESS_FIELDS.forEach((field) => {
          if (fieldErrors[field]) setError(field, { message: fieldErrors[field] });
        });
      },
    });
  };

  const text = (name: Exclude<keyof BusinessFormValues, "regionCode">, label: string, extra: Partial<ComponentProps<typeof FormInput>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <FormInput label={label} value={value} onChangeText={onChange} onBlur={onBlur} error={errors[name]?.message} {...extra} />
      )}
    />
  );

  return (
    <Screen hasHeader title={business ? "Edit business" : "Add your business"} subtitle="One active business per member.">
      {text("businessName", "Business name")}
      {text("abn", "ABN", { keyboardType: "number-pad", helperText: "11 digits. Spaces are removed." })}
      {text("acn", "ACN (optional)", { keyboardType: "number-pad", helperText: "9 digits, if your business is a company." })}
      {text("phone", "Phone (optional)", { keyboardType: "phone-pad" })}
      {text("mobilePhone", "Mobile (optional)", { keyboardType: "phone-pad" })}
      {text("streetAddress", "Street address", { autoComplete: "street-address" })}
      {text("suburb", "Suburb")}
      <Controller
        control={control}
        name="regionCode"
        render={({ field: { onChange, value } }) => (
          <SelectInput label="State or territory" placeholder="Choose a state or territory" value={value} onChange={onChange}
            options={regionOptions} loading={regions.isLoading} error={errors.regionCode?.message} />
        )}
      />
      {text("postalCode", "Postcode", { keyboardType: "number-pad" })}
      <LocationPicker
        label="Business location"
        value={parseCoordinates(latitude, longitude)}
        onChange={(point) => {
          setValue("latitude", String(point.latitude), { shouldValidate: true });
          setValue("longitude", String(point.longitude), { shouldValidate: true });
        }}
        error={errors.latitude?.message ?? errors.longitude?.message}
        helperText="Place the pin on your business address. Your current position is used only if you tap the button."
      />

      <PrimaryButton
        title={save.isPending ? "Saving..." : business ? "Save changes" : "Add business"}
        onPress={handleSubmit(onSubmit)}
        disabled={save.isPending}
        loading={save.isPending}
      />
    </Screen>
  );
}

