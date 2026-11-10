import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spacing } from "@/constants/Theme";
import { useInspectionRefunds, usePaymentConfirmations, usePaymentTransactions } from "@/hooks/usePayments";
import { useCardRefunds } from "@/hooks/useCardRequests";
import { useToastStore } from "@/stores/toastStore";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { FUNDING_LABELS, REFUND_STATUS_LABELS, formatMinor, isTrustedReceiptUrl } from "@/utility/paymentRules";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet } from "react-native";

type Tab = "payments" | "refunds" | "credits";

const TABS = [
  { label: "Payments", value: "payments" },
  { label: "Refunds", value: "refunds" },
  { label: "Free credits", value: "credits" },
] as const satisfies readonly { label: string; value: Tab }[];

const PURPOSE_LABELS: Record<string, string> = {
  subscription: "Subscription",
  inspection_confirmation: "Inspection booking fee",
  card_request: "Membership card",
};

// Guide 21/22: charges with receipts, automatic refunds (inspections and cards) and free credits.
export default function BillingHistoryScreen() {
  const showToast = useToastStore((state) => state.showToast);
  const [tab, setTab] = useState<Tab>("payments");
  const transactions = usePaymentTransactions();
  const refunds = useInspectionRefunds();
  const cardRefunds = useCardRefunds();
  const confirmations = usePaymentConfirmations();

  const openReceipt = async (url?: string | null) => {
    if (!isTrustedReceiptUrl(url)) return showToast("This receipt link can't be opened.", "error");
    try { await WebBrowser.openBrowserAsync(url); } catch { showToast("The receipt couldn't be opened.", "error"); }
  };

  const more = (query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }) =>
    query.hasNextPage ? (
      <PrimaryButton title={query.isFetchingNextPage ? "Loading..." : "Show more"} variant="secondary" onPress={() => query.fetchNextPage()}
        loading={query.isFetchingNextPage} disabled={query.isFetchingNextPage} style={styles.spaced} />
    ) : null;

  return (
    <Screen hasHeader title="Payment history">
      <SegmentedControl options={TABS} value={tab} onChange={setTab} style={styles.spaced} />

      {tab === "payments" ? (
        transactions.isLoading ? <Loader visible overlay={false} message="Loading payments…" /> : (transactions.data ?? []).length === 0 ? (
          <Notice message="No payments yet." />
        ) : (
          <>
            <ListSection footer="Tap a payment to open its Stripe receipt.">
              {(transactions.data ?? []).map((item) => (
                <ListRow
                  key={item.id}
                  icon={item.refundedMinor > 0 ? "return-down-back-outline" : "receipt-outline"}
                  title={`${PURPOSE_LABELS[item.purpose] ?? item.purpose} · ${formatMinor(item.amountMinor, item.currency)}`}
                  subtitle={[
                    formatLocalTimestamp(item.createdAtUtc),
                    item.refundedMinor > 0 ? `${formatMinor(item.refundedMinor, item.currency)} refunded` : null,
                    item.isDisputed ? "Disputed" : null,
                  ].filter(Boolean).join(" · ")}
                  onPress={item.receiptUrl ? () => openReceipt(item.receiptUrl) : undefined}
                />
              ))}
            </ListSection>
            {more(transactions)}
          </>
        )
      ) : null}

      {tab === "refunds" ? (
        refunds.isLoading || cardRefunds.isLoading ? <Loader visible overlay={false} message="Loading refunds…" /> : (
          <>
            <ListSection title="Inspections" footer="Refunds are automatic when a booking is rejected or cancelled. Your bank may take a few days to show them.">
              {(refunds.data ?? []).map((item) => (
                <ListRow key={item.id} icon="return-down-back-outline"
                  title={`${REFUND_STATUS_LABELS[item.status] ?? item.status} · ${formatMinor(item.originalAmountMinor, item.currency)}`}
                  subtitle={[formatLocalTimestamp(item.createdAtUtc), item.reason].filter(Boolean).join(" · ")} />
              ))}
              {(refunds.data ?? []).length === 0 ? <ListRow icon="return-down-back-outline" title="No inspection refunds" /> : null}
            </ListSection>
            {more(refunds)}
            <ListSection title="Membership cards">
              {(cardRefunds.data ?? []).map((item) => (
                <ListRow key={item.id} icon="return-down-back-outline"
                  title={`${REFUND_STATUS_LABELS[item.status] ?? item.status} · ${formatMinor(item.amountMinor)}`}
                  subtitle={[formatLocalTimestamp(item.createdAtUtc), item.reason].filter(Boolean).join(" · ")} />
              ))}
              {(cardRefunds.data ?? []).length === 0 ? <ListRow icon="return-down-back-outline" title="No card refunds" /> : null}
            </ListSection>
            {more(cardRefunds)}
          </>
        )
      ) : null}

      {tab === "credits" ? (
        confirmations.isLoading ? <Loader visible overlay={false} message="Loading credits…" /> : (confirmations.data ?? []).length === 0 ? (
          <Notice message="No inspection credits yet. Free credits from our team appear here and are used before any charge." />
        ) : (
          <>
            <ListSection title="Inspection booking credits">
              {(confirmations.data ?? []).map((item) => (
                <ListRow key={item.id} icon="ticket-outline"
                  title={`${FUNDING_LABELS[item.source] ?? item.source} · ${item.status}`}
                  subtitle={[formatLocalTimestamp(item.createdAtUtc), item.originalAmountMinor ? formatMinor(item.originalAmountMinor, item.currency) : null].filter(Boolean).join(" · ")} />
              ))}
            </ListSection>
            {more(confirmations)}
          </>
        )
      ) : null}

      <ThemedText type="footnote" tone="muted" style={styles.note}>Amounts are in Australian dollars.</ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  spaced: { marginBottom: Spacing.lg },
  note: { textAlign: "center" },
});
