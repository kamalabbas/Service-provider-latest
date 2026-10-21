import { refreshTokenRequest, refreshTokenResponse } from "@/interfaces/auth.interface";
import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { User } from "@/interfaces/user.interface";
import { queryClient } from "@/services/queryClient";
import { useAuthStore } from "@/stores/authStore";
import { getRefreshToken, removeRefreshToken, setRefreshToken } from "@/utility/secureStore";
import { readRestorePolicy, writeRestorePolicy } from "@/utility/restorePolicy";
import axios from "axios";

let refreshPromise: Promise<string | null> | null = null;
let restorePromise: Promise<void> | null = null;
let refreshBlocked = false;
let restoreAttempted = false;
let sessionGeneration = 0;
let refreshTokenOperations: Promise<void> = Promise.resolve();
let pendingTokenDeletionGeneration: number | null = null;
let tokenDeletionPromise: Promise<boolean> | null = null;
let blockedPolicyPromise: Promise<boolean> | null = null;

type AuthenticatedSession = { user: User; accessToken: string; refreshToken: string };

export const getSessionGeneration = () => sessionGeneration;

const advanceSession = () => {
  sessionGeneration += 1;
  refreshPromise = null;
  restorePromise = null;
  pendingTokenDeletionGeneration = null;
  tokenDeletionPromise = null;
  blockedPolicyPromise = null;
  return sessionGeneration;
};

// Serialize policy and credential operations together. Native calls cannot be
// cancelled; newer-session writes run last and stale queued work is skipped.
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

const persistBlockedPolicy = (generation: number): Promise<boolean> => {
  if (generation !== sessionGeneration) return Promise.resolve(false);
  if (!blockedPolicyPromise) {
    blockedPolicyPromise = runRefreshTokenOperation(generation, () => writeRestorePolicy("blocked"))
      .then(() => generation === sessionGeneration, () => {
        if (generation === sessionGeneration) console.warn("Could not persist the logout block; credential deletion will still be attempted.");
        return false;
      });
  }
  return blockedPolicyPromise;
};

const clearSessionOnce = (generation: number): Promise<boolean> => {
  if (generation !== sessionGeneration || pendingTokenDeletionGeneration !== generation) return Promise.resolve(false);
  if (tokenDeletionPromise) return tokenDeletionPromise;

  const policyOperation = persistBlockedPolicy(generation);
  const operation = (async () => {
    const policyBlocked = await policyOperation;
    if (generation !== sessionGeneration) return false;
    const credentialsDeleted = await runRefreshTokenOperation(generation, async () => {
      try { await removeRefreshToken(); } catch { /* Verify absence even if deletion rejected. */ }
      if (generation !== sessionGeneration) return false;
      try { return await getRefreshToken() === null; } catch { return false; }
    });
    if (generation !== sessionGeneration) return false;

    clearInMemorySession(generation);
    if (generation !== sessionGeneration) return false;
    if (credentialsDeleted) pendingTokenDeletionGeneration = null;
    const durableLogout = policyBlocked || credentialsDeleted === true;
    if (!durableLogout) {
      console.warn("Durable logout is incomplete: neither a persistent block nor credential removal could be confirmed.");
    } else if (!credentialsDeleted) {
      console.warn("Logout is persistently blocked; saved credential removal remains unconfirmed.");
    }
    // Explicit logout stays blocked until a new explicit login, even after cleanup.
    return durableLogout;
  })().finally(() => {
    if (tokenDeletionPromise === operation) tokenDeletionPromise = null;
    if (blockedPolicyPromise === policyOperation) blockedPolicyPromise = null;
  });
  tokenDeletionPromise = operation;
  return operation;
};

const applyAuthenticatedSession = async (params: AuthenticatedSession, generation: number, explicitLogin = false): Promise<boolean> => {
  if (generation !== sessionGeneration) return false;

  // Do not expose credentials that have not been confirmed persisted.
  await runRefreshTokenOperation(generation, async () => {
    if (explicitLogin) await writeRestorePolicy("blocked");
    if (generation !== sessionGeneration) return;
    await setRefreshToken(params.refreshToken);
    if (generation !== sessionGeneration) return;
    if (explicitLogin) {
      try {
        await writeRestorePolicy("allowed");
      } catch (error) {
        // A rejected write may have changed the file. Re-establish denial before
        // reporting failure; never let rollback touch a superseding session.
        if (generation === sessionGeneration) {
          try { await writeRestorePolicy("blocked"); } catch {
            console.warn("Failed sign-in restore-policy rollback; persistent state remains unconfirmed.");
          }
        }
        throw error;
      }
    }
  });
  if (generation !== sessionGeneration) return false;

  refreshBlocked = false;
  restoreAttempted = true;
  useAuthStore.setState({ user: params.user, accessToken: params.accessToken });
  return generation === sessionGeneration;
};

export const setAuthenticatedSession = async (params: AuthenticatedSession): Promise<number | null> => {
  const generation = advanceSession();
  // A failed account switch must not fall back to the previous saved account.
  refreshBlocked = true;
  restoreAttempted = true;
  clearInMemorySession(generation);

  try {
    const applied = await applyAuthenticatedSession(params, generation, true);
    return applied && generation === sessionGeneration ? generation : null;
  } catch (error) {
    if (generation !== sessionGeneration) return null;
    clearInMemorySession(generation);
    throw error;
  }
};

// Invalidate refresh/restore immediately, before logout reads storage or calls the server.
export const beginSessionLogout = () => {
  const accessToken = useAuthStore.getState().accessToken;
  const generation = advanceSession();
  refreshBlocked = true;
  restoreAttempted = true;
  clearInMemorySession(generation);
  const policyOperation = persistBlockedPolicy(generation);
  return {
    generation, accessToken,
    refreshToken: policyOperation.then(() => runRefreshTokenOperation(generation, getRefreshToken)),
  };
};

export const isRefreshBlocked = () => refreshBlocked;

// Remove the server-logout mutation and any queries started during its wait.
export const finishSessionLogout = (generation: number) => clearInMemorySession(generation);

export const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshBlocked) {
    // An existing restore/refresh trigger may retry cleanup, never the old token.
    if (pendingTokenDeletionGeneration === sessionGeneration) await clearSessionOnce(sessionGeneration);
    return null;
  }

  if (!refreshPromise) {
    const generation = sessionGeneration;
    const operation = (async () => {
      try {
        const policy = await runRefreshTokenOperation(generation, readRestorePolicy);
        if (generation !== sessionGeneration) return null;
        if (policy !== "allowed") {
          invalidateRefreshSession(generation);
          return null;
        }
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

  // Pending logout deletion may be retried, but login/logout still block auth.
  if (restoreAttempted && refreshBlocked && pendingTokenDeletionGeneration !== sessionGeneration) return;

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

// true confirms local durable protection (blocked policy OR verified token
// absence). false reports an incomplete or superseded logout, never auth success.
export const clearSession = async (generation = advanceSession()): Promise<boolean> => {
  if (generation !== sessionGeneration) return false;

  refreshBlocked = true;
  restoreAttempted = true;
  pendingTokenDeletionGeneration = generation;
  // Sign out even if native deletion rejects or remains pending.
  clearInMemorySession(generation);
  return clearSessionOnce(generation);
};
