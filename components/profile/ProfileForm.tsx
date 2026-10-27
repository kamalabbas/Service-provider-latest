import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { SelectMultiInput } from "@/components/form/SelectMultiInput";
import { ThemedText } from "@/components/ThemedText";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useMyProfile, useSaveMyProfile } from "@/hooks/useProfile";
import { useInvalidateReferenceChoices, useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Profile, ProfileResponse } from "@/interfaces/profile.interface";
import { mapApiValidation, toAppError } from "@/services/apiError";
import { useAuthStore } from "@/stores/authStore";
import { canEditOwnProfile } from "@/utility/access";
import {
  PROFILE_FIELDS,
  ProfileFormValues,
  PUBLIC_GOVERNMENT_SECTOR,
  TRADEPERSON,
  profileFormValues,
  profileSchema,
  toSaveProfileRequest,
} from "@/utility/profileForm";
import { referenceLabel, referenceOptions } from "@/utility/referenceOptions";
import { yupResolver } from "@hookform/resolvers/yup";
import { PropsWithChildren } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Switch, View } from "react-native";

type ProfileFormProps = {
  /** The saved profile, or null for the first one. */
  profile: Profile | null;
  /** The member's current type decides the type-specific sections. */
  userTypeCode: string;
  submitLabel: string;
  onSaved?: (response: ProfileResponse) => void;
};

function FormCard({ title, children }: PropsWithChildren<{ title: string }>) {
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");
  return (
    <View style={styles.section}>
      <ThemedText type="label" tone="muted" style={styles.sectionTitle}>{title.toUpperCase()}</ThemedText>
      <View style={[styles.card, Shadow.card, { backgroundColor: surface, borderColor: border }]}>{children}</View>
    </View>
  );
}

