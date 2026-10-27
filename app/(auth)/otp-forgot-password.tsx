import { ThemedView } from "@/components/ThemedView";
import { OTPComponent } from "@/components/ui/OTPComponent";
import { useAuth } from "@/hooks/useAuth";
import { VerifyResetPasswordOtpRequest } from "@/interfaces/auth.interface";
import { sendForgotPasswordOtp } from "@/services/authService";
import { notifyApiError } from "@/services/api";
import { useToastStore } from "@/stores/toastStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet } from "react-native";

export default function OtpForgotPasswordScreen() {
  // router params
  const params = useLocalSearchParams();
  const email = (params as any)?.email;

  // Toast Store
  const { showToast } = useToastStore();

  // Auth helpers
  const auth = useAuth();
  const router = useRouter();

  // API Request Hook
  const { mutate: verifyResetOtp, isPending } = auth.verifyResetPasswordOtpMutation;

  // Submit handler
  const onSubmit = async (data: { otp: string }) => {
    // check if email is present in params or not if not redirect to login
    EmailCheck(email);

    const payload: VerifyResetPasswordOtpRequest = {
      email,
      otp: data.otp,
    };
    verifyResetOtp(payload);
  };

  // if there is no email in params, redirect to login
  function EmailCheck(email: string) {
    if (!email) {
      showToast("Something went wrong. Please login again.", "error");
      setTimeout(() => {
        router.replace("/(auth)");
      }, 2000);
      return;
    }
  }

  return (
    <ThemedView style={styles.container}>
      <OTPComponent
        isPending={isPending}
        email={email}
        onSubmit={onSubmit}
        reSendOtp={async () => {
          if (!email) {
            EmailCheck(email);
            return false;
          }
          try {
            const res = await sendForgotPasswordOtp({ email });
            res.message && showToast("A new code has been requested. Please check your email.", "success");
            return true;
          } catch (error) {
            notifyApiError(error, { action: "sendCode" });
            return false;
          }
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
  }
});
