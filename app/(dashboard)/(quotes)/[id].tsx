import { ThemedText } from "@/components/ThemedText";
import { ReasonModal } from "@/components/inspection/InspectionPanels";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useQuote, useQuoteActions } from "@/hooks/useQuotes";
import { pickPdf, openPdf } from "@/services/devicePdf";
import { downloadQuotePdf } from "@/services/quoteService";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { formatAud, formatLocalTimestamp } from "@/utility/apiValues";
import { QUOTE_STATUS_LABELS, expiryText, quoteActions, quotePdfFileName, quoteRole } from "@/utility/quoteRules";
import { isAxiosError } from "axios";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

// Guide 09: quote detail, decisions, private PDF and history.
export default function QuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quoteId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const { data: quote, isLoading, refetch } = useQuote(quoteId);
  const actions = useQuoteActions(quoteId ?? 0);
  const [now, setNow] = useState(Date.now());
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [prompt, setPrompt] = useState<"reject" | "withdraw" | null>(null);
  const [opening, setOpening] = useState(false);

  // Local countdown only; decisions refetch first because expiry is decided by the server.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the quote…" /></Screen>;
  if (!quote) return <Screen hasHeader><Notice tone="warning" message="This quote is unavailable." /></Screen>;

  const role = quoteRole(quote, user?.id);
  const allowed = quoteActions(quote, user, now);
  const pending = quote.status === "pending";
  const localError = (error: unknown) => {
    if (!isAxiosError(error)) showToast(error instanceof Error ? error.message : "Something went wrong.", "error");
  };

  // Refetch before a decision; act only if the fresh quote still allows it.
  const decideAfterRefresh = async (action: "accept" | "reject" | "withdraw", run: () => void) => {
    const fresh = (await refetch()).data;
    if (fresh && quoteActions(fresh, user)[action]) run();
    else showToast("This quote has changed. Check its status.", "info");
  };

  const openQuotePdf = async () => {
    if (!quote.pdfDownloadUrl) return;
    setOpening(true);
    try {
      const pdf = await downloadQuotePdf(quote.pdfDownloadUrl);
      await openPdf(pdf.data, quotePdfFileName(quote.quoteNumber));
    } catch (error) {
      localError(error);
    } finally {
      setOpening(false);
    }
  };

  const attachPdf = async () => {
    const file = await pickPdf();
    if (!file) return;
    actions.uploadPdf.mutate(file, { onSuccess: () => showToast("PDF attached to the quote.", "success"), onError: localError });
  };

  return (
    <Screen hasHeader title={formatAud(quote.totalAmount)} subtitle={`${quote.quoteNumber} · ${QUOTE_STATUS_LABELS[quote.status] ?? quote.status}`}>
      {pending ? (
        <Notice
          tone={allowed.accept || role === "provider" ? "info" : "warning"}
          message={`${expiryText(quote.expiresAtUtc, now)} (${formatLocalTimestamp(quote.expiresAtUtc)}).${role === "customer" && !quote.canAccept ? " This quote can't be accepted right now, for example because the provider is unavailable." : ""}`}
          style={styles.notice}
        />
      ) : null}

      <ListSection title="Quote">
        <ListRow icon="construct-outline" title={quote.serviceTitle} subtitle={quote.businessName} />
        <ListRow
          icon="person-outline"
          title={role === "provider" ? quote.customerName : quote.providerName}
          subtitle={`Membership ID ${role === "provider" ? quote.customerMembershipId : quote.providerMembershipId}`}
        />
        {quote.note ? <ListRow icon="chatbox-outline" title="Note" subtitle={quote.note} /> : null}
        <ListRow icon="calendar-outline" title="Issued" subtitle={formatLocalTimestamp(quote.createdAtUtc)} />
        {quote.decidedAtUtc ? <ListRow icon="checkmark-done-outline" title="Decided" subtitle={formatLocalTimestamp(quote.decidedAtUtc)} /> : null}
      </ListSection>

      <ListSection title="Document" footer="The server checks the file is a PDF; that isn't a full safety scan. PDFs lock once the quote is decided or expires.">
        <View style={styles.pdf}>
          {quote.pdfDownloadUrl ? (
            <PrimaryButton title={opening ? "Opening..." : "Open PDF"} variant="secondary" leftIcon="document-attach-outline" onPress={openQuotePdf} loading={opening} disabled={opening} />
          ) : (
            <ThemedText type="caption" tone="muted">No PDF attached.</ThemedText>
          )}
          {allowed.uploadPdf ? (
            <PrimaryButton
              title={actions.uploadPdf.isPending ? "Uploading..." : quote.pdfDownloadUrl ? "Replace PDF" : "Attach PDF"}
              variant="ghost"
              leftIcon="cloud-upload-outline"
              onPress={attachPdf}
              loading={actions.uploadPdf.isPending}
              disabled={actions.uploadPdf.isPending}
            />
          ) : null}
        </View>
      </ListSection>

      {quote.history.length ? (
        <ListSection title="History">
          {quote.history.map((event, index) => (
            <ListRow
              key={`${event.createdAtUtc}-${index}`}
              icon="time-outline"
              title={QUOTE_STATUS_LABELS[event.status as keyof typeof QUOTE_STATUS_LABELS] ?? event.action}
              subtitle={[formatLocalTimestamp(event.createdAtUtc), event.note].filter(Boolean).join(" · ")}
            />
          ))}
        </ListSection>
      ) : null}

      <View style={styles.actions}>
        {allowed.accept ? <PrimaryButton title="Accept quote" leftIcon="checkmark-circle-outline" onPress={() => setConfirmAccept(true)} /> : null}
        {allowed.reject ? <PrimaryButton title="Reject quote" variant="danger" leftIcon="close-circle-outline" onPress={() => setPrompt("reject")} /> : null}
        {allowed.withdraw ? <PrimaryButton title="Withdraw quote" variant="danger" leftIcon="arrow-undo-outline" onPress={() => setPrompt("withdraw")} /> : null}
      </View>

      <ConfirmModal
        visible={confirmAccept}
        icon="checkmark-circle-outline"
        title={`Accept ${formatAud(quote.totalAmount)}?`}
        message="Accepting is final. It isn't a payment; arrange payment with the provider."
        confirmLabel="Accept"
        isLoading={actions.accept.isPending}
        onCancel={() => setConfirmAccept(false)}
        onConfirm={() => decideAfterRefresh("accept", () => actions.accept.mutate(undefined, {
          onSuccess: () => showToast("Quote accepted.", "success"),
          onSettled: () => setConfirmAccept(false),
        }))}
      />

      <ReasonModal
        visible={prompt !== null}
        title={prompt === "reject" ? "Reject this quote?" : "Withdraw this quote?"}
        message={prompt === "reject" ? "Rejecting is final. The provider can send a new quote." : "Withdrawing is final. You can send a replacement quote."}
        confirmLabel={prompt === "reject" ? "Reject" : "Withdraw"}
        isLoading={actions.reject.isPending || actions.withdraw.isPending}
        onCancel={() => setPrompt(null)}
        onConfirm={(reason) => {
          const action = prompt!;
          decideAfterRefresh(action, () => actions[action].mutate(reason, {
            onSuccess: () => showToast(action === "reject" ? "Quote rejected." : "Quote withdrawn.", "success"),
            onSettled: () => setPrompt(null),
          }));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.xl },
  pdf: { padding: Spacing.lg, gap: Spacing.md },
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
});
