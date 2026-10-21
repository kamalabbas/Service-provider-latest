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
import { beginSessionLogout, clearSession, finishSessionLogout, getSessionGeneration, setAuthenticatedSession } from "@/services/authSession";
import { notifyApiError } from "@/services/api";
import { ApiErrorAction } from "@/services/apiError";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useNotification } from "./useNotification";

async function persistSession(params: Parameters<typeof setAuthenticatedSession>[0], action: ApiErrorAction) {
  const operation = setAuthenticatedSession(params);
  const generation = getSessionGeneration();
  try {
    return await operation;
  } catch (error) {
    // Persistence failures have no Axios config. Bind their presentation to the
    // generation that attempted the write, and keep the original rejection.
    notifyApiError(error, { action, generation });
    throw error;
  }
}

export function useAuth() {
  const showToast = useToastStore((s) => s.showToast);

  const router = useRouter();

  const setUser = useAuthStore((s) => s.setUser);
  const pushNotificationToken = useAuthStore((s) => s.pushNotificationToken);

  // register for push notifications
  const { mutate: registerForPushNotifications } = useNotification().registerNotification;

  // Login mutation
  const loginMutation = useMutation<BaseResponse<LoginResponse>, unknown, LoginRequest>({
    mutationFn: login,
    onError: (error) => notifyApiError(error, { action: "signIn" }),
    onSuccess: async (response) => {
      try {
        if (response.data) {
          if (response.data.token?.accessToken && response.data.token?.refreshToken) {
            const generation = await persistSession({
              user: response.data.user,
              accessToken: response.data.token.accessToken,
              refreshToken: response.data.token.refreshToken,
            }, "signIn");
            if (generation !== getSessionGeneration()) return;

            if (pushNotificationToken) {
              registerForPushNotifications({
                expoPushToken: pushNotificationToken,
                userId: response.data.user?.id,
              });
            }
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
        console.warn("Failed to complete sign-in.");
        throw error;
      }
    },
  });

  // Register mutation
  const registerMutation = useMutation<BaseResponse<RegisterResponse>, unknown, RegisterRequest>({
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
  const changeEmailMutation = useMutation<BaseResponse<VerifyEmailOtpResponse>, unknown, ChangeEmailRequest>({
    mutationFn: changeEmail,
    onError: (error) => notifyApiError(error, { action: "changeEmail" }),
    onSuccess: () => {
      showToast("PIN sent to new email", "success");
    },
  });

  // Verify new email mutation
  const verifyNewEmailMutation = useMutation<BaseResponse<VerifyEmailOtpResponse>, unknown, VerifyNewEmailRequest>({
    mutationFn: verifyNewEmail,
    onError: (error) => notifyApiError(error, { action: "verifyCode" }),
    onSuccess: async (response) => {
      if (response.data) {
        if (response.data.token?.accessToken && response.data.token?.refreshToken) {
          const generation = await persistSession({
            user: response.data.user,
            accessToken: response.data.token.accessToken,
            refreshToken: response.data.token.refreshToken,
          }, "verifyCode");
          if (generation !== getSessionGeneration()) return;
        } else {
          setUser(response.data.user);
        }

        if (pushNotificationToken) {
          registerForPushNotifications({
            expoPushToken: pushNotificationToken,
            userId: response.data.user?.id,
          });
        }
      }
      showToast("Email updated successfully", "success");
    },
  });

  // Verify new email mutation
  const verifyEmailMutation = useMutation<BaseResponse<VerifyEmailOtpResponse>, unknown, VerifyEmailOtpRequest>({
    mutationFn: verifyEmail,
    onError: (error) => notifyApiError(error, { action: "verifyCode" }),
    onSuccess: async (response) => {
      if (response.data) {
        if (response.data.token?.accessToken && response.data.token?.refreshToken) {
          const generation = await persistSession({
            user: response.data.user,
            accessToken: response.data.token.accessToken,
            refreshToken: response.data.token.refreshToken,
          }, "verifyCode");
          if (generation !== getSessionGeneration()) return;
        } else {
          setUser(response.data.user);
        }

        if (pushNotificationToken) {
          registerForPushNotifications({
            expoPushToken: pushNotificationToken,
            userId: response.data.user?.id,
          });
        }
      }
      showToast("Email updated successfully", "success");
    },
  });

  // Send Forget Password mutation
  const sendForgetPasswordMutation = useMutation<BaseResponse<SendForgotPasswordOtpResponse>, unknown, sendForgotPasswordOtpRequest>({
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
  const verifyResetPasswordOtpMutation = useMutation<BaseResponse<VerifyResetPasswordOtpResponse>, unknown, VerifyResetPasswordOtpRequest>({
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
  const setNewPasswordMutation = useMutation<BaseResponse<setNewPasswordResponse>, unknown, setNewPasswordRequest>({
    mutationFn: setNewPassword,
    onError: (error) => notifyApiError(error, { action: "resetPassword" }),
    onSuccess: () => {
      showToast("Password has been reset successfully. Please login.", "success");
      setTimeout(() => {
        router.replace("/(auth)");
      }, 1000);
    },
  });

  // Change Password mutation
  const changePasswordMutation = useMutation<BaseResponse<ChangePasswordResponse>, unknown, ChangePasswordRequest>({
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
