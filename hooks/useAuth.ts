import {
  ChangeEmailRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RegisterRequest,
  RegisterResponse,
  sendForgotPasswordOtpRequest,
  SendForgotPasswordOtpResponse,
  setNewPasswordRequest,
  setNewPasswordResponse,
  VerifyEmailOtpRequest,
  VerifyEmailOtpResponse,
  VerifyNewEmailRequest,
  VerifyResetPasswordOtpRequest,
  VerifyResetPasswordOtpResponse,
} from "@/interfaces/auth.interface";
import { BaseResponse } from "@/interfaces/baseResponse.interface";
import {
  changeEmail,
  changePassword,
  login,
  logout,
  register,
  sendForgotPasswordOtp,
  setNewPassword,
  verifyEmail,
  verifyNewEmail,
  verifyResetPasswordOtp,
} from "@/services/authService";
import { AuthenticationOperation, beginAuthenticationOperation, beginSessionLogout, clearSession, finishSessionLogout, getSessionGeneration, isCurrentAuthenticationOperation, setAuthenticatedSession } from "@/services/authSession";
import { notifyApiError } from "@/services/api";
import { ApiErrorAction } from "@/services/apiError";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { MutateOptions, useMutation, UseMutationResult } from "@tanstack/react-query";
import { CanceledError, isCancel } from "axios";
import { useRouter } from "expo-router";

const authenticationRequests = new WeakMap<object, AuthenticationOperation>();

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
  onError?: (error: unknown) => void;
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
      if (operation && isCurrentAuthenticationOperation(operation)) options.onError?.(error);
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

  const setUser = useAuthStore((s) => s.setUser);
  // Automatic push registration is deferred until backend ownership/transfer
  // and unregistration semantics are confirmed. The root acquires the device token.

  // Login mutation
  const loginMutation = useAuthenticationMutation<BaseResponse<LoginResponse>, LoginRequest>({
    mutationFn: login,
    onError: (error) => notifyApiError(error, { action: "signIn" }),
    onSuccess: async (response, _request, operation) => {
      try {
        if (response.data) {
          if (response.data.token?.accessToken && response.data.token?.refreshToken) {
            const generation = await persistSession({
              user: response.data.user,
              accessToken: response.data.token.accessToken,
              refreshToken: response.data.token.refreshToken,
            }, "signIn", operation);
            if (generation !== getSessionGeneration()) return;
          } else {
            setUser(response.data.user);
            if (response.data.user.statusCode === "PENDING_VERIFICATION") {
              router.replace("/(auth)/otp-register");
            } else {
              showToast("Sign-in did not return a session. Please try again.", "error");
            }
          }
        }
      } catch (error) {
        if (!isCancel(error)) console.warn("Failed to complete sign-in.");
        throw error;
      }
    },
  });

  // Register mutation
  const registerMutation = useAuthenticationMutation<BaseResponse<RegisterResponse>, RegisterRequest>({
    mutationFn: register,
    onError: (error) => notifyApiError(error, { action: "register" }),
    onSuccess: (response) => {
      if (response.data) {
        setUser(response.data.user);
        router.push("/(auth)/otp-register");
      }
    },
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
      if (response.data) {
        if (response.data.token?.accessToken && response.data.token?.refreshToken) {
          const generation = await persistSession({
            user: response.data.user,
            accessToken: response.data.token.accessToken,
            refreshToken: response.data.token.refreshToken,
          }, "verifyCode", operation);
          if (generation !== getSessionGeneration()) return;
        } else {
          setUser(response.data.user);
        }
      }
      showToast("Email updated successfully", "success");
    },
  });

  // Verify new email mutation
  const verifyEmailMutation = useAuthenticationMutation<BaseResponse<VerifyEmailOtpResponse>, VerifyEmailOtpRequest>({
    mutationFn: verifyEmail,
    onError: (error) => notifyApiError(error, { action: "verifyCode" }),
    onSuccess: async (response, _request, operation) => {
      if (response.data) {
        if (response.data.token?.accessToken && response.data.token?.refreshToken) {
          const generation = await persistSession({
            user: response.data.user,
            accessToken: response.data.token.accessToken,
            refreshToken: response.data.token.refreshToken,
          }, "verifyCode", operation);
          if (generation !== getSessionGeneration()) return;
        } else {
          setUser(response.data.user);
        }
      }
      showToast("Email updated successfully", "success");
    },
  });

  // Send Forget Password mutation
  const sendForgetPasswordMutation = useAuthenticationMutation<BaseResponse<SendForgotPasswordOtpResponse>, sendForgotPasswordOtpRequest>({
    mutationFn: sendForgotPasswordOtp,
    onError: (error) => notifyApiError(error, { action: "sendCode" }),
    onSuccess: (_response, variables) => {
      try {
        router.push({
          pathname: "/(auth)/otp-forgot-password",
          params: { email: variables.email },
        });
      } catch {
        console.warn("Password-reset navigation failed.");
      }
    },
  });

  // Verify Reset Password mutation
  const verifyResetPasswordOtpMutation = useAuthenticationMutation<BaseResponse<VerifyResetPasswordOtpResponse>, VerifyResetPasswordOtpRequest>({
    mutationFn: verifyResetPasswordOtp,
    onError: (error) => notifyApiError(error, { action: "verifyCode" }),
    onSuccess: (response) => {
      router.push({
        pathname: "/(auth)/set-new-password",
        params: { forgotPasswordToken: response.data?.forgotPasswordToken },
      });
    },
  });

  // Reset Password mutation
  const setNewPasswordMutation = useAuthenticationMutation<BaseResponse<setNewPasswordResponse>, setNewPasswordRequest>({
    mutationFn: setNewPassword,
    onError: (error) => notifyApiError(error, { action: "resetPassword" }),
    onSuccess: (_response, _request, operation) => {
      showToast("Password has been reset successfully. Please login.", "success");
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
    mutationFn: ({ generation, request, accessToken }: { generation: number; request: LogoutRequest; accessToken: string | null }) => {
      // React Query may defer execution until after another account has signed in.
      if (generation !== getSessionGeneration()) return Promise.resolve();
      return logout(request, accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined);
    },
  });

  // Logout helper (decoupled)
  const logoutUser = async () => {
    const pushNotificationToken = useAuthStore.getState().pushNotificationToken;
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
        await logoutMutation.mutateAsync({
          generation, accessToken,
          request: { refreshToken: storedRefreshToken, expoPushToken: pushNotificationToken ?? undefined },
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
