import { ConsentCheck } from "@/components/payments/ConsentCheck";
import { PaymentStatusPanel } from "@/components/payments/PaymentStatusPanel";
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
import { usePaymentAccount, usePaymentFlow, usePaymentPlans, useSavedCardActions, useSavedCards } from "@/hooks/usePayments";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { PaymentOperation, PaymentPlan, PlanCode, SavedCard } from "@/interfaces/payment.interface";
import { listPendingOperations, type PendingOperation } from "@/services/paymentFlow";
import { setupSavedCard, startSubscriptionCheckout, upgradeSubscriptionPlan } from "@/services/paymentService";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { canDeletePayments, canManagePayments, canViewPayments } from "@/utility/access";
import { formatMinor, planAction, planPrice, plansForMember, renewalReminder, SUBSCRIPTION_STATUS_LABELS, subscriptionSummary, type PlanAction } from "@/utility/paymentRules";
import { UUID_PATTERN } from "@/utility/uuid";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

const ACTION_TITLES: Record<PlanAction, string> = {
  subscribe: "Buy a year",
  renew: "Renew for another year",
  upgrade: "Upgrade",
  next_year: "Choose for next year",
  current: "Your plan",
  prepaid: "Next year paid",
  unavailable: "Not available",
};

const ACTION_NOTES: Partial<Record<PlanAction, string>> = {
  subscribe: "One payment for one year of access. It doesn't renew automatically; you can renew in the last 30 days.",
  renew: "One payment for another year. It starts when your current year ends, so you don't lose any days.",
  upgrade: "You pay only the difference for the rest of your current year; your end date stays the same. Small differences are free.",
  next_year: "One payment for next year on this plan. It starts when your current year ends; you keep your current benefits until then.",
};

const BUYABLE: readonly PlanAction[] = ["subscribe", "renew", "upgrade", "next_year"];

