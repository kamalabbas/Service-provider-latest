import {
  ChangeEmailRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  LoginResponse,
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
import { clearSession, resetSessionRefreshGuard, setAuthenticatedSession } from "@/services/authSession";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { getRefreshToken } from "@/utility/secureStore";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useNotification } from "./useNotification";

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
    onSuccess: async (response) => {
      // console.log("Login successful:", response.data);

      try {
        if (response.data) {
          if (response.data.token?.accessToken && response.data.token?.refreshToken) {
            await setAuthenticatedSession({
              user: response.data.user,
              accessToken: response.data.token.accessToken,
              refreshToken: response.data.token.refreshToken,
            });
            resetSessionRefreshGuard();

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
        console.log("Error in login onSuccess:", error);
        console.log("second Login successful:", response.data);
      }
    },
  });

  // Register mutation
  const registerMutation = useMutation<BaseResponse<RegisterResponse>, unknown, RegisterRequest>({
    mutationFn: register,
    onSuccess: (response) => {
      console.log("Registration successful:", response);
      if (response.data) {
        setUser(response.data.user);
        router.push("/(auth)/otp-register");
      }
    },
  });

  // Change Email mutation
  const changeEmailMutation = useMutation<BaseResponse<VerifyEmailOtpResponse>, unknown, ChangeEmailRequest>({
    mutationFn: changeEmail,
    onSuccess: () => {
      showToast("PIN sent to new email", "success");
    },
  });

  // Verify new email mutation
  const verifyNewEmailMutation = useMutation<BaseResponse<VerifyEmailOtpResponse>, unknown, VerifyNewEmailRequest>({
    mutationFn: verifyNewEmail,
    onSuccess: async (response) => {
      showToast("Email updated successfully", "success");

      if (response.data) {
        if (response.data.token?.accessToken && response.data.token?.refreshToken) {
          await setAuthenticatedSession({
            user: response.data.user,
            accessToken: response.data.token.accessToken,
            refreshToken: response.data.token.refreshToken,
          });
          resetSessionRefreshGuard();
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
    },
  });

  // Verify new email mutation
  const verifyEmailMutation = useMutation<BaseResponse<VerifyEmailOtpResponse>, unknown, VerifyEmailOtpRequest>({
    mutationFn: verifyEmail,
    onSuccess: async (response) => {
      showToast("Email updated successfully", "success");

      if (response.data) {
        if (response.data.token?.accessToken && response.data.token?.refreshToken) {
          await setAuthenticatedSession({
            user: response.data.user,
            accessToken: response.data.token.accessToken,
            refreshToken: response.data.token.refreshToken,
          });
          resetSessionRefreshGuard();
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
    },
  });

  // Send Forget Password mutation
  const sendForgetPasswordMutation = useMutation<BaseResponse<SendForgotPasswordOtpResponse>, unknown, sendForgotPasswordOtpRequest>({
    mutationFn: sendForgotPasswordOtp,
    onSuccess: (response, variables) => {
      try {
        console.log("Forgot password email sent:", response);
        router.push({
          pathname: "/(auth)/otp-forgot-password",
          params: { email: variables.email },
        });
      } catch (err) {
        console.log("router push failed:", err);
      }
    },
  });

  // Verify Reset Password mutation
  const verifyResetPasswordOtpMutation = useMutation<BaseResponse<VerifyResetPasswordOtpResponse>, unknown, VerifyResetPasswordOtpRequest>({
    mutationFn: verifyResetPasswordOtp,
    onSuccess: (response) => {
      console.log("Reset password verification successful:", response);
      router.push({
        pathname: "/(auth)/set-new-password",
        params: { forgotPasswordToken: response.data?.forgotPasswordToken },
      });
    },
  });

  // Reset Password mutation
  const setNewPasswordMutation = useMutation<BaseResponse<setNewPasswordResponse>, unknown, setNewPasswordRequest>({
    mutationFn: setNewPassword,
    onSuccess: (response) => {
      console.log("Reset password successful:", response);

      showToast("Password has been reset successfully. Please login.", "success");
      setTimeout(() => {
        router.replace("/(auth)");
      }, 1000);
    },
  });

  // Change Password mutation
  const changePasswordMutation = useMutation<BaseResponse<ChangePasswordResponse>, unknown, ChangePasswordRequest>({
    mutationFn: changePassword,
    onSuccess: () => {
      showToast("Password changed successfully", "success");
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logout,
  });

  // Logout helper (decoupled)
  const logoutUser = async () => {
    const storedRefreshToken = await getRefreshToken();

    // Inform server if possible, but always clear local session regardless.
    if (storedRefreshToken) {
      try {
        await logoutMutation.mutateAsync({ refreshToken: storedRefreshToken, expoPushToken: pushNotificationToken ?? undefined });
      } catch {
        // Ignore server logout failures; local logout must still succeed.
      }
    }

    await clearSession();
  };

  const logoutAndGoToLogin = async () => {
    await logoutUser();
    router.replace("/(auth)");
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
