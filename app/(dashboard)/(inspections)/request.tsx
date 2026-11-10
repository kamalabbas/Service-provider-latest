import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { ConsentCheck } from "@/components/payments/ConsentCheck";
import { PaymentStatusPanel } from "@/components/payments/PaymentStatusPanel";
import { ThemedText } from "@/components/ThemedText";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Radius, Spacing } from "@/constants/Theme";
import { usePaymentAccount, usePaymentFlow } from "@/hooks/usePayments";
import { useMyProfile } from "@/hooks/useProfile";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useDiscoveredService } from "@/hooks/useServices";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { PaymentAccount } from "@/interfaces/payment.interface";
import { Profile } from "@/interfaces/profile.interface";
import { DiscoveredService } from "@/interfaces/service.interface";
import { mapApiValidation } from "@/services/apiError";
import { startInspectionCheckout } from "@/services/paymentService";
import { useAuthStore } from "@/stores/authStore";
import { canRequestInspectionFor } from "@/utility/access";
import {
  INSPECTION_REQUEST_FIELDS,
  InspectionRequestFormValues,
  inspectionRequestSchema,
  inspectionRequestValues,
  toCreateInspectionRequest,
} from "@/utility/inspectionRules";
import { formatMinor } from "@/utility/paymentRules";
import { referenceOptions } from "@/utility/referenceOptions";
import { yupResolver } from "@hookform/resolvers/yup";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";

// Guide 08 + 21: request an inspection at an explicit visit address. A free inspection credit is
// used first; otherwise the platform's booking fee is paid on Stripe. The booking exists only
// once the server returns it.
export default function RequestInspectionScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const user = useAuthStore((state) => state.user);
  const service = useDiscoveredService(Number(serviceId));
  const profile = useMyProfile();
  const account = usePaymentAccount();

  if (service.isLoading || profile.isLoading || account.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;
  if (!service.data) return <Screen hasHeader><Notice tone="warning" message="This service is no longer available." /></Screen>;
  if (!canRequestInspectionFor(user, service.data)) {
    return <Screen hasHeader><Notice tone="warning" message="You can't request an inspection for this service right now, for example because you already have an open request." /></Screen>;
  }
  if (!account.data?.inspectionRequestsEnabled) {
    return <Screen hasHeader><Notice tone="warning" message="Inspection requests are paused right now. Please try again later." /></Screen>;
  }
  return <RequestForm service={service.data} profile={profile.data ?? null} account={account.data} />;
}

function RequestForm({ service, profile, account }: { service: DiscoveredService; profile: Profile | null; account: PaymentAccount }) {
  const router = useRouter();
  const regions = useReferenceChoices("regions");
  const muted = useThemeColor({}, "muted");
  const [consent, setConsent] = useState(false);
  const flow = usePaymentFlow({ kind: "inspection", label: `Inspection: ${service.title}` });
  const { control, handleSubmit, setError, formState: { errors } } = useForm<InspectionRequestFormValues>({
    resolver: yupResolver(inspectionRequestSchema),
    defaultValues: inspectionRequestValues(profile),
  });

  const credits = account.balance.availableComplimentary;
  const free = credits > 0;
  const fee = account.confirmationFeeMinor;
  const operation = flow.operation;
  const busy = flow.submitting || flow.polling;
  const canSubmit = free || (fee != null && consent);
  const openInspection = (id: number) => router.replace({ pathname: "/(dashboard)/(inspections)/[id]", params: { id: String(id) } });

  const onSubmit = (values: InspectionRequestFormValues) => {
    if (busy || !canSubmit) return;
    // A free credit needs no charging consent; a paid booking needs it explicitly.
    const input = { ...toCreateInspectionRequest(service.id, values), consentAccepted: free ? false : consent };
    void flow.start(JSON.stringify(input), async (requestId) => {
      try {
        return await startInspectionCheckout({ ...input, requestId });
      } catch (error) {
        const { fieldErrors } = mapApiValidation(error, INSPECTION_REQUEST_FIELDS);
        INSPECTION_REQUEST_FIELDS.forEach((field) => { if (fieldErrors[field]) setError(field, { message: fieldErrors[field] }); });
        throw error;
      }
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
      {flow.operationId || flow.submitting ? (
        <PaymentStatusPanel
          operation={operation}
          loading={flow.submitting}
          onReopen={flow.reopen}
          onRefresh={() => undefined}
          onDone={() => (operation?.inspectionId ? openInspection(operation.inspectionId) : router.back())}
          successAction={operation?.inspectionId ? { title: "View your inspection", onPress: () => openInspection(operation.inspectionId!) } : undefined}
        />
      ) : null}
      {flow.error ? <Notice tone="warning" message={flow.error} style={styles.notice} /> : null}

      {operation?.status === "succeeded" ? null : (
        <>
          <View style={[styles.cost, { backgroundColor: muted }]}>
            <ThemedText type="label" tone="muted">BOOKING FEE</ThemedText>
            {free ? (
              <>
                <ThemedText type="title">Free</ThemedText>
                <ThemedText type="callout" tone="muted">{`Uses 1 of your ${credits} free inspection credit${credits === 1 ? "" : "s"}.`}</ThemedText>
              </>
            ) : fee != null ? (
              <>
                <ThemedText type="title">{formatMinor(fee)}</ThemedText>
                <ThemedText type="callout" tone="muted">Paid now to confirm the booking. Refunded in full automatically if the provider declines or the booking is cancelled before the visit.</ThemedText>
              </>
            ) : (
              <ThemedText type="callout" tone="muted">The booking fee isn&apos;t set yet, so requests can&apos;t be made right now.</ThemedText>
            )}
            {account.informativeInspectionPriceMinor != null ? (
              <ThemedText type="footnote" tone="muted">
                {`Typical inspection price: ${formatMinor(account.informativeInspectionPriceMinor)}, paid to the provider directly. It isn't charged here.`}
              </ThemedText>
            ) : null}
          </View>

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

          {!free && fee != null ? (
            <ConsentCheck checked={consent} onChange={setConsent}
              label={`I agree to pay the ${formatMinor(fee)} booking fee. I'll enter my card details on Stripe's secure page.`} />
          ) : null}
          <PrimaryButton
            title={busy ? "Please wait..." : free ? "Send request" : "Continue to payment"}
            leftIcon={free ? "send-outline" : "lock-closed-outline"}
            onPress={handleSubmit(onSubmit)}
            loading={busy}
            disabled={busy || !canSubmit}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.lg },
  cost: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.xs, marginBottom: Spacing.xl },
});