// Guides 21/23: annual access bought with one-off payments (no automatic renewal), saved cards,
// free credits and history. Card details are entered only on Stripe's page; the app shows the
// verified outcome from the server. Stripe's return link (/billing?operationId=…) resumes here.
export default function BillingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ operationId?: string }>();
  const user = useAuthStore((state) => state.user);
  const { userTypeCode } = useBusinessAccess();
  const showToast = useToastStore((state) => state.showToast);
  const account = usePaymentAccount();
  const plans = usePaymentPlans();
  const cards = useSavedCards();
  const cardActions = useSavedCardActions();
  const [choice, setChoice] = useState<{ plan: PaymentPlan; action: PlanAction } | null>(null);
  const [consent, setConsent] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [removing, setRemoving] = useState<SavedCard | null>(null);
  const [pending, setPending] = useState<PendingOperation[]>([]);
  const muted = useThemeColor({}, "muted");
  const tint = useThemeColor({}, "tint");

  const refresh = () => { account.refetch(); plans.refetch(); cards.refetch(); };
  const subscriptionFlow = usePaymentFlow({ kind: "subscription", label: "Annual plan", onSettled: (op) => { if (op.status === "succeeded" && !op.refundRequired) showToast("Your plan is updated.", "success"); } });
  const cardFlow = usePaymentFlow({ kind: "card-setup", label: "Add a card", onSettled: (op) => { if (op.status === "succeeded") showToast("Card saved.", "success"); } });
  // Any payment returned from Stripe (plans, bookings, cards) or resumed from the list below.
  const returnFlow = usePaymentFlow({ kind: "return", label: "Payment" });
  const flows = [subscriptionFlow, cardFlow, returnFlow];
  const activeFlow = flows.find((flow) => flow.operationId || flow.submitting) ?? null;

  // Stripe sends the customer back to https://…/billing?operationId=…; resume that operation.
  const { resume } = returnFlow;
  useEffect(() => {
    if (params.operationId && UUID_PATTERN.test(params.operationId)) resume(params.operationId);
  }, [params.operationId, resume]);

  useFocusEffect(useCallback(() => {
    refresh();
    if (user?.id) void listPendingOperations(user.id).then(setPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]));

  if (!canViewPayments(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view billing." /></Screen>;
  }
  if (account.isLoading || plans.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading billing…" /></Screen>;

  const data = account.data;
  const allPlans = plans.data ?? [];
  // $1 Price list for members, $50 Provider for tradespeople (Provider includes the guide).
  const planList = plansForMember(allPlans, userTypeCode, data?.subscription);
  const busy = flows.some((flow) => flow.submitting || flow.polling);
  const chosenPrice = choice ? planPrice(choice.plan) : null;
  const reminder = renewalReminder(data);

  const buy = () => {
    if (!choice || !chosenPrice) return;
    const planCode = choice.plan.code as PlanCode;
    void subscriptionFlow.start(`${choice.action}:${planCode}`, (requestId) => choice.action === "upgrade"
      ? upgradeSubscriptionPlan({ requestId, consentAccepted: true })
      : startSubscriptionCheckout({ requestId, consentAccepted: true, planCode }));
    setChoice(null);
  };

  const addCard = () => {
    void cardFlow.start("setup", (requestId) => setupSavedCard({ requestId, consentAccepted: true }));
    setAddingCard(false);
  };

  // A returned or resumed booking/card payment links to what it created.
  const createdLink = (operation: PaymentOperation | null) =>
    operation?.inspectionId ? { title: "View your inspection", onPress: () => router.push({ pathname: "/(dashboard)/(inspections)/[id]", params: { id: String(operation.inspectionId) } }, { withAnchor: true }) }
    : operation?.cardRequestId ? { title: "View your card request", onPress: () => router.push({ pathname: "/(dashboard)/(menu)/card-request", params: { id: String(operation.cardRequestId) } }) }
    : undefined;

  return (
    <Screen hasHeader title="Billing" subtitle="Annual plans, saved cards and payment history. Card details are entered only on Stripe's secure page.">
      {activeFlow ? (
        <PaymentStatusPanel
          operation={activeFlow.operation}
          loading={activeFlow.submitting}
          onReopen={activeFlow.reopen}
          onDone={() => { activeFlow.reset(); refresh(); }}
          onRefresh={refresh}
          successAction={createdLink(activeFlow.operation)}
        />
      ) : null}
      {flows.map((flow) => flow.error).filter(Boolean).map((message) => <Notice key={message} tone="warning" message={message!} style={styles.spaced} />)}

      {pending.length && !activeFlow ? (
        <ListSection title="Payments in progress">
          {pending.map((item) => (
            <ListRow key={item.operationId} icon="hourglass-outline" title={item.label} subtitle="Tap to check its status"
              onPress={() => (item.kind === "card-setup" ? cardFlow : item.kind === "subscription" ? subscriptionFlow : returnFlow).resume(item.operationId)} />
          ))}
        </ListSection>
      ) : null}

      {reminder ? <Notice tone="warning" message={reminder} style={styles.spaced} /> : null}

      <ListSection title="Your benefits">
        <ListRow icon={data?.hasPriceListAccess ? "checkmark-circle" : "close-circle-outline"} title="Price list"
          subtitle={data?.hasPriceListAccess ? "You can view the price guide." : "Buy a plan to view the price guide."} />
        <ListRow icon={data?.hasProviderVisibility ? "checkmark-circle" : "close-circle-outline"} title="Visible in search"
          subtitle={data?.hasProviderVisibility ? "Your services appear in customer search, and your prices count in the guide." : "Tradespeople need the Provider plan to appear in search."} />
        <ListRow icon="ticket-outline" title="Free inspection credits" subtitle={`${data?.balance.availableComplimentary ?? 0} available`} />
      </ListSection>

      {data?.subscription ? (
        <View style={[styles.subscription, { backgroundColor: muted }]}>
          <StatusBadge label={SUBSCRIPTION_STATUS_LABELS[data.subscription.status] ?? data.subscription.status}
            tone={data.subscription.status === "active" ? "success" : data.subscription.status === "suspended" || data.subscription.status === "past_due" ? "danger" : "neutral"} />
          <ThemedText type="headline">{allPlans.find((plan) => plan.code === data.subscription!.planCode)?.name ?? data.subscription.planCode}</ThemedText>
          <ThemedText type="callout" tone="muted">{subscriptionSummary(data.subscription, allPlans)}</ThemedText>
          {data.subscription.channel !== "stripe" ? (
            <Notice message="This plan was bought through another store. Manage it there; you can buy here after its paid year ends." />
          ) : null}
        </View>
      ) : null}

      <ThemedText type="label" tone="muted" style={styles.label}>PLANS</ThemedText>
      {planList.length === 0 ? <Notice message="No plans are available right now." style={styles.spaced} /> : null}
      {planList.map((plan) => {
        const action = planAction(plan, data);
        const price = planPrice(plan);
        return (
          <View key={plan.code} style={[styles.plan, { borderColor: action === "current" || action === "renew" ? tint : muted }]}>
            <View style={styles.planTop}>
              <ThemedText type="headline" style={styles.flex}>{plan.name}</ThemedText>
              {price ? <ThemedText type="headline" tone="tint">{`${formatMinor(price.amountMinor, price.currency)}/year`}</ThemedText> : null}
            </View>
            <ThemedText type="callout" tone="muted">{plan.description}</ThemedText>
            {!plan.isEligible ? <ThemedText type="footnote" tone="muted">Not available for your member type.</ThemedText> : null}
            {canManagePayments(user) && BUYABLE.includes(action) ? (
              <PrimaryButton title={ACTION_TITLES[action]} variant={action === "next_year" ? "secondary" : "primary"}
                onPress={() => { setConsent(false); setChoice({ plan, action }); }} disabled={busy} />
            ) : (
              <StatusBadge label={ACTION_TITLES[action]} tone={action === "current" || action === "prepaid" ? "success" : "neutral"} />
            )}
          </View>
        );
      })}

      <ListSection title="Saved cards" footer="Cards are stored by Stripe. We only see the brand, last 4 digits and expiry.">
        {(cards.data ?? []).map((card) => (
          <ListRow
            key={card.id}
            icon="card-outline"
            title={`${card.brand.toUpperCase()} •••• ${card.last4}${card.isDefault ? " (default)" : ""}`}
            subtitle={`Expires ${String(card.expMonth).padStart(2, "0")}/${card.expYear}`}
            onPress={() => setRemoving(card)}
          />
        ))}
        {(cards.data ?? []).length === 0 ? <ListRow icon="card-outline" title="No saved cards" /> : null}
      </ListSection>
      {canManagePayments(user) ? (
        <PrimaryButton title="Add a card" variant="secondary" leftIcon="add-circle-outline" onPress={() => { setConsent(false); setAddingCard(true); }} disabled={busy} style={styles.spaced} />
      ) : null}

      <ListSection title="History">
        <ListRow icon="receipt-outline" title="Payments and refunds" subtitle="Receipts, refunds and free credits" onPress={() => router.push("/(dashboard)/(menu)/billing-history")} />
      </ListSection>

      <ConfirmModal
        visible={choice !== null}
        icon="card-outline"
        title={choice ? `${ACTION_TITLES[choice.action]}: ${choice.plan.name}` : ""}
        message={choice ? ACTION_NOTES[choice.action] : undefined}
        confirmLabel="Continue to payment"
        confirmDisabled={!consent}
        onConfirm={buy}
        onCancel={() => setChoice(null)}
        customContent={chosenPrice && choice ? (
          <ConsentCheck checked={consent} onChange={setConsent}
            label={choice.action === "upgrade"
              ? `I agree to pay the difference to upgrade to ${choice.plan.name} for the rest of my current year (shown on Stripe before I pay).`
              : `I agree to a one-off payment of ${formatMinor(chosenPrice.amountMinor, chosenPrice.currency)} for one year of ${choice.plan.name}. It won't renew automatically.`} />
        ) : null}
      />

      <ConfirmModal
        visible={addingCard}
        icon="card-outline"
        title="Add a card"
        message="You'll enter the card on Stripe's secure page. Nothing is charged now; it becomes your default card."
        confirmLabel="Continue"
        confirmDisabled={!consent}
        onConfirm={addCard}
        onCancel={() => setAddingCard(false)}
        customContent={<ConsentCheck checked={consent} onChange={setConsent} label="I agree to save this card for future payments." />}
      />

      <ConfirmModal
        visible={removing !== null}
        icon="card-outline"
        title={removing ? `${removing.brand.toUpperCase()} •••• ${removing.last4}` : ""}
        message="Make this your default card, or remove it."
        confirmLabel="Remove card"
        tone="danger"
        isLoading={cardActions.remove.isPending}
        onConfirm={() => removing && canDeletePayments(user) && cardActions.remove.mutate(removing.id, {
          onSuccess: () => { showToast("Card removed.", "success"); setRemoving(null); },
          onError: () => setRemoving(null),
        })}
        onCancel={() => setRemoving(null)}
        customContent={removing && !removing.isDefault && canManagePayments(user) ? (
          <PrimaryButton title="Make default" variant="secondary" leftIcon="star-outline" loading={cardActions.setDefault.isPending}
            onPress={() => cardActions.setDefault.mutate(removing.id, { onSuccess: () => { showToast("Default card updated.", "success"); setRemoving(null); } })} />
        ) : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spaced: { marginBottom: Spacing.lg },
  label: { marginBottom: Spacing.sm, marginLeft: Spacing.xs, letterSpacing: 0.6 },
  subscription: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.xl },
  plan: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  planTop: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  flex: { flex: 1 },
});
