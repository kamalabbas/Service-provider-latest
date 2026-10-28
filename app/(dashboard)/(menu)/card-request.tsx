import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useCardRequest, useCardRequestActions } from "@/hooks/useCardRequests";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { CardDeliveryAddress, CardRequest } from "@/interfaces/cardRequest.interface";
import { mapApiValidation } from "@/services/apiError";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { CARD_REQUEST_STATUS_LABELS, DELIVERY_FIELDS, cardRequestActions, deliveryAddressSchema, deliveryAddressValues } from "@/utility/cardRequestRules";
import { referenceLabel, referenceOptions } from "@/utility/referenceOptions";
import { yupResolver } from "@hookform/resolvers/yup";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";

const STATUS_NOTES: Partial<Record<CardRequest["status"], string>> = {
  pending: "An administrator will review this request. You can change the delivery address or cancel until then.",
  accepted: "Approved. Approval doesn't mean a card has been made or sent; issuing the card is a separate step. The address is now locked.",
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

      <ListSection title="Card for">
        <ListRow icon={request.subjectType === "employee" ? "people-outline" : "person-outline"} title={request.subjectName}
          subtitle={request.subjectType === "employee" ? "Employee" : "You"} />
        {request.membershipId ? <ListRow icon="ribbon-outline" title="Membership ID" subtitle={request.membershipId} /> : null}
        {request.employeeOccupationName ? <ListRow icon="construct-outline" title="Occupation" subtitle={request.employeeOccupationName} /> : null}
        {request.replacementReason ? <ListRow icon="refresh-outline" title="Replacement" subtitle={`Reason: ${request.replacementReason}`} /> : null}
      </ListSection>

      {editing ? (
        <AddressForm
          request={request}
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
        message="It stays in your history. You can submit a new request later if you're eligible."
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

type AddressFormProps = {
  request: CardRequest;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (address: CardDeliveryAddress, setFieldError: (field: keyof CardDeliveryAddress, message: string) => void) => void;
};

/** All four fields are required; the saved address is a snapshot on this request only. */
function AddressForm({ request, isSaving, onCancel, onSave }: AddressFormProps) {
  const regions = useReferenceChoices("regions");
  const { control, handleSubmit, setError, formState: { errors } } = useForm<CardDeliveryAddress>({
    resolver: yupResolver(deliveryAddressSchema),
    defaultValues: deliveryAddressValues(request.deliveryAddress),
  });
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
      {text("streetAddress", "Street address")}
      {text("suburb", "Suburb")}
      <Controller
        control={control}
        name="regionCode"
        render={({ field: { onChange, value } }) => (
          <SelectInput label="State or territory" value={value} onChange={onChange}
            options={referenceOptions(regions.data, request.deliveryAddress?.regionCode)} loading={regions.isLoading} error={errors.regionCode?.message} />
        )}
      />
      {text("postalCode", "Postcode", { keyboardType: "number-pad" })}
      <View style={styles.actions}>
        <PrimaryButton title={isSaving ? "Saving..." : "Save address"}
          onPress={handleSubmit((values) => onSave(values, (field, message) => setError(field, { message })))} loading={isSaving} disabled={isSaving} />
        <PrimaryButton title="Discard changes" variant="ghost" onPress={onCancel} disabled={isSaving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.xl },
  form: { marginBottom: Spacing.xl },
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
});
