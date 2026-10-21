import { refreshTokenRequest, refreshTokenResponse } from "@/interfaces/auth.interface";
import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { User } from "@/interfaces/user.interface";
import { queryClient } from "@/services/queryClient";
import { useAuthStore } from "@/stores/authStore";
import { getRefreshToken, removeRefreshToken, setRefreshToken } from "@/utility/secureStore";
import axios, { AxiosError } from "axios";

let refreshPromise: Promise<string | null> | null = null;
let restorePromise: Promise<void> | null = null;
let refreshBlocked = false;
let restoreAttempted = false;
let sessionGeneration = 0;
let refreshTokenOperations: Promise<void> = Promise.resolve();

type AuthenticatedSession = { user: User; accessToken: string; refreshToken: string };

export const getSessionGeneration = () => sessionGeneration;

const advanceSession = () => {
  sessionGeneration += 1;
  refreshPromise = null;
  restorePromise = null;
  return sessionGeneration;
};

// Native storage calls cannot be cancelled. Keep later credentials/deletions last,
// and skip queued work whose session has already been replaced.
const runRefreshTokenOperation = <T>(generation: number, operation: () => Promise<T>): Promise<T | undefined> => {
  const result = refreshTokenOperations.then(() => {
    if (generation !== sessionGeneration) return;
    return operation();
  });
  refreshTokenOperations = result.then(() => undefined, () => undefined);
  return result;
};

const isInvalidRefreshError = (error: unknown): boolean => {
  const axiosError = error as AxiosError<{ status?: number; title?: string; detail?: string }>;
  const status = axiosError.response?.status ?? axiosError.response?.data?.status;
  const title = axiosError.response?.data?.title ?? "";
  const detail = axiosError.response?.data?.detail ?? "";
  return (status === 400 || status === 401) && `${title} ${detail}`.includes("INVALID_REFRESH_TOKEN");
};

const clearSessionOnce = async (generation: number) => {
  if (generation !== sessionGeneration) return;
  // clear() cancels query retryers/signals and removes query and mutation records.
  // Do this synchronously, before storage awaits can let another session begin.
  queryClient.clear();
  await runRefreshTokenOperation(generation, removeRefreshToken);
  if (generation !== sessionGeneration) return;

  const state = useAuthStore.getState();
  if (state.user !== null || state.accessToken !== null) {
    state.clearAuth();
  }
};

const applyAuthenticatedSession = async (params: AuthenticatedSession, generation: number): Promise<boolean> => {
  if (generation !== sessionGeneration) return false;

  refreshBlocked = false;
  restoreAttempted = true;
  useAuthStore.setState({ user: params.user, accessToken: params.accessToken });
  await runRefreshTokenOperation(generation, () => setRefreshToken(params.refreshToken));
  return generation === sessionGeneration;
};

export const setAuthenticatedSession = async (params: AuthenticatedSession): Promise<number | null> => {
  const generation = advanceSession();
  const applied = await applyAuthenticatedSession(params, generation);
  return applied && generation === sessionGeneration ? generation : null;
};

// Invalidate refresh/restore immediately, before logout reads storage or calls the server.
export const beginSessionLogout = () => {
  const generation = advanceSession();
  refreshBlocked = true;
  restoreAttempted = true;
  queryClient.clear();
  return { generation, refreshToken: runRefreshTokenOperation(generation, getRefreshToken) };
};

export const isRefreshBlocked = () => refreshBlocked;

export const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshBlocked) return null;

  if (!refreshPromise) {
    const generation = sessionGeneration;
    const operation = (async () => {
      try {
        const refreshTok = await runRefreshTokenOperation(generation, getRefreshToken);
        if (generation !== sessionGeneration) return null;

        if (!refreshTok) {
          refreshBlocked = true;
          await clearSessionOnce(generation);
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
        if (generation !== sessionGeneration) return null;

        const data = response.data?.data;
        const newAccessToken = data?.token?.accessToken;
        const newRefreshToken = data?.token?.refreshToken;
        const user = data?.user;

        if (!newAccessToken || !newRefreshToken || !user) {
          throw new Error("Invalid refresh response");
        }

        const applied = await applyAuthenticatedSession({
          user,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        }, generation);

        return applied && generation === sessionGeneration ? newAccessToken : null;
      } catch (error) {
        if (generation !== sessionGeneration) return null;

        // Fail-closed: after any refresh failure, block subsequent refresh attempts
        // until the user gets a fresh authenticated session.
        refreshBlocked = true;
        if (!isInvalidRefreshError(error)) {
          console.log("Refresh failed; blocking further refresh attempts for this session.");
        }
        await clearSessionOnce(generation);
        return null;
      }
    })().finally(() => {
      if (refreshPromise === operation) refreshPromise = null;
    });
    refreshPromise = operation;
  }

  return refreshPromise;
};

export const restoreSession = async () => {
  if (restorePromise) return restorePromise;

  // If bootstrap already ran and session is blocked, avoid re-running refresh on remounts.
  if (restoreAttempted && refreshBlocked) return;

  restoreAttempted = true;

  const generation = sessionGeneration;
  const operation = (async () => {
    const storedRefreshToken = await runRefreshTokenOperation(generation, getRefreshToken);
    if (generation !== sessionGeneration) return;

    if (!storedRefreshToken) {
      refreshBlocked = true;
      queryClient.clear();
      const state = useAuthStore.getState();
      if (state.user !== null || state.accessToken !== null) {
        useAuthStore.setState({ accessToken: null, user: null });
      }
      return;
    }

    await refreshAccessToken();
  })().finally(() => {
    if (restorePromise === operation) restorePromise = null;
  });
  restorePromise = operation;

  return restorePromise;
};

export const clearSession = async (generation = advanceSession()) => {
  if (generation !== sessionGeneration) return;

  refreshBlocked = false;
  restoreAttempted = false;
  await clearSessionOnce(generation);
};
