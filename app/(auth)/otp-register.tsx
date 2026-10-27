import { ThemedView } from "@/components/ThemedView";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { OTPComponent } from "@/components/ui/OTPComponent";
import { useAuth } from "@/hooks/useAuth";
import { VerifyEmailRequest } from "@/interfaces/serviceProviderAuth.interface";
import { resendVerification } from "@/services/authService";
import { notifyApiError } from "@/services/api";
import { useToastStore } from "@/stores/toastStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet } from "react-native";

export default function OtpRegisterScreen() {
  // Registration and unverified sign-in pass the original email.
  const { email = "" } = useLocalSearchParams<{ email?: string }>();

  // Toast Store
  const { showToast } = useToastStore();

  // Router hook
  const router = useRouter();

  // API Request Hook
  const { mutate: verifyEmail, isPending } = useAuth().verifyEmailMutation;

  // Submit handler
  const onSubmit = async (data: { otp: string }) => {
    if (!EmailCheck(email)) return;

    // Six-digit string code; leading zeroes are preserved.
    const payload: VerifyEmailRequest = {
      email,
      code: data.otp,
    };

    verifyEmail(payload);
  };

  // Without the original email there is nothing to verify; return to sign-in.
  function EmailCheck(email: string) {
    if (!email) {
      showToast("Something went wrong. Please login again.", "error");
      setTimeout(() => {
        router.replace("/(auth)");
      }, 2000);
      return false;
    }
    return true;
  }

  return (
    <ThemedView style={styles.container}>
      <OTPComponent
        isPending={isPending}
        email={email}
        onSubmit={onSubmit}
        reSendOtp={async () => {
          if (!EmailCheck(email)) return false;
          try {
            await resendVerification({ email });
            // Unknown and already-verified accounts receive the same response.
            showToast("If this email needs verification, a new code has been sent.", "success");
            return true;
          } catch (error) {
            notifyApiError(error, { action: "sendCode" });
            return false;
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
