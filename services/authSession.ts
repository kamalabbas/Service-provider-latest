import { refreshTokenRequest, refreshTokenResponse } from "@/interfaces/auth.interface";
import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { User } from "@/interfaces/user.interface";
import { queryClient } from "@/services/queryClient";
import { useAuthStore } from "@/stores/authStore";
import { getRefreshToken, removeRefreshToken, setRefreshToken } from "@/utility/secureStore";
import axios from "axios";

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

const clearInMemorySession = (generation: number) => {
  if (generation !== sessionGeneration) return;
  queryClient.clear();
  if (generation !== sessionGeneration) return;

  const state = useAuthStore.getState();
  if (state.user !== null || state.accessToken !== null) {
    state.clearAuth();
  }
};

const invalidateRefreshSession = (generation: number) => {
  if (generation !== sessionGeneration) return;

  // Retire requests from before the failure before cleanup can notify subscribers.
  // Recovery belongs to the new generation and may still use the saved refresh token.
  const recoveryGeneration = advanceSession();
  refreshBlocked = false;
  clearInMemorySession(recoveryGeneration);
};

const clearSessionOnce = async (generation: number) => {
  if (generation !== sessionGeneration) return;
  // clear() cancels query retryers/signals and removes query and mutation records.
  // Do this synchronously, before storage awaits can let another session begin.
  queryClient.clear();
  await runRefreshTokenOperation(generation, removeRefreshToken);
  clearInMemorySession(generation);
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
          invalidateRefreshSession(generation);
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

        if (response.data?.success === false || typeof newAccessToken !== "string" || !newAccessToken || typeof newRefreshToken !== "string" || !newRefreshToken || !user) {
          throw new Error("Invalid refresh response");
        }

        const applied = await applyAuthenticatedSession({
          user,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        }, generation);

        return applied && generation === sessionGeneration ? newAccessToken : null;
      } catch {
        if (generation !== sessionGeneration) return null;

        // Terminal invalid/revoked-token detection awaits backend contract confirmation.
        // All refresh errors are recoverable for now; never delete the saved token here.
        invalidateRefreshSession(generation);
        console.log("Session refresh failed; persisted credentials retained for a later retry.");
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

  // Do not restore a session while logout is in progress.
  if (restoreAttempted && refreshBlocked) return;

  restoreAttempted = true;

  const operation = (async () => {
    // Use the coordinated error handling for storage reads as well as the network call.
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
