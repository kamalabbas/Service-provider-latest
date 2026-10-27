import {
  ChangeEmailRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  RegisterRequest,
  VerifyEmailOtpResponse,
  VerifyNewEmailRequest,
} from "@/interfaces/auth.interface";
import { BaseResponse } from "@/interfaces/baseResponse.interface";
import {
  CheckPasswordRecoveryCodeRequest,
  MobileAuthResponseApiResponse,
  MobileSignOutRequest,
  ObjectApiResponse,
  PasswordRecoveryRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from "@/interfaces/serviceProviderAuth.interface";
import { queryClient } from "@/services/queryClient";
import { usePasswordRecoveryStore } from "@/stores/passwordRecoveryStore";
import { sessionUserFrom } from "@/utility/accessToken";
import { getInstallationId } from "@/utility/installationId";
import {
  changeEmail,
  changePassword,
  checkPasswordRecoveryCode,
  login,
  logout,
  register,
  requestPasswordRecovery,
  resetPassword,
  verifyEmail,
  verifyNewEmail,
} from "@/services/authService";
import { AuthenticationOperation, beginAuthenticationOperation, beginSessionLogout, clearSession, finishSessionLogout, getSessionGeneration, isCurrentAuthenticationOperation, setAuthenticatedSession } from "@/services/authSession";
import { notifyApiError } from "@/services/api";
import { ApiErrorAction, toAppError } from "@/services/apiError";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { MutateOptions, useMutation, UseMutationResult } from "@tanstack/react-query";
import { CanceledError, isCancel } from "axios";
import { useRouter } from "expo-router";

const authenticationRequests = new WeakMap<object, AuthenticationOperation>();

// Guide 02: identical for unknown, deactivated and undeliverable accounts.
export const RECOVERY_SENT_MESSAGE = "If this account can receive recovery email, a code has been sent.";

function assertCurrentOperation(operation?: AuthenticationOperation): asserts operation is AuthenticationOperation {
  if (!operation || !isCurrentAuthenticationOperation(operation)) {
    throw new CanceledError("Authentication operation was superseded.");
  }
}

// Capture identity at invocation, before React Query can pause/queue dispatch.
// Clone the request so reusing the same input object still creates distinct attempts.
function useAuthenticationMutation<TData, TRequest extends object>(options: {
  mutationFn: (request: TRequest, operation: AuthenticationOperation) => Promise<TData>;
  onSuccess?: (data: TData, request: TRequest, operation: AuthenticationOperation) => void | Promise<void>;
  onError?: (error: unknown, request: TRequest) => void;
}): UseMutationResult<TData, unknown, TRequest> {
  const mutation = useMutation<TData, unknown, TRequest>({
    mutationFn: (request) => {
      const operation = authenticationRequests.get(request);
      assertCurrentOperation(operation);
      return options.mutationFn(request, operation);
    },
    onSuccess: async (data, request) => {
      const operation = authenticationRequests.get(request);
      assertCurrentOperation(operation);
      await options.onSuccess?.(data, request, operation);
      assertCurrentOperation(operation);
    },
    onError: (error, request) => {
      const operation = authenticationRequests.get(request);
      if (operation && isCurrentAuthenticationOperation(operation)) options.onError?.(error, request);
    },
  });
  const prepare = (request: TRequest) => {
    const operation = beginAuthenticationOperation();
    const variables = { ...request };
    authenticationRequests.set(variables, operation);
    return { operation, variables };
  };
  const guardCallbacks = (callbacks: MutateOptions<TData, unknown, TRequest> | undefined, operation: AuthenticationOperation): typeof callbacks => callbacks && ({
    onSuccess: (...args) => { if (isCurrentAuthenticationOperation(operation)) callbacks.onSuccess?.(...args); },
    onError: (...args) => { if (isCurrentAuthenticationOperation(operation)) callbacks.onError?.(...args); },
    onSettled: (...args) => { if (isCurrentAuthenticationOperation(operation)) callbacks.onSettled?.(...args); },
  });
  return {
    ...mutation,
    mutate: (request, callbacks) => {
      const { operation, variables } = prepare(request);
      mutation.mutate(variables, guardCallbacks(callbacks, operation));
    },
    mutateAsync: async (request, callbacks) => {
      const { operation, variables } = prepare(request);
      const data = await mutation.mutateAsync(variables, guardCallbacks(callbacks, operation));
      assertCurrentOperation(operation);
      return data;
    },
  };
}

async function persistSession(params: Parameters<typeof setAuthenticatedSession>[0], action: ApiErrorAction, authentication: AuthenticationOperation) {
  assertCurrentOperation(authentication);
  const operation = setAuthenticatedSession(params, authentication);
  const generation = getSessionGeneration();
  try {
    const result = await operation;
    assertCurrentOperation(authentication);
    if (result === null) throw new CanceledError("Authentication operation was superseded.");
    return result;
  } catch (error) {
    // Persistence failures have no Axios config. Bind their presentation to the
    // generation that attempted the write, and keep the original rejection.
    notifyApiError(error, { action, generation, silent: !isCurrentAuthenticationOperation(authentication) });
    throw error;
  }
}

export function useAuth() {
  const showToast = useToastStore((s) => s.showToast);

  const router = useRouter();

  // Automatic push registration is deferred until backend ownership/transfer
  // and unregistration semantics are confirmed. The root acquires the device token.

  const openEmailVerification = (email: string) =>
    router.push({ pathname: "/(auth)/otp-register", params: { email } });

  // Login mutation
  const loginMutation = useAuthenticationMutation<MobileAuthResponseApiResponse, LoginRequest>({
    mutationFn: login,
    onError: (error, request) => {
      notifyApiError(error, { action: "signIn" });
      // A valid but unverified account receives 403 at sign-in (guides 00/01).
      if (toAppError(error).status === 403) openEmailVerification(request.email);
    },
    onSuccess: async (response, request, operation) => {
      try {
        const data = response.data;
        // Mobile sign-in returns tokens only; identity comes from the access token.
        const user = data ? sessionUserFrom(data, request.email) : null;
        if (!data?.refreshToken || !user) {
          showToast("Sign-in did not return a session. Please try again.", "error");
          return;
        }
        const generation = await persistSession({
          user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        }, "signIn", operation);
        if (generation !== getSessionGeneration()) return;
      } catch (error) {
        if (!isCancel(error)) console.warn("Failed to complete sign-in.");
        throw error;
      }
    },
  });

  // Register mutation. Registration does not sign in; verification comes next.
  const registerMutation = useAuthenticationMutation<ObjectApiResponse, RegisterRequest>({
    mutationFn: register,
    onError: (error, request) => {
      notifyApiError(error, { action: "register" });
      // The account may already exist when only email delivery failed: offer resend.
      const appError = toAppError(error);
      if (appError.status === 503 && appError.code === "EMAIL_DELIVERY_FAILED") openEmailVerification(request.email);
    },
    onSuccess: (_response, request) => openEmailVerification(request.email),
  });

  // Change Email mutation
  const changeEmailMutation = useAuthenticationMutation<BaseResponse<VerifyEmailOtpResponse>, ChangeEmailRequest>({
    mutationFn: changeEmail,
    onError: (error) => notifyApiError(error, { action: "changeEmail" }),
    onSuccess: () => {
      showToast("PIN sent to new email", "success");
    },
  });

  // Verify new email mutation
  const verifyNewEmailMutation = useAuthenticationMutation<BaseResponse<VerifyEmailOtpResponse>, VerifyNewEmailRequest>({
    mutationFn: verifyNewEmail,
    onError: (error) => notifyApiError(error, { action: "verifyCode" }),
    onSuccess: async (response, _request, operation) => {
      const token = response.data?.token;
      const current = useAuthStore.getState().user;
      const user = token?.accessToken
        ? sessionUserFrom({ accessToken: token.accessToken, profileCompletionRequired: current?.profileCompletionRequired ?? false })
        : null;
      if (token?.refreshToken && user) {
        const generation = await persistSession({
          user,
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
        }, "verifyCode", operation);
        if (generation !== getSessionGeneration()) return;
      }
      showToast("Email updated successfully", "success");
    },
  });

  // Registration email verification. It issues no tokens: sign in afterwards.
  const verifyEmailMutation = useAuthenticationMutation<ObjectApiResponse, VerifyEmailRequest>({
    mutationFn: verifyEmail,
    onError: (error) => notifyApiError(error, { action: "verifyCode" }),
    onSuccess: (_response, request) => {
      showToast("Email verified. Please sign in.", "success");
      router.replace({ pathname: "/(auth)", params: { email: request.email } });
    },
  });

  // Guide 02: request a recovery code. The response never reveals whether the
  // account exists, so the message is neutral. Email stays in transient state.
  const sendForgetPasswordMutation = useAuthenticationMutation<ObjectApiResponse, PasswordRecoveryRequest>({
    mutationFn: requestPasswordRecovery,
    onError: (error) => notifyApiError(error, { action: "sendCode" }),
    onSuccess: (_response, variables) => {
      usePasswordRecoveryStore.getState().setEmail(variables.email);
      showToast(RECOVERY_SENT_MESSAGE, "success");
      router.push("/(auth)/otp-forgot-password");
    },
  });

  // Optional precheck: it neither consumes the code nor returns a reset token.
  const verifyResetPasswordOtpMutation = useAuthenticationMutation<ObjectApiResponse, CheckPasswordRecoveryCodeRequest>({
    mutationFn: checkPasswordRecoveryCode,
    onError: (error) => notifyApiError(error, { action: "verifyCode" }),
    onSuccess: (_response, variables) => {
      usePasswordRecoveryStore.getState().setCode(variables.code);
      router.push("/(auth)/set-new-password");
    },
  });

  // Final reset with the same email and code. It does not sign in.
  const setNewPasswordMutation = useAuthenticationMutation<ObjectApiResponse, ResetPasswordRequest>({
    mutationFn: resetPassword,
    onError: (error) => {
      notifyApiError(error, { action: "resetPassword" });
      // A password-policy failure keeps the code usable; a rejected code
      // (invalid, expired or exhausted) sends the member back to code entry.
      const fieldKeys = Object.keys(toAppError(error).validationErrors ?? {}).map((key) => key.toLowerCase());
      if (fieldKeys.includes("code")) {
        usePasswordRecoveryStore.getState().setCode(null);
        router.replace("/(auth)/otp-forgot-password");
      }
    },
    onSuccess: (_response, _request, operation) => {
      // Reset revokes refresh sessions server-side; drop transient and cached private data.
      usePasswordRecoveryStore.getState().clear();
      queryClient.clear();
      showToast("Your password has been reset. Sign in with your new password.", "success");
      setTimeout(() => {
        if (isCurrentAuthenticationOperation(operation)) router.replace("/(auth)");
      }, 1000);
    },
  });

  // Change Password mutation
  const changePasswordMutation = useAuthenticationMutation<BaseResponse<ChangePasswordResponse>, ChangePasswordRequest>({
    mutationFn: changePassword,
    onError: (error) => notifyApiError(error, { action: "changePassword" }),
    onSuccess: () => {
      showToast("Password changed successfully", "success");
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: ({ generation, request, accessToken }: { generation: number; request: MobileSignOutRequest; accessToken: string | null }) => {
      // React Query may defer execution until after another account has signed in.
      if (generation !== getSessionGeneration()) return Promise.resolve(undefined);
      return logout(request, accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined);
    },
  });

  // Logout helper (decoupled)
  const logoutUser = async () => {
    const { generation, refreshToken, accessToken } = beginSessionLogout();
    let storedRefreshToken;
    let durableLogout = false;
    try {
      storedRefreshToken = await refreshToken;
    } catch {
      if (generation === getSessionGeneration()) {
        console.warn("Failed to read logout credentials; continuing local session cleanup.");
      }
    } finally {
      durableLogout = await clearSession(generation);
    }
    if (generation !== getSessionGeneration()) return;

    // Credentials are captured only for this server logout. Memory is already
    // signed out, and local cleanup does not wait for network availability.
    if (storedRefreshToken) {
      try {
        // Sign-out also unregisters this installation's push destination.
        // The installation ID itself is kept across sign-outs.
        const installationId = await getInstallationId();
        await logoutMutation.mutateAsync({
          generation, accessToken,
          request: { refreshToken: storedRefreshToken, installationId },
        });
      } catch {
        // A server error cannot restore access or establish confirmed revocation.
      } finally {
        finishSessionLogout(generation);
      }
    }
    return { generation, durableLogout };
  };

  const logoutAndGoToLogin = async () => {
    const result = await logoutUser();
    if (!result || result.generation !== getSessionGeneration()) return false;
    router.replace("/(auth)");
    return result.durableLogout;
  };

  return {
    loginMutation,
    registerMutation,
    changeEmailMutation,
    verifyNewEmailMutation,
    verifyEmailMutation,
    sendForgetPasswordMutation,
    verifyResetPasswordOtpMutation,
    setNewPasswordMutation,
    changePasswordMutation,
    logoutUser,
    logoutAndGoToLogin,
  };
}
