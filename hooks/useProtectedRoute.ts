import { useAuthStore } from "@/stores/authStore";
import { useRouter, type Href } from "expo-router";
import { useEffect } from "react";

export function useProtectedRoute(redirectTo: Href = "/(auth)") {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user !== undefined && !accessToken) router.replace(redirectTo);
  }, [user, accessToken, router, redirectTo]);
}
