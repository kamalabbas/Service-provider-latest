import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import useAppVersion from "./useAppVersion";

// Navigation depends only on a session and the generic application update policy.
export function useUserStateRedirect(ready = true) {
  const router = useRouter();
  const navigation = useRootNavigationState();
  const segments = useSegments() as string[];
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const appVersionData = useAppVersion();
  const showToast = useToastStore((state) => state.showToast);
  const softUpdateToastShown = useRef(false);
  const currentGroup = segments[0];
  const currentScreen = segments[segments.length - 1];
  const policy = appVersionData?.data?.appVersionPolicy;

  useEffect(() => {
    if (!ready || !navigation?.key || user === undefined || !currentGroup) return;

    if (policy?.action === "soft" && !softUpdateToastShown.current) {
      showToast(policy.message, "error", true, "Update", policy.updateUrl);
      softUpdateToastShown.current = true;
    }

    if (policy?.action === "force") {
      if (!(currentGroup === "(auth)" && currentScreen === "forced-update")) {
        router.replace({
          pathname: "/(auth)/forced-update",
          params: {
            message: policy.message,
            latestVersion: policy.latestVersion,
            updateUrl: policy.updateUrl,
          },
        });
      }
      return;
    }

    if (!accessToken && currentGroup !== "(auth)") {
      router.replace("/(auth)");
    } else if (accessToken && currentGroup !== "(dashboard)") {
      router.replace("/(dashboard)");
    }
  }, [ready, navigation?.key, user, accessToken, currentGroup, currentScreen, policy, router, showToast]);
}
