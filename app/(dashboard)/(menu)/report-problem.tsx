import { FormInput } from "@/components/form/FormInput";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useSubmitIssueReport } from "@/hooks/useNotifications";
import { IssueReportPlatform } from "@/interfaces/notification.interface";
import { isAxiosError } from "axios";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet } from "react-native";

const platform: IssueReportPlatform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

// Guide 17: a diagnostic report, not a support conversation. There is no report history for members.
export default function ReportProblemScreen() {
  const router = useRouter();
  const submit = useSubmitIssueReport();
  const [attemptedAction, setAttemptedAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [traceId, setTraceId] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState<string>();
  const [reportId, setReportId] = useState<number | null>(null);

  if (reportId !== null) {
    return (
      <Screen hasHeader title="Thanks for the report">
        <Notice message={`Report #${reportId} was sent. We use it to investigate; you won't get a reply here. Reports are kept for 90 days.`} style={styles.spaced} />
        <PrimaryButton title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  const send = () => {
    if (submit.isPending) return;
    setError(undefined);
    submit.mutate({
      platform,
      appVersion: Constants.expoConfig?.version ?? "unknown",
      deviceModel: Device.modelName ?? null,
      attemptedAction,
      errorMessage,
      context,
      clientTraceId: traceId,
    }, {
      onSuccess: (response) => setReportId(response.data?.id ?? 0),
      // HTTP failures (including the 5-per-minute limit) are already shown; local checks aren't.
      onError: (failure) => { if (!isAxiosError(failure)) setError(failure.message); },
    });
  };

  return (
    <Screen hasHeader title="Report a problem" subtitle="Tell us what went wrong so we can fix it. For help with an account or a job, contact support instead.">
      <Notice message="Don't include passwords, codes or personal details. Obvious ones are removed before sending." style={styles.spaced} />
      <FormInput label="What were you trying to do?" value={attemptedAction} onChangeText={setAttemptedAction} maxLength={150} placeholder="e.g. Accept an inspection" />
      <FormInput label="What went wrong?" value={errorMessage} onChangeText={setErrorMessage} maxLength={2000} multiline placeholder="The message you saw, or what happened" />
      <FormInput label="Error reference (optional)" value={traceId} onChangeText={setTraceId} maxLength={100} autoCapitalize="none"
        helperText="If an error showed a reference code, enter it here." />
      <FormInput label="Anything else (optional)" value={context} onChangeText={setContext} maxLength={4000} multiline error={error} />
      <PrimaryButton
        title={submit.isPending ? "Sending..." : "Send report"}
        leftIcon="send-outline"
        onPress={send}
        loading={submit.isPending}
        disabled={submit.isPending || !attemptedAction.trim() || !errorMessage.trim()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spaced: { marginBottom: Spacing.lg },
});
