import { DeliveryAddressForm } from "@/components/card/DeliveryAddressForm";
import { SelectInput } from "@/components/form/SelectInput";
import { ConsentCheck } from "@/components/payments/ConsentCheck";
import { PaymentStatusPanel } from "@/components/payments/PaymentStatusPanel";
import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Radius, Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useCardAllowances, useMyCardRequests } from "@/hooks/useCardRequests";
import { useCard } from "@/hooks/useCards";
import { useMyEmployees } from "@/hooks/useEmployees";
import { usePaymentFlow } from "@/hooks/usePayments";
import { useMyProfile } from "@/hooks/useProfile";
import { useThemeColor } from "@/hooks/useThemeColor";
import { CardDeliveryAddress, CardReplacementReason } from "@/interfaces/cardRequest.interface";
import { mapApiValidation } from "@/services/apiError";
import { startCardCheckout } from "@/services/cardRequestService";
import { canViewEmployees } from "@/utility/access";
import { REPLACEMENT_EFFECTS, REPLACEMENT_LABELS } from "@/utility/cardRules";
import { DELIVERY_FIELDS, canRequestEmployeeCard, canRequestPersonalCard, hasOpenCardRequest, profileDeliveryAddress } from "@/utility/cardRequestRules";
import { employeeName } from "@/utility/employeeForm";
import { formatMinor } from "@/utility/paymentRules";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

type Params = { kind?: string; employeeId?: string; cardId?: string; reason?: string };

const positive = (value?: string) => (Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null);
const REASONS: readonly CardReplacementReason[] = ["expired", "damaged", "lost"];

