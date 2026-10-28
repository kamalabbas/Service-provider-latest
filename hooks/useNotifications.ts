import { CreateIssueReportRequest } from "@/interfaces/notification.interface";
import { listMyPushInstallations, submitIssueReport } from "@/services/notificationService";
import { disablePushOnThisDevice, enablePushOnThisDevice } from "@/services/pushRegistration";
import { useAuthStore } from "@/stores/authStore";
import { canViewPushInstallations } from "@/utility/access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Keys always include the account ID so a different account never reads this cache.
export const notificationKeys = {
  all: (accountId: string | null) => ["notifications", accountId] as const,
  installations: (accountId: string | null) => [...notificationKeys.all(accountId), "installations"] as const,
};

/** This account's registered devices (token text is never returned). */
export function useMyPushInstallations() {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: notificationKeys.installations(user?.id ?? null),
    queryFn: ({ signal }) => listMyPushInstallations(signal),
    enabled: canViewPushInstallations(user),
    select: (response) => response.data ?? [],
  });
}

export function usePushOnThisDevice() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const onSettled = () => queryClient.invalidateQueries({ queryKey: notificationKeys.installations(accountId) });
  return {
    enable: useMutation({ mutationFn: enablePushOnThisDevice, onSettled }),
    disable: useMutation({ mutationFn: disablePushOnThisDevice, onSettled }),
  };
}

/** One submission per report; no automatic resubmission. */
export function useSubmitIssueReport() {
  return useMutation({ mutationFn: (body: CreateIssueReportRequest) => submitIssueReport(body) });
}