// Guide 04: one form for onboarding and later editing. Saves the complete record.
export function ProfileForm({ profile, userTypeCode, submitLabel, onSaved }: ProfileFormProps) {
  const user = useAuthStore((state) => state.user);
  const canEdit = canEditOwnProfile(user);
  const isTradeperson = userTypeCode === TRADEPERSON;
  const isGovernment = userTypeCode === PUBLIC_GOVERNMENT_SECTOR;
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");

  const regions = useReferenceChoices("regions");
  const occupations = useReferenceChoices("occupations");
  const invalidateChoices = useInvalidateReferenceChoices();
  const { refetch } = useMyProfile();
  const save = useSaveMyProfile();

  const { control, handleSubmit, setError, watch, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: yupResolver(profileSchema(userTypeCode)),
    defaultValues: profileFormValues(profile),
  });
  const samePostal = watch("isPostalSameAsAddress");

  // Retired saved codes stay visible while unchanged; they can't be chosen anew.
  const regionOptions = referenceOptions(regions.data, [profile?.regionCode ?? "", profile?.isPostalSameAsAddress ? "" : profile?.postalRegionCode ?? ""]);
  const occupationOptions = referenceOptions(occupations.data, profile?.occupations.map((item) => item.occupationCode));

  const onSubmit = (values: ProfileFormValues) => {
    if (save.isPending) return;
    save.mutate(toSaveProfileRequest(values, userTypeCode), {
      onSuccess: (response) => onSaved?.(response),
      onError: (error) => {
        const info = toAppError(error);
        // The save may have landed; reload before another attempt.
        if (info.kind === "timeout") refetch();
        if (info.status === 400) invalidateChoices();
        const { fieldErrors } = mapApiValidation(error, PROFILE_FIELDS);
        PROFILE_FIELDS.forEach((field) => {
          if (fieldErrors[field]) setError(field, { message: fieldErrors[field] });
        });
      },
    });
  };

  const text = (name: Exclude<keyof ProfileFormValues, "isPostalSameAsAddress" | "occupations">, label: string, extra: Partial<React.ComponentProps<typeof FormInput>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <FormInput label={label} value={value} onChangeText={onChange} onBlur={onBlur} editable={canEdit} error={errors[name]?.message} {...extra} />
      )}
    />
  );

  const region = (name: "regionCode" | "postalRegionCode", label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <SelectInput label={label} placeholder="Choose a state or territory" value={value} onChange={onChange} options={regionOptions}
          loading={regions.isLoading} disabled={!canEdit} error={errors[name]?.message} />
      )}
    />
  );

  const occupationError = errors.occupations?.message ?? errors.occupations?.root?.message;

  return (
    <>
      {!canEdit ? <Notice message="You can view your profile, but you don't have permission to change it." style={styles.notice} /> : null}

      <FormCard title="Your details">
        {text("firstName", "First name", { autoComplete: "given-name", textContentType: "givenName" })}
        {text("lastName", "Last name", { autoComplete: "family-name", textContentType: "familyName" })}
        {text("mobilePhone", "Mobile phone", { keyboardType: "phone-pad", autoComplete: "tel", textContentType: "telephoneNumber" })}
        {text("landlinePhone", "Landline (optional)", { keyboardType: "phone-pad" })}
      </FormCard>

      <FormCard title="Address">
        {text("streetAddress", "Street address", { autoComplete: "street-address" })}
        {text("suburb", "Suburb")}
        {region("regionCode", "State or territory")}
        {text("postalCode", "Postcode", { keyboardType: "number-pad", autoComplete: "postal-code" })}
        <Controller
          control={control}
          name="isPostalSameAsAddress"
          render={({ field: { onChange, value } }) => (
            <View style={styles.switchRow}>
              <ThemedText style={styles.switchLabel}>Postal address is the same</ThemedText>
              <Switch value={value} onValueChange={onChange} disabled={!canEdit} trackColor={{ true: tint, false: border }}
                accessibilityLabel="Postal address is the same as the street address" />
            </View>
          )}
        />
      </FormCard>

      {samePostal ? null : (
        <FormCard title="Postal address">
          {text("postalAddress", "Postal address")}
          {text("postalSuburb", "Postal suburb")}
          {region("postalRegionCode", "Postal state or territory")}
          {text("postalPostalCode", "Postal postcode", { keyboardType: "number-pad" })}
        </FormCard>
      )}

      <FormCard title="Business contact">
        {text("contactEmail", "Contact email (optional)", {
          keyboardType: "email-address", autoCapitalize: "none",
          helperText: "Shown as your business contact. It doesn't change your sign-in email.",
        })}
        {text("website", "Website (optional)", { keyboardType: "url", autoCapitalize: "none", placeholder: "https://" })}
      </FormCard>

      {isGovernment ? (
        <FormCard title="Government sector">
          {text("governmentSectorName", "Sector name")}
        </FormCard>
      ) : null}

      {isTradeperson ? (
        <Controller
          control={control}
          name="occupations"
          render={({ field: { onChange, value } }) => (
            <FormCard title="Occupations and licences">
              {canEdit ? (
                <SelectMultiInput
                  label="Occupations"
                  placeholder="Choose your occupations"
                  values={value.map((item) => item.occupationCode)}
                  // Keep licence text for occupations that stay selected.
                  onChange={(codes) => onChange(codes.map((occupationCode) => ({
                    occupationCode,
                    licence: value.find((item) => item.occupationCode === occupationCode)?.licence ?? "",
                  })))}
                  options={occupationOptions}
                  loading={occupations.isLoading}
                  error={occupationError}
                />
              ) : null}
              {value.map((item, index) => (
                <FormInput
                  key={item.occupationCode}
                  label={`${referenceLabel(occupations.data, item.occupationCode)} licence`}
                  value={item.licence}
                  editable={canEdit}
                  onChangeText={(licence) => onChange(value.map((entry, i) => (i === index ? { ...entry, licence } : entry)))}
                  error={errors.occupations?.[index]?.licence?.message}
                />
              ))}
              {value.length ? (
                <ThemedText type="footnote" tone="muted">Licence details are recorded as entered.</ThemedText>
              ) : null}
            </FormCard>
          )}
        />
      ) : null}

      {canEdit ? (
        <PrimaryButton
          title={save.isPending ? "Saving..." : submitLabel}
          onPress={handleSubmit(onSubmit)}
          disabled={save.isPending}
          loading={save.isPending}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.xl },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  card: { padding: Spacing.lg, paddingBottom: Spacing.xs, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  switchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.lg },
  switchLabel: { flex: 1 },
});
