import { ThemedText } from "@/components/ThemedText";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { OTPComponent } from "@/components/ui/OTPComponent";
import { RECOVERY_SENT_MESSAGE, useAuth } from "@/hooks/useAuth";
import { CheckPasswordRecoveryCodeRequest } from "@/interfaces/serviceProviderAuth.interface";
import { requestPasswordRecovery } from "@/services/authService";
import { notifyApiError } from "@/services/api";
import { usePasswordRecoveryStore } from "@/stores/passwordRecoveryStore";
import { useToastStore } from "@/stores/toastStore";
import { useRouter } from "expo-router";

export default function OtpForgotPasswordScreen() {
  // Guide 02: the email lives in transient state, never in the route.
  const email = usePasswordRecoveryStore.getState().email ?? "";

  // Toast Store
  const { showToast } = useToastStore();

  // Auth helpers
  const auth = useAuth();
  const router = useRouter();

  // API Request Hook
  const { mutate: checkCode, isPending } = auth.verifyResetPasswordOtpMutation;

  // Submit handler
  const onSubmit = async (data: { otp: string }) => {
    if (!EmailCheck(email)) return;

    // Six-digit string code; leading zeroes are preserved.
    const payload: CheckPasswordRecoveryCodeRequest = {
      email,
      code: data.otp,
    };
    checkCode(payload);
  };

  // Without the email (e.g. after an app restart) the member starts recovery again.
  function EmailCheck(email: string) {
    if (!email) {
      showToast("Enter your email again to request a new code.", "error");
      router.replace("/(auth)/forgot-password");
      return false;
    }
    return true;
  }

  return (
    <AuthLayout
      hasHeader
      title="Enter reset code"
      subtitle={
        <ThemedText type="callout" tone="muted" style={{ marginTop: 8 }}>
          If <ThemedText type="callout" style={{ fontWeight: "600" }}>{email || "your email"}</ThemedText> can receive recovery email, we sent it a 6-digit code. It expires in 10 minutes.
        </ThemedText>
      }
      footer={<BackToLogin messageText="Remembered it?" LinkText="Back to sign in" onPress={() => router.replace("/(auth)")} />}
    >
      <OTPComponent
        isPending={isPending}
        email={email}
        submitLabel="Continue"
        onSubmit={onSubmit}
        reSendOtp={async () => {
          if (!EmailCheck(email)) return false;
          try {
            // A new code replaces the old one after the server's one-minute cooldown.
            await requestPasswordRecovery({ email });
            usePasswordRecoveryStore.getState().setEmail(email);
            showToast(RECOVERY_SENT_MESSAGE, "success");
            return true;
          } catch (error) {
            notifyApiError(error, { action: "sendCode" });
            return false;
          }
        }}
      />
    </AuthLayout>
  );
}
