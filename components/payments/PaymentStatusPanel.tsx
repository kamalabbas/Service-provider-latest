import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Radius, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import type { PaymentOperation } from "@/interfaces/payment.interface";
import { cancelPaymentOperation } from "@/services/paymentService";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { canDeletePayments } from "@/utility/access";
import { isOperationSettled, operationView } from "@/utility/paymentRules";
import { createUuid } from "@/utility/uuid";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type PaymentStatusPanelProps = {
  operation: PaymentOperation | null;
  /** Still waiting for the first answer. */
  loading?: boolean;
  onReopen: () => void;
  onDone: () => void;
  /** Re-reads the operation after a cancellation. */
  onRefresh: () => void;
  /** Extra action for a settled success, e.g. "View inspection". */
  successAction?: { title: string; onPress: () => void };
};

// Guide 21: where a payment stands, from the server's verified state. Leaving Stripe's page is
// never treated as payment; this keeps checking until the operation settles.
export function PaymentStatusPanel({ operation, loading, onReopen, onDone, onRefresh, successAction }: PaymentStatusPanelProps) {
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");
  const tint = useThemeColor({}, "tint");
  const [cancelling, setCancelling] = useState(false);

  if (!operation) {
    return loading ? (
      <View style={[styles.box, { backgroundColor: surface, borderColor: border }]}>
        <ActivityIndicator color={tint} />
        <ThemedText type="callout" tone="muted">Starting your payment…</ThemedText>
      </View>
    ) : null;
  }

  const view = operationView(operation);
  const settled = isOperationSettled(operation);
  const canCancel = !settled && canDeletePayments(user);

  // Cancels an unpaid Checkout with its own request ID, then re-reads the original operation.
  const cancel = async () => {
    setCancelling(true);
    try {
      await cancelPaymentOperation(operation.id, { requestId: createUuid(), consentAccepted: false });
      showToast("Payment cancelled. You weren't charged.", "success");
    } catch {
      // The interceptor explains failures; a completed payment can't be cancelled here.
    } finally {
      setCancelling(false);
      onRefresh();
    }
  };

  return (
    <View style={[styles.box, { backgroundColor: surface, borderColor: border }]} accessibilityLiveRegion="polite">
      <View style={styles.heading}>
        {settled ? null : <ActivityIndicator color={tint} />}
        <StatusBadge label={view.title} tone={view.tone} />
      </View>
      <ThemedText type="callout">{view.text}</ThemedText>
      <ThemedText type="footnote" tone="muted" selectable>{`Reference ${operation.id}`}</ThemedText>

      {operation.status === "requires_action" && operation.checkoutUrl ? (
        <PrimaryButton title="Open the secure payment page" leftIcon="lock-closed-outline" onPress={onReopen} />
      ) : null}
      {settled && operation.status === "succeeded" && successAction ? (
        <PrimaryButton title={successAction.title} leftIcon="arrow-forward-outline" onPress={successAction.onPress} />
      ) : null}
      {canCancel ? (
        <PrimaryButton title="Cancel payment" variant="secondary" leftIcon="close-circle-outline" onPress={cancel} loading={cancelling} disabled={cancelling} />
      ) : null}
      {settled ? <PrimaryButton title="Done" variant="ghost" onPress={onDone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.xl },
  heading: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
});
