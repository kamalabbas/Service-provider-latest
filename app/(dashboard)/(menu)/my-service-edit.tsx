import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useMyProfile } from "@/hooks/useProfile";
import { useInvalidateReferenceChoices, useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useMyService, useSaveMyService } from "@/hooks/useServices";
import { Business } from "@/interfaces/business.interface";
import { ServiceListing } from "@/interfaces/service.interface";
import { mapApiValidation, toAppError } from "@/services/apiError";
import { useToastStore } from "@/stores/toastStore";
import { canManageOwnServices } from "@/utility/access";
import { referenceOptions } from "@/utility/referenceOptions";
import { SERVICE_FIELDS, ServiceFormValues, allowedOccupationCodes, serviceFormValues, serviceSchema, toSaveServiceRequest } from "@/utility/serviceForm";
import { yupResolver } from "@hookform/resolvers/yup";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ComponentProps } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet } from "react-native";

// Guide 07: create (POST) or edit (PUT) an active listing.
export default function MyServiceEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const serviceId = id && Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const { user, member, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const profile = useMyProfile();
  const service = useMyService(serviceId);

  if (member.isLoading || business.isLoading || profile.isLoading || service.isLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;
  }
  if (!canManageOwnServices(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to publish services." /></Screen>;
  }
  if (!business.data) {
    return <Screen hasHeader><Notice tone="warning" message="Add your business first. Listings are published under your active business." /></Screen>;
  }
  if (serviceId !== null && (!service.data || service.data.archivedAtUtc)) {
    return <Screen hasHeader><Notice tone="warning" message="Archived listings can't be edited. Create a new listing instead." /></Screen>;
  }

  const allowed = allowedOccupationCodes(userTypeCode, profile.data?.occupations.map((item) => item.occupationCode) ?? []);
  return (
    <ServiceForm
      key={service.data?.id ?? "new"}
      listing={service.data ?? null}
      business={business.data}
      allowedOccupations={allowed}
    />
  );
}

type ServiceFormProps = {
  listing: ServiceListing | null;
  business: Business;
  /** null: any active occupation (Builder/Developer). */
  allowedOccupations: readonly string[] | null;
};

function ServiceForm({ listing, business, allowedOccupations }: ServiceFormProps) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const regions = useReferenceChoices("regions");
  const occupations = useReferenceChoices("occupations");
  const invalidateChoices = useInvalidateReferenceChoices();
  const save = useSaveMyService(listing?.id ?? null);

  const { control, handleSubmit, setError, setValue, formState: { errors } } = useForm<ServiceFormValues>({
    resolver: yupResolver(serviceSchema),
    // A new listing starts at the business location; the provider can change it.
    defaultValues: serviceFormValues(listing, listing ? null : business),
  });

  const occupationChoices = allowedOccupations === null
    ? occupations.data
    : occupations.data?.filter((choice) => allowedOccupations.includes(choice.code));
  const occupationOptions = referenceOptions(occupationChoices, listing?.occupationCode);
  const regionOptions = referenceOptions(regions.data, listing?.regionCode);

  const applyBusinessLocation = () => {
    setValue("suburb", business.suburb);
    setValue("regionCode", business.regionCode);
    setValue("latitude", String(business.latitude));
    setValue("longitude", String(business.longitude));
  };

  const onSubmit = (values: ServiceFormValues) => {
    if (save.isPending) return;
    save.mutate(toSaveServiceRequest(values), {
      onSuccess: () => {
        showToast(listing ? "The listing has been updated." : "Your service is now listed.", "success");
        router.back();
      },
      onError: (error) => {
        if (toAppError(error).status === 400) invalidateChoices();
        const { fieldErrors } = mapApiValidation(error, SERVICE_FIELDS);
        SERVICE_FIELDS.forEach((field) => {
          if (fieldErrors[field]) setError(field, { message: fieldErrors[field] });
        });
      },
    });
  };

  const text = (name: Exclude<keyof ServiceFormValues, "occupationCode" | "regionCode">, label: string, extra: Partial<ComponentProps<typeof FormInput>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <FormInput label={label} value={value} onChangeText={onChange} onBlur={onBlur} error={errors[name]?.message} {...extra} />
      )}
    />
  );

  return (
    <Screen hasHeader title={listing ? "Edit listing" : "Add a service"} subtitle={`Published under ${business.businessName}.`}>
      {text("title", "Title", { placeholder: "e.g. Switchboard upgrades" })}
      {text("description", "Description", { multiline: true, numberOfLines: 5, textAlignVertical: "top", style: styles.description })}
      <Controller
        control={control}
        name="occupationCode"
        render={({ field: { onChange, value } }) => (
          <SelectInput label="Occupation" placeholder="Choose an occupation" value={value} onChange={onChange}
            options={occupationOptions} loading={occupations.isLoading} error={errors.occupationCode?.message} />
        )}
      />
      {allowedOccupations !== null && allowedOccupations.length === 0 ? (
        <Notice tone="warning" message="Add an occupation to your profile before listing a service." style={styles.notice} />
      ) : allowedOccupations !== null ? (
        <Notice message="Only occupations on your profile can be listed." style={styles.notice} />
      ) : null}

      <Notice message="The listing has its own location. It starts at your business address; change it if you work elsewhere." style={styles.notice} />
      <PrimaryButton title="Use my business location" variant="ghost" size="md" leftIcon="business-outline" onPress={applyBusinessLocation} style={styles.notice} />
      {text("suburb", "Suburb")}
      <Controller
        control={control}
        name="regionCode"
        render={({ field: { onChange, value } }) => (
          <SelectInput label="State or territory" placeholder="Choose a state or territory" value={value} onChange={onChange}
            options={regionOptions} loading={regions.isLoading} error={errors.regionCode?.message} />
        )}
      />
      {text("latitude", "Latitude", { keyboardType: "numbers-and-punctuation", placeholder: "-33.8688" })}
      {text("longitude", "Longitude", { keyboardType: "numbers-and-punctuation", placeholder: "151.2093" })}

      <PrimaryButton
        title={save.isPending ? "Saving..." : listing ? "Save changes" : "Publish service"}
        onPress={handleSubmit(onSubmit)}
        disabled={save.isPending}
        loading={save.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.lg },
  description: { minHeight: 120 },
});
