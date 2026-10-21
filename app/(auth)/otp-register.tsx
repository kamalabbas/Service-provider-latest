import { ThemedView } from "@/components/ThemedView";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { OTPComponent } from "@/components/ui/OTPComponent";
import { useAuth } from "@/hooks/useAuth";
import { VerifyEmailOtpRequest } from "@/interfaces/auth.interface";
import { sendEmailOtp } from "@/services/authService";
import { notifyApiError } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

export default function OtpRegisterScreen() {
  // Auth Store Fields
  const email = useAuthStore((s) => s.user?.email)!;

  // Toast Store
  const { showToast } = useToastStore();

  // Router hook
  const router = useRouter();

  // API Request Hook
  const { mutate: verifyEmail, isPending } = useAuth().verifyEmailMutation;

  // Submit handler
  const onSubmit = async (data: { otp: string }) => {
    // check if email is present in params or not if not redirect to login
    EmailCheck(email);

    const payload: VerifyEmailOtpRequest = {
      email,
      otp: data.otp,
    };

    verifyEmail(payload);
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
            return;
          }
          try {
            const res = await sendEmailOtp({ email });
            res.message && showToast("A new code has been requested. Please check your email.", "success");
          } catch (error) {
            notifyApiError(error, { action: "sendCode" });
          }
        }}
      />
      <BackToLogin LinkText="Return to Login" onPress={() => router.replace("/(auth)")} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
});
