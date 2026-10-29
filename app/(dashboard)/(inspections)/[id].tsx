import { ThemedText } from "@/components/ThemedText";
import { AcceptPanel, CompletePanel, CompletionCodePanel, RatingPanel, ReasonModal, WorkerPanel } from "@/components/inspection/InspectionPanels";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useInspection, useInspectionActions } from "@/hooks/useInspections";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { STATUS_LABELS, inspectionActions, inspectionRole } from "@/utility/inspectionRules";
import { canIssueQuoteFor } from "@/utility/quoteRules";
import { referenceLabel } from "@/utility/referenceOptions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

// Guide 08: detail, timeline and every action the matrix allows for this member.
export default function InspectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const inspectionId = Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const { data: inspection, isLoading } = useInspection(inspectionId);
  const regions = useReferenceChoices("regions");
  const actions = useInspectionActions(inspectionId ?? 0);
  const [prompt, setPrompt] = useState<"reject" | "cancel" | null>(null);

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the inspection…" /></Screen>;
  if (!inspection) return <Screen hasHeader><Notice tone="warning" message="This inspection is unavailable." /></Screen>;

  const role = inspectionRole(inspection, user?.id);
  const allowed = inspectionActions(inspection, user);
  const done = (message: string) => ({ onSuccess: () => showToast(message, "success") });
  const address = inspection.visitAddress;
  const worker = inspection.assignedEmployee;

  return (
    <Screen hasHeader title={inspection.serviceTitle} subtitle={`${STATUS_LABELS[inspection.status] ?? inspection.status}${inspection.isHidden ? " · hidden from your list" : ""}`}>
      {allowed.accept ? <AcceptPanel inspection={inspection} mutation={actions.accept} /> : null}
      {allowed.issueCode ? <CompletionCodePanel mutation={actions.issueCode} /> : null}
      {allowed.complete ? <CompletePanel mutation={actions.complete} /> : null}
      {allowed.assignWorker ? <WorkerPanel key={worker?.id ?? "none"} inspection={inspection} mutation={actions.assignWorker} /> : null}
      {allowed.rate ? <RatingPanel mutation={actions.rate} /> : null}

      <ListSection title="Appointment">
        <ListRow icon="calendar-outline" title="Scheduled" subtitle={inspection.scheduledAtUtc ? formatLocalTimestamp(inspection.scheduledAtUtc) : "Not scheduled yet"} />
        <ListRow
          icon="person-outline"
          title="Worker"
          // A cleared or archived worker means the provider attends; never show them as on the way.
          subtitle={worker ? [worker.name, worker.occupationName, worker.positionName].filter(Boolean).join(" · ") : `${inspection.providerName} (provider)`}
        />
      </ListSection>

      <ListSection title="Visit">
        <ListRow icon="home-outline" title="Address" subtitle={`${address.streetAddress}, ${address.suburb} ${referenceLabel(regions.data, address.regionCode)} ${address.postalCode}`} />
        {inspection.requestNote ? <ListRow icon="chatbox-outline" title="Note" subtitle={inspection.requestNote} /> : null}
      </ListSection>

      <ListSection title={role === "provider" ? "Customer" : "Provider"}>
        {role === "provider" ? (
          <>
            <ListRow icon="person-circle-outline" title={inspection.requesterName} subtitle={`Membership ID ${inspection.requesterMembershipId}`} />
            <ListRow icon="call-outline" title="Mobile" subtitle={inspection.requesterMobilePhone} />
          </>
        ) : (
          <ListRow icon="business-outline" title={inspection.businessName} subtitle={`${inspection.providerName} · Membership ID ${inspection.providerMembershipId}`} />
        )}
        <ListRow icon="construct-outline" title="Occupation" subtitle={inspection.occupationName} />
      </ListSection>

      {inspection.ratingScore ? (
        <ListSection title="Rating">
          <ListRow icon="star" title={`${inspection.ratingScore} out of 5`} subtitle={inspection.ratingNote ?? undefined} />
        </ListSection>
      ) : null}

      {inspection.history.length ? (
        <ListSection title="Timeline">
          {inspection.history.map((event, index) => (
            <ListRow
              key={`${event.createdAtUtc}-${index}`}
              icon="time-outline"
              title={STATUS_LABELS[event.status as keyof typeof STATUS_LABELS] ?? event.action}
              subtitle={[formatLocalTimestamp(event.createdAtUtc), event.note].filter(Boolean).join(" · ")}
            />
          ))}
        </ListSection>
      ) : null}

      {inspection.employeeAssignmentHistory.length ? (
        <ListSection title="Worker history">
          {inspection.employeeAssignmentHistory.map((entry, index) => (
            <ListRow
              key={`${entry.employeeId}-${entry.assignedAtUtc}-${index}`}
              icon="people-outline"
              title={entry.name}
              subtitle={`${formatLocalTimestamp(entry.assignedAtUtc)}${entry.endedAtUtc ? ` – ${formatLocalTimestamp(entry.endedAtUtc)}${entry.endReason ? ` (${entry.endReason})` : ""}` : " · current"}`}
            />
          ))}
        </ListSection>
      ) : null}

      <View style={styles.actions}>
        {canIssueQuoteFor(inspection, user) ? (
          <PrimaryButton
            title="Send a quote"
            leftIcon="document-text-outline"
            onPress={() => router.push({ pathname: "/(dashboard)/(quotes)/new", params: { inspectionId: String(inspection.id) } }, { withAnchor: true })}
          />
        ) : null}
        {allowed.reject ? <PrimaryButton title="Reject request" variant="danger" leftIcon="close-circle-outline" onPress={() => setPrompt("reject")} /> : null}
        {allowed.cancel ? <PrimaryButton title="Cancel request" variant="danger" leftIcon="close-outline" onPress={() => setPrompt("cancel")} /> : null}
        {allowed.hide ? (
          <PrimaryButton title="Hide from my list" variant="ghost" leftIcon="eye-off-outline" loading={actions.setHidden.isPending}
            onPress={() => actions.setHidden.mutate(true, done("Hidden from your list. The other party still sees it."))} />
        ) : null}
        {allowed.restore ? (
          <PrimaryButton title="Show in my list again" variant="ghost" leftIcon="eye-outline" loading={actions.setHidden.isPending}
            onPress={() => actions.setHidden.mutate(false, done("Restored to your list."))} />
        ) : null}
      </View>
      {role === null ? <ThemedText type="footnote" tone="muted">{"You're not part of this inspection."}</ThemedText> : null}

      <ReasonModal
        visible={prompt !== null}
        title={prompt === "reject" ? "Reject this request?" : "Cancel this request?"}
        message={prompt === "reject" ? "The customer will be told it was rejected." : "The other party will be told it was cancelled."}
        confirmLabel={prompt === "reject" ? "Reject" : "Cancel request"}
        isLoading={actions.reject.isPending || actions.cancel.isPending}
        onCancel={() => setPrompt(null)}
        onConfirm={(reason) => {
          const mutation = prompt === "reject" ? actions.reject : actions.cancel;
          mutation.mutate(reason, { onSettled: () => setPrompt(null), ...done(prompt === "reject" ? "Request rejected." : "Request cancelled.") });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
});
