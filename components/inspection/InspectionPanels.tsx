import { DateTimeInput } from "@/components/form/DateTimeInput";
import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { ThemedText } from "@/components/ThemedText";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Radius, Shadow, Spacing, Typography } from "@/constants/Theme";
import { useMyEmployees } from "@/hooks/useEmployees";
import { useThemeColor } from "@/hooks/useThemeColor";
import { AcceptInspectionRequest, Inspection, InspectionCompletionCode, InspectionResponse, InspectionCompletionCodeResponse, RateInspectionRequest } from "@/interfaces/inspection.interface";
import { employeeName } from "@/utility/employeeForm";
import { formatCountdown, isFutureAppointment, matchingEmployees, secondsUntil } from "@/utility/inspectionRules";
import Ionicons from "@expo/vector-icons/Ionicons";
import { UseMutationResult } from "@tanstack/react-query";
import { PropsWithChildren, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Mutation<TVariables> = UseMutationResult<InspectionResponse, Error, TVariables>;
const NO_WORKER = "";

export function Panel({ title, children }: PropsWithChildren<{ title: string }>) {
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");
  return (
    <View style={[styles.panel, Shadow.card, { backgroundColor: surface, borderColor: border }]}>
      <ThemedText type="headline" style={styles.panelTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

/** Active roster workers matching the service occupation; the server re-checks the business. */
function useWorkerOptions(occupationCode: string) {
  const employees = useMyEmployees({}, 100);
  const options = matchingEmployees(employees.data ?? [], occupationCode).map((employee) => ({
    label: employee.positionName ? `${employeeName(employee)} · ${employee.positionName}` : employeeName(employee),
    value: String(employee.id),
  }));
  return { options: [{ label: "No worker yet", value: NO_WORKER }, ...options], loading: employees.isLoading, count: options.length };
}

// Provider, pending: accept with a future appointment and an optional matching worker.
export function AcceptPanel({ inspection, mutation }: { inspection: Inspection; mutation: Mutation<AcceptInspectionRequest> }) {
  const [when, setWhen] = useState<Date | null>(null);
  const [worker, setWorker] = useState(NO_WORKER);
  const [error, setError] = useState<string>();
  const workers = useWorkerOptions(inspection.occupationCode);

  const accept = () => {
    if (!isFutureAppointment(when)) return setError("Choose a future date and time.");
    setError(undefined);
    mutation.mutate({ scheduledAt: when!.toISOString(), employeeId: worker ? Number(worker) : null });
  };

  return (
    <Panel title="Accept this request">
      <DateTimeInput label="Appointment" value={when} onChange={setWhen} minimumDate={new Date()} error={error} />
      <SelectInput label="Worker (optional)" value={worker} onChange={setWorker} options={workers.options} loading={workers.loading} />
      {workers.count === 0 && !workers.loading ? (
        <ThemedText type="footnote" tone="muted" style={styles.note}>No active employees match {inspection.occupationName}. You can assign one later.</ThemedText>
      ) : null}
      <PrimaryButton title={mutation.isPending ? "Accepting..." : "Accept"} leftIcon="checkmark-circle-outline" onPress={accept} loading={mutation.isPending} disabled={mutation.isPending} />
    </Panel>
  );
}

// Provider, accepted: assign, replace or clear the worker.
export function WorkerPanel({ inspection, mutation }: { inspection: Inspection; mutation: Mutation<number | null> }) {
  const current = inspection.assignedEmployee ? String(inspection.assignedEmployee.id) : NO_WORKER;
  const [worker, setWorker] = useState(current);
  const workers = useWorkerOptions(inspection.occupationCode);
  return (
    <Panel title="Assigned worker">
      <SelectInput label="Worker" value={worker} onChange={setWorker} options={workers.options} loading={workers.loading} />
      <PrimaryButton
        title={mutation.isPending ? "Saving..." : worker ? "Save worker" : "Clear worker"}
        variant="secondary"
        onPress={() => mutation.mutate(worker ? Number(worker) : null)}
        loading={mutation.isPending}
        disabled={mutation.isPending || worker === current}
      />
    </Panel>
  );
}

// Requester, accepted: the six-digit code exists only in this component's state.
export function CompletionCodePanel({ mutation }: { mutation: UseMutationResult<InspectionCompletionCodeResponse, Error, void> }) {
  const [code, setCode] = useState<InspectionCompletionCode | null>(null);
  const [seconds, setSeconds] = useState(0);
  const tint = useThemeColor({}, "tint");

  useEffect(() => {
    if (!code) return;
    const tick = () => {
      const left = secondsUntil(code.expiresAtUtc);
      setSeconds(left);
      if (left === 0) setCode(null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [code]);

  const issue = () => mutation.mutate(undefined, { onSuccess: (response) => setCode(response.data ?? null) });

  return (
    <Panel title="Completion code">
      <ThemedText type="caption" tone="muted" style={styles.note}>
        {"When the inspection is done, show this code to the provider. It lasts 10 minutes and works once. Completing isn't a payment confirmation."}
      </ThemedText>
      {code ? (
        <View style={styles.code}>
          <Text style={[styles.codeText, { color: tint }]} accessibilityLabel={`Code ${code.code.split("").join(" ")}`} selectable={false}>{code.code}</Text>
          <ThemedText type="caption" tone="muted">Expires in {formatCountdown(seconds)}</ThemedText>
        </View>
      ) : null}
      <PrimaryButton
        title={mutation.isPending ? "Getting code..." : code ? "Get a new code" : "Show completion code"}
        variant={code ? "secondary" : "primary"}
        leftIcon="key-outline"
        onPress={issue}
        loading={mutation.isPending}
        disabled={mutation.isPending}
      />
      {code ? <ThemedText type="footnote" tone="muted" style={styles.note}>A new code replaces this one. You can request one a minute after the last.</ThemedText> : null}
    </Panel>
  );
}

// Provider, accepted: enter the code the customer shows. Wrong attempts count; five exhaust it.
export function CompletePanel({ mutation }: { mutation: Mutation<string> }) {
  const [code, setCode] = useState("");
  return (
    <Panel title="Complete the inspection">
      <FormInput
        label="Customer's completion code"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="6 digits"
        helperText="Ask the customer to open the request and show their code. Wrong codes count towards a limit of five."
      />
      <PrimaryButton
        title={mutation.isPending ? "Completing..." : "Mark as completed"}
        leftIcon="checkmark-done-outline"
        onPress={() => mutation.mutate(code, { onSettled: () => setCode("") })}
        loading={mutation.isPending}
        disabled={mutation.isPending || code.length !== 6}
      />
    </Panel>
  );
}

// Requester, completed: rate once, 1–5 with an optional note.
export function RatingPanel({ mutation }: { mutation: Mutation<RateInspectionRequest> }) {
  const [score, setScore] = useState(0);
  const [note, setNote] = useState("");
  const star = useThemeColor({}, "warning");
  const muted = useThemeColor({}, "textMuted");
  return (
    <Panel title="Rate this inspection">
      <View style={styles.stars} accessibilityRole="adjustable" accessibilityValue={{ min: 1, max: 5, now: score }}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable key={value} onPress={() => setScore(value)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${value} star${value > 1 ? "s" : ""}`}>
            <Ionicons name={value <= score ? "star" : "star-outline"} size={34} color={value <= score ? star : muted} />
          </Pressable>
        ))}
      </View>
      <FormInput label="Comment (optional)" value={note} onChangeText={setNote} multiline maxLength={2000} />
      <ThemedText type="footnote" tone="muted" style={styles.note}>{"You can rate once. It can't be changed later."}</ThemedText>
      <PrimaryButton
        title={mutation.isPending ? "Sending..." : "Submit rating"}
        onPress={() => mutation.mutate({ score, note })}
        loading={mutation.isPending}
        disabled={mutation.isPending || score === 0}
      />
    </Panel>
  );
}

/** Reject or cancel with an optional reason. */
export function ReasonModal({ visible, title, message, confirmLabel, isLoading, onConfirm, onCancel }: {
  visible: boolean; title: string; message: string; confirmLabel: string; isLoading: boolean;
  onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (visible) setReason(""); }, [visible]);
  return (
    <ConfirmModal
      visible={visible}
      icon="close-circle-outline"
      tone="danger"
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      isLoading={isLoading}
      onConfirm={() => onConfirm(reason)}
      onCancel={onCancel}
      customContent={<FormInput label="Reason (optional)" value={reason} onChangeText={setReason} maxLength={2000} multiline />}
    />
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.xl },
  panelTitle: { marginBottom: Spacing.md },
  note: { marginBottom: Spacing.md },
  code: { alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.lg },
  codeText: { ...Typography.display, letterSpacing: 8, fontVariant: ["tabular-nums"] },
  stars: { flexDirection: "row", justifyContent: "center", gap: Spacing.md, marginBottom: Spacing.lg },
});
