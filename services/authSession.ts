import { refreshTokenRequest, refreshTokenResponse } from "@/interfaces/auth.interface";
import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { User } from "@/interfaces/user.interface";
import { useAuthStore } from "@/stores/authStore";
import { getRefreshToken, removeRefreshToken, setRefreshToken } from "@/utility/secureStore";
import axios, { AxiosError } from "axios";

let refreshPromise: Promise<string | null> | null = null;
let restorePromise: Promise<void> | null = null;
let refreshBlocked = false;
let restoreAttempted = false;

const isInvalidRefreshError = (error: unknown): boolean => {
  const axiosError = error as AxiosError<{ status?: number; title?: string; detail?: string }>;
  const status = axiosError.response?.status ?? axiosError.response?.data?.status;
  const title = axiosError.response?.data?.title ?? "";
  const detail = axiosError.response?.data?.detail ?? "";
  return (status === 400 || status === 401) && `${title} ${detail}`.includes("INVALID_REFRESH_TOKEN");
};

const clearSessionOnce = async () => {
  await removeRefreshToken();
  const state = useAuthStore.getState();
  if (state.user !== null || state.accessToken !== null) {
    state.clearAuth();
  }
};

export const setAuthenticatedSession = async (params: { user: User; accessToken: string; refreshToken: string }) => {
  refreshBlocked = false;
  restoreAttempted = true;
  useAuthStore.setState({ user: params.user, accessToken: params.accessToken });
  await setRefreshToken(params.refreshToken);
};

export const resetSessionRefreshGuard = () => {
  refreshBlocked = false;
};

export const isRefreshBlocked = () => refreshBlocked;

export const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshBlocked) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshTok = await getRefreshToken();
        if (!refreshTok) {
          refreshBlocked = true;
          await clearSessionOnce();
          return null;
        }

        const payload: refreshTokenRequest = { refreshToken: refreshTok };
        const response = await axios.post<BaseResponse<refreshTokenResponse>>(`${process.env.EXPO_PUBLIC_BASE_URL}/Auth/Refresh`, payload, {
          timeout: 60000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        const data = response.data?.data;
        const newAccessToken = data?.token?.accessToken;
        const newRefreshToken = data?.token?.refreshToken;
        const user = data?.user;

        if (!newAccessToken || !newRefreshToken || !user) {
          throw new Error("Invalid refresh response");
        }

        await setAuthenticatedSession({
          user,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        });

        return newAccessToken;
      } catch (error) {
        // Fail-closed: after any refresh failure, block subsequent refresh attempts
        // until the user gets a fresh authenticated session.
        refreshBlocked = true;
        if (!isInvalidRefreshError(error)) {
          console.log("Refresh failed; blocking further refresh attempts for this session.");
        }
        await clearSessionOnce();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

export const restoreSession = async () => {
  if (restorePromise) return restorePromise;

  // If bootstrap already ran and session is blocked, avoid re-running refresh on remounts.
  if (restoreAttempted && refreshBlocked) return;

  restoreAttempted = true;

  restorePromise = (async () => {
    const storedRefreshToken = await getRefreshToken();
    if (!storedRefreshToken) {
      refreshBlocked = true;
      const state = useAuthStore.getState();
      if (state.user !== null || state.accessToken !== null) {
        useAuthStore.setState({ accessToken: null, user: null });
      }
      return;
    }

    await refreshAccessToken();
  })().finally(() => {
    restorePromise = null;
  });

  return restorePromise;
};

export const clearSession = async () => {
  refreshBlocked = false;
  restoreAttempted = false;
  refreshPromise = null;
  await clearSessionOnce();
};