// Guide 22: one funded flow for personal, employee and replacement cards. A free card credit is
// used first; otherwise the fee is paid on Stripe's page. The request appears only once the
// server confirms payment (or the credit).
export default function NewCardRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const previousCardId = positive(params.cardId);
  const reason = REASONS.includes(params.reason as CardReplacementReason) ? (params.reason as CardReplacementReason) : null;
  const { user, member, userTypeCode } = useBusinessAccess();
  const profile = useMyProfile();
  const business = useMyBusiness();
  const allowances = useCardAllowances();
  const previous = useCard(previousCardId);
  const isEmployee = params.kind === "employee" || previous.data?.subjectType === "employee";
  const employees = useMyEmployees({}, 100);
  const requests = useMyCardRequests(isEmployee ? { subjectType: "employee" } : { subjectType: "personal" });
  const [employeeId, setEmployeeId] = useState(params.employeeId ?? "");
  const [consent, setConsent] = useState(false);
  const muted = useThemeColor({}, "muted");

  const flow = usePaymentFlow({ kind: "card-request", label: "Membership card" });

  const loading = member.isLoading || profile.isLoading || allowances.isLoading || (previousCardId !== null && previous.isLoading) ||
    (isEmployee && (business.isLoading || employees.isLoading));
  if (loading) return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;

  const allowance = allowances.data;
  const replacing = previousCardId !== null && reason !== null && !!previous.data;
  const allowed = isEmployee ? canRequestEmployeeCard(user, userTypeCode) && canViewEmployees(user, userTypeCode) : canRequestPersonalCard(user);
  if (!allowed) return <Screen hasHeader><Notice tone="warning" message="You don't have permission to request this card." /></Screen>;
  if (!allowance?.cardRequestsEnabled) {
    return <Screen hasHeader><Notice tone="warning" message="Card requests are paused right now. Please try again later." /></Screen>;
  }
  if (isEmployee && !business.data) {
    return <Screen hasHeader><Notice tone="warning" message="Add your business first. Employee cards are for your active business's employees." /></Screen>;
  }

  const activeEmployees = (employees.data ?? []).filter((employee) => !employee.archivedAtUtc);
  const subjectEmployeeId = replacing ? previous.data!.employeeId ?? null : isEmployee ? positive(employeeId) : null;
  const selected = activeEmployees.find((employee) => employee.id === subjectEmployeeId) ?? null;
  // A replacement supersedes the open card, so only new cards check for an open request.
  const blocked = !replacing && hasOpenCardRequest(requests.data ?? [], { employeeId: isEmployee ? subjectEmployeeId : null });
  const free = allowance.available > 0;
  const fee = allowance.cardFeeMinor;
  const needsConsent = !free;
  const ready = (!isEmployee || subjectEmployeeId !== null) && !blocked && (free || fee != null) && (!needsConsent || consent);

  // Personal cards default to the profile's postal address; employee cards to the business address.
  const initialAddress: CardDeliveryAddress | null = isEmployee && business.data
    ? { streetAddress: business.data.streetAddress, suburb: business.data.suburb, regionCode: business.data.regionCode, postalCode: business.data.postalCode }
    : profileDeliveryAddress(profile.data);

  const submit = (address: CardDeliveryAddress, setFieldError: (field: keyof CardDeliveryAddress, message: string) => void) => {
    const input = {
      ...address,
      employeeId: isEmployee ? subjectEmployeeId : null,
      previousCardId: replacing ? previousCardId : null,
      replacementReason: replacing ? reason : null,
      consentAccepted: needsConsent ? consent : false,
    };
    void flow.start(JSON.stringify(input), async (requestId) => {
      try {
        return await startCardCheckout({ ...input, requestId });
      } catch (error) {
        const { fieldErrors } = mapApiValidation(error, DELIVERY_FIELDS);
        DELIVERY_FIELDS.forEach((field) => { if (fieldErrors[field]) setFieldError(field, fieldErrors[field]!); });
        throw error;
      }
    });
  };

  const operation = flow.operation;
  const title = replacing ? "Replacement card" : isEmployee ? "Employee card" : "My membership card";

  return (
    <Screen hasHeader title={title} subtitle="An administrator reviews each request before the card is made and sent.">
      {flow.operationId || flow.submitting ? (
        <PaymentStatusPanel
          operation={operation}
          loading={flow.submitting}
          onReopen={flow.reopen}
          onRefresh={() => allowances.refetch()}
          onDone={() => (operation?.cardRequestId
            ? router.replace({ pathname: "/(dashboard)/(menu)/card-request", params: { id: String(operation.cardRequestId) } })
            : router.back())}
          successAction={operation?.cardRequestId ? {
            title: "View your request",
            onPress: () => router.replace({ pathname: "/(dashboard)/(menu)/card-request", params: { id: String(operation.cardRequestId) } }),
          } : undefined}
        />
      ) : null}
      {flow.error ? <Notice tone="warning" message={flow.error} style={styles.spaced} /> : null}

      {operation?.status === "succeeded" ? null : (
        <>
          <ListSection title="Card for">
            {replacing ? (
              <>
                <ListRow icon="card-outline" title={previous.data!.subjectName} subtitle={`Replacing card ${previous.data!.cardNumber}`} />
                <ListRow icon="refresh-outline" title={REPLACEMENT_LABELS[reason!]} subtitle={REPLACEMENT_EFFECTS[reason!]} />
              </>
            ) : isEmployee ? (
              <View style={styles.inside}>
                {activeEmployees.length === 0 ? (
                  <>
                    <Notice message="You have no active employees yet. Add one first." />
                    <PrimaryButton title="Add an employee" leftIcon="person-add-outline" onPress={() => router.push("/(dashboard)/(menu)/employee-edit")} />
                  </>
                ) : (
                  <SelectInput
                    label="Employee"
                    placeholder="Choose an employee"
                    pickerLabel="Choose an employee"
                    value={employeeId}
                    onChange={setEmployeeId}
                    options={activeEmployees.map((employee) => {
                      const open = hasOpenCardRequest(requests.data ?? [], { employeeId: employee.id });
                      return { label: open ? `${employeeName(employee)} (request already open)` : employeeName(employee), value: String(employee.id), disabled: open };
                    })}
                  />
                )}
                {selected ? <ThemedText type="caption" tone="muted">{[selected.occupationName, selected.positionName].filter(Boolean).join(", ")}</ThemedText> : null}
              </View>
            ) : (
              <ListRow icon="person-outline" title="You" subtitle={member.data?.membershipId ? `Membership ID ${member.data.membershipId}` : undefined} />
            )}
          </ListSection>
          {blocked ? <Notice tone="warning" message="A request for this card is already open. You can follow it under Membership cards." style={styles.spaced} /> : null}

          <View style={[styles.cost, { backgroundColor: muted }]}>
            <ThemedText type="label" tone="muted">COST</ThemedText>
            {free ? (
              <>
                <ThemedText type="title">Free</ThemedText>
                <ThemedText type="callout" tone="muted">{`Uses 1 of your ${allowance.available} free card credit${allowance.available === 1 ? "" : "s"}. No card needed.`}</ThemedText>
              </>
            ) : fee != null ? (
              <>
                <ThemedText type="title">{formatMinor(fee)}</ThemedText>
                <ThemedText type="callout" tone="muted">One-off, delivery included. Fully refunded automatically if the request is rejected or cancelled before the card is sent.</ThemedText>
              </>
            ) : (
              <ThemedText type="callout" tone="muted">{"The card fee isn't set yet, so requests can't be made right now."}</ThemedText>
            )}
          </View>

          <ThemedText type="label" tone="muted" style={styles.label}>DELIVERY ADDRESS</ThemedText>
          <DeliveryAddressForm
            initial={initialAddress}
            submitLabel={free ? "Request card" : "Continue to payment"}
            submitIcon={free ? "card-outline" : "lock-closed-outline"}
            isSaving={flow.submitting || flow.polling}
            disabled={!ready}
            footer={needsConsent && fee != null ? (
              <ConsentCheck checked={consent} onChange={setConsent}
                label={`I agree to pay ${formatMinor(fee)} for this card. I'll enter my card details on Stripe's secure page.`} />
            ) : null}
            onSave={submit}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  spaced: { marginBottom: Spacing.lg },
  inside: { padding: Spacing.lg, gap: Spacing.sm },
  cost: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.xs, marginBottom: Spacing.xl },
  label: { marginBottom: Spacing.sm, marginLeft: Spacing.xs, letterSpacing: 0.6 },
});
