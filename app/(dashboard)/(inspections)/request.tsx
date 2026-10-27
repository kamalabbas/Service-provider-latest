import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useCreateInspection } from "@/hooks/useInspections";
import { useMyProfile } from "@/hooks/useProfile";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useDiscoveredService } from "@/hooks/useServices";
import { Profile } from "@/interfaces/profile.interface";
import { DiscoveredService } from "@/interfaces/service.interface";
import { mapApiValidation } from "@/services/apiError";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { canRequestInspectionFor } from "@/utility/access";
import {
  INSPECTION_REQUEST_FIELDS,
  InspectionRequestFormValues,
  inspectionRequestSchema,
  inspectionRequestValues,
  toCreateInspectionRequest,
} from "@/utility/inspectionRules";
import { referenceOptions } from "@/utility/referenceOptions";
import { yupResolver } from "@hookform/resolvers/yup";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet } from "react-native";

// Guide 08: request an inspection of a discovered service, at an explicit visit address.
export default function RequestInspectionScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const user = useAuthStore((state) => state.user);
  const service = useDiscoveredService(Number(serviceId));
  const profile = useMyProfile();

  if (service.isLoading || profile.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;
  if (!service.data) return <Screen hasHeader><Notice tone="warning" message="This service is no longer available." /></Screen>;
  if (!canRequestInspectionFor(user, service.data)) {
    return <Screen hasHeader><Notice tone="warning" message="You can't request an inspection for this service right now, for example because you already have an open request." /></Screen>;
  }
  return <RequestForm service={service.data} profile={profile.data ?? null} />;
}

function RequestForm({ service, profile }: { service: DiscoveredService; profile: Profile | null }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const regions = useReferenceChoices("regions");
  const create = useCreateInspection();
  const { control, handleSubmit, setError, formState: { errors } } = useForm<InspectionRequestFormValues>({
    resolver: yupResolver(inspectionRequestSchema),
    defaultValues: inspectionRequestValues(profile),
  });

  const onSubmit = (values: InspectionRequestFormValues) => {
    if (create.isPending) return;
    create.mutate(toCreateInspectionRequest(service.id, values), {
      onSuccess: (response) => {
        showToast("Your inspection request has been sent.", "success");
        if (response.data) router.replace({ pathname: "/(dashboard)/(inspections)/[id]", params: { id: String(response.data.id) } });
        else router.back();
      },
      onError: (error) => {
        const { fieldErrors } = mapApiValidation(error, INSPECTION_REQUEST_FIELDS);
        INSPECTION_REQUEST_FIELDS.forEach((field) => {
          if (fieldErrors[field]) setError(field, { message: fieldErrors[field] });
        });
      },
    });
  };

  const text = (name: Exclude<keyof InspectionRequestFormValues, "regionCode">, label: string, extra: object = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <FormInput label={label} value={value} onChangeText={onChange} onBlur={onBlur} error={errors[name]?.message} {...extra} />
      )}
    />
  );

  return (
    <Screen hasHeader title={service.title} subtitle={`${service.businessName} · ${service.occupationName}`}>
      <Notice message="Where should the provider visit? This starts with your profile address. It can't be changed after sending; cancel and request again if needed." style={styles.notice} />
      {text("streetAddress", "Street address")}
      {text("suburb", "Suburb")}
      <Controller
        control={control}
        name="regionCode"
        render={({ field: { onChange, value } }) => (
          <SelectInput label="State or territory" placeholder="Choose a state or territory" value={value} onChange={onChange}
            options={referenceOptions(regions.data, profile?.regionCode)} loading={regions.isLoading} error={errors.regionCode?.message} />
        )}
      />
      {text("postalCode", "Postcode", { keyboardType: "number-pad" })}
      {text("note", "Note for the provider (optional)", { multiline: true, maxLength: 2000 })}
      <PrimaryButton
        title={create.isPending ? "Sending..." : "Send request"}
        leftIcon="send-outline"
        onPress={handleSubmit(onSubmit)}
        loading={create.isPending}
        disabled={create.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.lg },
});
