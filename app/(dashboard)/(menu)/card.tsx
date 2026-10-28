import { CardFace } from "@/components/card/CardFace";
import { SelectInput } from "@/components/form/SelectInput";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess } from "@/hooks/useBusiness";
import { useCard, useCardActions } from "@/hooks/useCards";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { CardReplacementReason } from "@/interfaces/cardRequest.interface";
import { useToastStore } from "@/stores/toastStore";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { CARD_STATUS_LABELS, REPLACEMENT_EFFECTS, REPLACEMENT_LABELS, cardActions } from "@/utility/cardRules";
import { referenceLabel } from "@/utility/referenceOptions";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

const FULFILMENT_NOTES: Partial<Record<string, string>> = {
  issued: "Your card has been made. You'll see when it's sent.",
  dispatched: "Your card is on its way. Confirm only once it has actually arrived.",
  delivery_failed: "Delivery failed. An administrator will resend or reissue it; you can't request a replacement yet.",
};

// Guide 11-b: one card with fulfilment, receipt and replacement.
export default function CardScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const showToast = useToastStore((state) => state.showToast);
  const { user, userTypeCode } = useBusinessAccess();
  const { data: card, isLoading, refetch } = useCard(cardId);
  const regions = useReferenceChoices("regions");
  const actions = useCardActions(cardId ?? 0);
  const [confirmReceive, setConfirmReceive] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [reason, setReason] = useState<CardReplacementReason | "">("");

  useFocusEffect(useCallback(() => {
    if (cardId) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]));

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the card…" /></Screen>;
  if (!card) return <Screen hasHeader><Notice tone="warning" message="This card is unavailable." /></Screen>;

  const allowed = cardActions(card, user, userTypeCode);
  const address = card.deliveryAddress;
  const reasonOptions = allowed.replacementReasons.map((value) => ({ label: REPLACEMENT_LABELS[value], value }));

  const replace = () =>
    reason && actions.replace.mutate({ card, reason }, {
      onSuccess: (response) => {
        setReplacing(false);
        showToast("Replacement requested. An administrator will review it.", "success");
        if (response.data) router.push({ pathname: "/(dashboard)/(menu)/card-request", params: { id: String(response.data.id) } });
      },
    });

  return (
    <Screen hasHeader>
      <CardFace card={card} />

      {FULFILMENT_NOTES[card.status] ? <Notice message={FULFILMENT_NOTES[card.status]!} style={styles.notice} /> : null}
      {card.invalidationReason ? <Notice tone="warning" message={`No longer valid: ${card.invalidationReason}`} style={styles.notice} /> : null}

      <ListSection title="Delivery">
        <ListRow icon="cube-outline" title="Status" subtitle={CARD_STATUS_LABELS[card.status] ?? card.status} />
        <ListRow icon="mail-outline" title={address.streetAddress} subtitle={`${address.suburb} ${referenceLabel(regions.data, address.regionCode)} ${address.postalCode}`} />
        {card.dispatchedAtUtc ? <ListRow icon="send-outline" title="Sent" subtitle={formatLocalTimestamp(card.dispatchedAtUtc)} /> : null}
        {card.carrier || card.trackingReference ? (
          <ListRow icon="navigate-outline" title={card.carrier ?? "Tracking"} subtitle={card.trackingReference ?? undefined} />
        ) : null}
        {card.receivedAtUtc ? <ListRow icon="checkmark-done-outline" title="Received" subtitle={formatLocalTimestamp(card.receivedAtUtc)} /> : null}
      </ListSection>

      <ListSection title="Validity" footer={`Cards are valid for ${card.validityYears} year${card.validityYears === 1 ? "" : "s"} from issue.`}>
        <ListRow icon="calendar-outline" title="Issued" subtitle={formatLocalTimestamp(card.issuedAtUtc)} />
        <ListRow icon="hourglass-outline" title="Expires" subtitle={formatLocalTimestamp(card.expiresAtUtc)} />
      </ListSection>

      {card.history.length ? (
        <ListSection title="History">
          {card.history.map((event, index) => (
            <ListRow
              key={`${event.createdAtUtc}-${index}`}
              icon="time-outline"
              title={CARD_STATUS_LABELS[event.status as keyof typeof CARD_STATUS_LABELS] ?? event.action}
              subtitle={[formatLocalTimestamp(event.createdAtUtc), event.note].filter(Boolean).join(" · ")}
            />
          ))}
        </ListSection>
      ) : null}

      <View style={styles.actions}>
        {allowed.receive ? <PrimaryButton title="I've received this card" leftIcon="checkmark-circle-outline" onPress={() => setConfirmReceive(true)} /> : null}
        {reasonOptions.length ? (
          <PrimaryButton title="Request a replacement" variant="secondary" leftIcon="refresh-outline" onPress={() => { setReason(""); setReplacing(true); }} />
        ) : null}
      </View>

      <ConfirmModal
        visible={confirmReceive}
        icon="checkmark-circle-outline"
        title="Has the card arrived?"
        message="Confirm only once you have the physical card. This is recorded as proof of receipt."
        confirmLabel="Yes, it arrived"
        isLoading={actions.receive.isPending}
        onCancel={() => setConfirmReceive(false)}
        onConfirm={() => actions.receive.mutate(undefined, {
          onSuccess: () => showToast("Receipt confirmed.", "success"),
          onSettled: () => setConfirmReceive(false),
        })}
      />

      <ConfirmModal
        visible={replacing}
        icon="refresh-outline"
        tone={reason === "lost" ? "danger" : "default"}
        title="Request a replacement"
        message={reason ? REPLACEMENT_EFFECTS[reason] : "Why do you need a new card?"}
        confirmLabel="Request replacement"
        isLoading={actions.replace.isPending}
        onCancel={() => setReplacing(false)}
        onConfirm={replace}
        customContent={<SelectInput label="Reason" placeholder="Choose a reason" value={reason} onChange={(value) => setReason(value as CardReplacementReason)} options={reasonOptions} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.lg },
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
});
