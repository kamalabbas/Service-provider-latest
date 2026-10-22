import { AppVersionData } from "@/interfaces/appVersionInterface";
import useAppVersion from "@/hooks/useAppVersion";
import { useToastStore } from "@/stores/toastStore";
import { createContext, useEffect, useRef } from "react";

// Share the root's existing version check with nested layouts and the update
// screen. Consumers read this context; they do not start another check.
export const AppUpdatePolicyContext = createContext<AppVersionData["appVersionPolicy"] | undefined>(undefined);

export function useAppUpdatePolicy(ready: boolean) {
  const policy = useAppVersion()?.data?.appVersionPolicy;
  const showToast = useToastStore((state) => state.showToast);
  const softUpdateToastShown = useRef(false);

  useEffect(() => {
    if (ready && policy?.action === "soft" && !softUpdateToastShown.current) {
      softUpdateToastShown.current = true;
      showToast(policy.message, "error", true, "Update", policy.updateUrl);
    }
  }, [ready, policy, showToast]);

  return policy;
}
