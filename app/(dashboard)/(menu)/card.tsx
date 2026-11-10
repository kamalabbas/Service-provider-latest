import { CardFace } from "@/components/card/CardFace";
import { CardProgress } from "@/components/card/CardProgress";
import { SelectInput } from "@/components/form/SelectInput";
import { ThemedText } from "@/components/ThemedText";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Radius, Spacing } from "@/constants/Theme";
import { useBusinessAccess } from "@/hooks/useBusiness";
import { useCard, useCardActions } from "@/hooks/useCards";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useThemeColor } from "@/hooks/useThemeColor";
import { CardReplacementReason } from "@/interfaces/cardRequest.interface";
import { useToastStore } from "@/stores/toastStore";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { CARD_STATUS_LABELS, REPLACEMENT_EFFECTS, REPLACEMENT_LABELS, cardActions, cardSteps, cardSummary, receiveBlockedReason } from "@/utility/cardRules";
import { referenceLabel } from "@/utility/referenceOptions";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

const HISTORY_PREVIEW = 3;

// Guide 11-b: one card. Reads top to bottom: the card, where it is now, what to do next,
// then delivery details, replacement and history.
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
  const [showAllHistory, setShowAllHistory] = useState(false);
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");

  useFocusEffect(useCallback(() => {
    if (cardId) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]));

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the card…" /></Screen>;
  if (!card) return <Screen hasHeader><Notice tone="warning" message="This card is unavailable." /></Screen>;

  const allowed = cardActions(card, user, userTypeCode);
  const blocked = receiveBlockedReason(card, user);
  const summary = cardSummary(card);
  const address = card.deliveryAddress;
  const reasonOptions = allowed.replacementReasons.map((value) => ({ label: REPLACEMENT_LABELS[value], value }));
  const history = showAllHistory ? card.history : card.history.slice(-HISTORY_PREVIEW);

  // Guide 22: replacements are funded like new cards. A lost card is reported first, which
  // cancels it immediately, even if the replacement payment is then abandoned.
  const goToReplacement = () => {
    setReplacing(false);
    router.push({ pathname: "/(dashboard)/(menu)/card-request-new", params: { cardId: String(card.id), reason } });
  };
  const replace = () => {
    if (!reason) return;
    if (reason !== "lost") return goToReplacement();
    actions.reportLost.mutate(undefined, {
      onSuccess: () => { showToast("Card reported lost and cancelled.", "success"); goToReplacement(); },
      onError: () => setReplacing(false),
    });
  };

  return (
    <Screen hasHeader>
      <CardFace card={card} />

      {/* Where the card is now, and the one thing to do next. */}
      <View style={[styles.summary, { backgroundColor: surface, borderColor: border }]}>
        <StatusBadge label={CARD_STATUS_LABELS[card.status] ?? card.status} tone={summary.tone} />
        <ThemedText type="title">{summary.title}</ThemedText>
        {summary.text ? <ThemedText type="callout" tone="muted">{summary.text}</ThemedText> : null}
        {allowed.receive ? (
          <PrimaryButton title="I've received my card" leftIcon="checkmark-circle-outline" onPress={() => setConfirmReceive(true)} />
        ) : null}
        {blocked ? <Notice tone="warning" message={blocked} /> : null}
      </View>

      <ThemedText type="label" tone="muted" style={styles.sectionLabel}>PROGRESS</ThemedText>
      <CardProgress steps={cardSteps(card)} />

      <ListSection title="Delivery">
        <ListRow icon="home-outline" title={address.streetAddress} subtitle={`${address.suburb} ${referenceLabel(regions.data, address.regionCode)} ${address.postalCode}`} />
        {card.carrier || card.trackingReference ? (
          <ListRow icon="navigate-outline" title={card.carrier ?? "Tracking number"} subtitle={card.trackingReference ?? undefined} />
        ) : null}
      </ListSection>

      <ListSection title="Validity" footer={`Cards are valid for ${card.validityYears} year${card.validityYears === 1 ? "" : "s"} from the day they're made.`}>
        <ListRow icon="calendar-outline" title="Issued" subtitle={formatLocalTimestamp(card.issuedAtUtc)} />
        <ListRow icon="hourglass-outline" title="Expires" subtitle={formatLocalTimestamp(card.expiresAtUtc)} />
      </ListSection>

      {reasonOptions.length ? (
        <ListSection title="Need a new card?">
          <View style={styles.replace}>
            <ThemedText type="callout" tone="muted">If your card is expiring, damaged, lost or stolen, request a replacement. An administrator reviews it.</ThemedText>
            <PrimaryButton title="Request a replacement" variant="secondary" leftIcon="refresh-outline" onPress={() => { setReason(""); setReplacing(true); }} />
          </View>
        </ListSection>
      ) : null}

      {card.history.length ? (
        <ListSection title="History">
          {history.map((event, index) => (
            <ListRow
              key={`${event.createdAtUtc}-${index}`}
              icon="time-outline"
              title={CARD_STATUS_LABELS[event.status as keyof typeof CARD_STATUS_LABELS] ?? event.action}
              subtitle={[formatLocalTimestamp(event.createdAtUtc), event.note].filter(Boolean).join(" · ")}
            />
          ))}
        </ListSection>
      ) : null}
      {card.history.length > HISTORY_PREVIEW ? (
        <PrimaryButton
          title={showAllHistory ? "Show less" : `Show all history (${card.history.length})`}
          variant="ghost"
          size="md"
          onPress={() => setShowAllHistory((value) => !value)}
        />
      ) : null}

      <ConfirmModal
        visible={confirmReceive}
        icon="checkmark-circle-outline"
        title="Has the card arrived?"
        message="Confirm only once you have the physical card in your hands. This is recorded as proof of receipt and activates the card."
        confirmLabel="Yes, it arrived"
        isLoading={actions.receive.isPending}
        onCancel={() => setConfirmReceive(false)}
        onConfirm={() => actions.receive.mutate(undefined, {
          onSuccess: () => showToast("Receipt confirmed. Your card is active.", "success"),
          onSettled: () => setConfirmReceive(false),
        })}
      />

      <ConfirmModal
        visible={replacing}
        icon="refresh-outline"
        tone={reason === "lost" ? "danger" : "default"}
        title="Request a replacement"
        message={reason ? REPLACEMENT_EFFECTS[reason] : "Why do you need a new card?"}
        confirmLabel={reason === "lost" ? "Report lost and continue" : "Continue"}
        confirmDisabled={!reason}
        isLoading={actions.reportLost.isPending}
        onCancel={() => setReplacing(false)}
        onConfirm={replace}
        customContent={<SelectInput label="Reason" placeholder="Choose a reason" value={reason} onChange={(value) => setReason(value as CardReplacementReason)} options={reasonOptions} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.xl },
  sectionLabel: { marginBottom: Spacing.sm, marginLeft: Spacing.xs, letterSpacing: 0.6 },
  replace: { padding: Spacing.lg, gap: Spacing.md },
});
