import { DeliveryAddressForm } from "@/components/card/DeliveryAddressForm";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useCardRequest, useCardRequestActions } from "@/hooks/useCardRequests";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { CardRequest } from "@/interfaces/cardRequest.interface";
import { mapApiValidation } from "@/services/apiError";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { FUNDING_LABELS, REFUND_STATUS_LABELS, formatMinor } from "@/utility/paymentRules";
import { CARD_REQUEST_STATUS_LABELS, DELIVERY_FIELDS, cardRequestActions } from "@/utility/cardRequestRules";
import { referenceLabel } from "@/utility/referenceOptions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

const STATUS_NOTES: Partial<Record<CardRequest["status"], string>> = {
  pending: "An administrator will review this request. You can change the delivery address or cancel (with a full refund) until then.",
  accepted: "Approved. Next, an administrator makes and sends your card; it then appears under My cards, where you confirm when it arrives. The address is now locked.",
  rejected: "Rejected. You can submit a new request if you're still eligible.",
  cancelled: "Cancelled. You can submit a new request if you're still eligible.",
};

// Guide 11: one card request with its delivery address, decision and audit history.
export default function CardRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const requestId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const { data: request, isLoading } = useCardRequest(requestId);
  const regions = useReferenceChoices("regions");
  const actions = useCardRequestActions();
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the request…" /></Screen>;
  if (!request) return <Screen hasHeader><Notice tone="warning" message="This card request is unavailable." /></Screen>;

  const allowed = cardRequestActions(request, user);
  const address = request.deliveryAddress;

  return (
    <Screen hasHeader title={request.subjectName} subtitle={CARD_REQUEST_STATUS_LABELS[request.status] ?? request.status}>
      {STATUS_NOTES[request.status] ? (
        <Notice tone={request.status === "rejected" ? "warning" : "info"} message={STATUS_NOTES[request.status]!} style={styles.notice} />
      ) : null}
      {request.status === "accepted" ? (
        <PrimaryButton title="Go to My cards" variant="secondary" leftIcon="wallet-outline" onPress={() => router.push("/(dashboard)/(menu)/cards")} style={styles.notice} />
      ) : null}

      <ListSection title="Card for">
        <ListRow icon={request.subjectType === "employee" ? "people-outline" : "person-outline"} title={request.subjectName}
          subtitle={request.subjectType === "employee" ? "Employee" : "You"} />
        {request.membershipId ? <ListRow icon="ribbon-outline" title="Membership ID" subtitle={request.membershipId} /> : null}
        {request.employeeOccupationName ? <ListRow icon="construct-outline" title="Occupation" subtitle={request.employeeOccupationName} /> : null}
        {request.replacementReason ? <ListRow icon="refresh-outline" title="Replacement" subtitle={`Reason: ${request.replacementReason}`} /> : null}
      </ListSection>

      {editing ? (
        <DeliveryAddressForm
          initial={request.deliveryAddress}
          submitLabel="Save address"
          isSaving={actions.updateAddress.isPending}
          onCancel={() => setEditing(false)}
          onSave={(next, setFieldError) => actions.updateAddress.mutate({ requestId: request.id, address: next }, {
            onSuccess: () => { setEditing(false); showToast("Delivery address updated.", "success"); },
            onError: (error) => {
              const { fieldErrors } = mapApiValidation(error, DELIVERY_FIELDS);
              DELIVERY_FIELDS.forEach((field) => { if (fieldErrors[field]) setFieldError(field, fieldErrors[field]!); });
            },
          })}
        />
      ) : (
        <ListSection title="Delivery address">
          <ListRow
            icon="mail-outline"
            title={address ? address.streetAddress : "No address"}
            subtitle={address ? `${address.suburb} ${referenceLabel(regions.data, address.regionCode)} ${address.postalCode}` : undefined}
            onPress={allowed.editAddress ? () => setEditing(true) : undefined}
          />
        </ListSection>
      )}

      {request.fundingSource ? (
        <ListSection title="Payment">
          <ListRow icon="cash-outline" title={FUNDING_LABELS[request.fundingSource] ?? request.fundingSource}
            subtitle={request.paidAmountMinor != null ? formatMinor(request.paidAmountMinor) : undefined} />
          {request.refundStatus ? <ListRow icon="return-down-back-outline" title={REFUND_STATUS_LABELS[request.refundStatus] ?? request.refundStatus} subtitle="Automatic refund of the full amount" /> : null}
        </ListSection>
      ) : null}

      {request.cardId ? (
        <ListSection title="Card">
          <ListRow icon="wallet-outline" title="View the issued card"
            onPress={() => router.push({ pathname: "/(dashboard)/(menu)/card", params: { id: String(request.cardId) } })} />
        </ListSection>
      ) : null}

      {request.decisionReason ? (
        <ListSection title="Decision">
          <ListRow icon="chatbox-outline" title={CARD_REQUEST_STATUS_LABELS[request.status]} subtitle={request.decisionReason} />
        </ListSection>
      ) : null}

      {request.history.length ? (
        <ListSection title="History">
          {request.history.map((event, index) => (
            <ListRow
              key={`${event.createdAtUtc}-${index}`}
              icon="time-outline"
              title={CARD_REQUEST_STATUS_LABELS[event.status as keyof typeof CARD_REQUEST_STATUS_LABELS] ?? event.action}
              subtitle={[formatLocalTimestamp(event.createdAtUtc), event.note].filter(Boolean).join(" · ")}
            />
          ))}
        </ListSection>
      ) : null}

      {!editing ? (
        <View style={styles.actions}>
          {allowed.editAddress ? <PrimaryButton title="Change delivery address" variant="secondary" leftIcon="create-outline" onPress={() => setEditing(true)} /> : null}
          {allowed.cancel ? <PrimaryButton title="Cancel request" variant="danger" leftIcon="close-outline" onPress={() => setConfirmCancel(true)} /> : null}
        </View>
      ) : null}

      <ConfirmModal
        visible={confirmCancel}
        icon="close-circle-outline"
        tone="danger"
        title="Cancel this card request?"
        message={request.fundingSource === "paid"
          ? "Your payment is refunded in full automatically. It stays in your history, and you can request again later."
          : request.fundingSource === "allowance" ? "Your free card credit is returned. It stays in your history, and you can request again later."
          : "It stays in your history. You can submit a new request later if you're eligible."}
        confirmLabel="Cancel request"
        isLoading={actions.cancel.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => actions.cancel.mutate(request.id, {
          onSuccess: () => showToast("Card request cancelled.", "success"),
          onSettled: () => setConfirmCancel(false),
        })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.xl },
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
});
