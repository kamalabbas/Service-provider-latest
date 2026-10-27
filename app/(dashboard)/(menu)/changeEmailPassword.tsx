import { FormInput } from "@/components/form/FormInput";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spacing } from "@/constants/Theme";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { newPasswordSchema } from "@/utility/passwordPolicy";
import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as yup from "yup";

type ActiveTab = "email" | "password";

const TABS = [
  { label: "Email", value: "email" },
  { label: "Password", value: "password" },
] as const;

type EmailFormValues = {
  email: string;
};

type OtpFormValues = {
  otp: string;
};

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emailSchema = yup.object({
  email: yup.string().email("Invalid email").required("Email is required"),
});

const otpSchema = yup.object({
  otp: yup.string().required("PIN is required"),
});

const passwordSchema = yup
  .object({
    currentPassword: yup.string().required("Current password is required"),
    newPassword: newPasswordSchema("New password is required"),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref("newPassword")], "Passwords must match")
      .required("Confirm password is required"),
  })
  .required();

export default function ChangeEmailPasswordScreen() {
  const backgroundColor = useThemeColor({}, "muted");

  const { changeEmailMutation, verifyNewEmailMutation, changePasswordMutation } = useAuth();
  const showToast = useToastStore((s) => s.showToast);

  const [activeTab, setActiveTab] = useState<ActiveTab>("email");
  const [otpSent, setOtpSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const user = useAuthStore((s) => s.user);
  const userId = Number(user?.id ?? 0);
  const hasUserId = Number.isFinite(userId) && userId > 0;

  const {
    control: emailControl,
    handleSubmit: handleSendOtp,
    reset: resetEmailForm,
    formState: { errors: emailErrors },
  } = useForm<EmailFormValues>({
    resolver: yupResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const {
    control: otpControl,
    handleSubmit: handleVerifyOtp,
    reset: resetOtpForm,
    formState: { errors: otpErrors },
  } = useForm<OtpFormValues>({
    resolver: yupResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const {
    control: passwordControl,
    handleSubmit: handleChangePassword,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: yupResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSendOtp = (data: EmailFormValues) => {
    if (!hasUserId) {
      showToast("Unable to change email: missing user.", "error");
      return;
    }

    const newEmail = data.email.trim();
    if (!newEmail) {
      showToast("Email is required.", "error");
      return;
    }

    setPendingEmail(newEmail);
    changeEmailMutation.mutate(
      { userId, newEmail },
      {
        onSuccess: () => {
          setOtpSent(true);
        },
      },
    );
  };

  const onVerifyOtp = async (data: OtpFormValues) => {
    if (!hasUserId) {
      showToast("Unable to verify email: missing user.", "error");
      return;
    }

    const otp = data.otp.trim();
    if (!otp) {
      showToast("PIN is required.", "error");
      return;
    }

    // const refreshToken = await getRefreshToken();
    // if (!refreshToken) {
    //   showToast("Unable to verify email: missing refresh token.", "error");
    //   return;
    // }

    verifyNewEmailMutation.mutate(
      { userId, otp },
      {
        onSuccess: () => {
          setOtpSent(false);
          setPendingEmail("");
          resetEmailForm();
          resetOtpForm();
        },
      },
    );
  };

  const onChangePassword = (data: PasswordFormValues) => {
    const currentPassword = data.currentPassword.trim();
    const newPassword = data.newPassword.trim();
    const confirmPassword = data.confirmPassword.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Please fill all password fields.", "error");
      return;
    }

    changePasswordMutation.mutate(
      {
        currentPassword,
        newPassword,
        confirmPassword,
      },
      {
        onSuccess: () => {
          resetPasswordForm();
        },
      },
    );
  };

  return (
    <ThemedView style={{ flex: 1, backgroundColor }}>
      <SegmentedControl
        style={styles.tabsContainer}
        options={TABS}
        value={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          if (tab === "password") {
            setOtpSent(false);
            setPendingEmail("");
            resetOtpForm();
          }
        }}
      />

      {activeTab === "email" && (
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          enableOnAndroid={true}
          enableAutomaticScroll
          enableResetScrollToCoords={false}
        >
          <ThemedView style={[styles.container, { backgroundColor }]}>
            <ThemedText type="subtitle" style={styles.title}>
              Change Email
            </ThemedText>
            <ThemedText type="callout" tone="muted" style={styles.description}>Enter your new email address and request a PIN to verify it.</ThemedText>

            <Controller
              control={emailControl}
              name="email"
              render={({ field }) => (
                <FormInput
                  label="New email"
                  leftIcon="mail-outline"
                  placeholder="example@mail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={emailErrors.email?.message as string | undefined}
                />
              )}
            />

            <PrimaryButton
              title={changeEmailMutation.isPending ? "Sending PIN..." : "Send PIN"}
              onPress={handleSendOtp(onSendOtp)}
              disabled={!hasUserId || changeEmailMutation.isPending}
              loading={changeEmailMutation.isPending}
              style={{ marginTop: 12 }}
            />

            {otpSent && (
              <View style={{ marginTop: 20 }}>
                <ThemedText type="callout" tone="muted" style={styles.description}>Enter the PIN sent to {pendingEmail}</ThemedText>
                <Controller
                  control={otpControl}
                  name="otp"
                  render={({ field }) => (
                    <FormInput
                      label="Verification code"
                      leftIcon="keypad-outline"
                      placeholder="Enter PIN"
                      keyboardType="numeric"
                      value={field.value}
                      onChangeText={field.onChange}
                      error={otpErrors.otp?.message as string | undefined}
                    />
                  )}
                />

                <PrimaryButton
                  title={verifyNewEmailMutation.isPending ? "Verifying..." : "Verify & Update"}
                  onPress={handleVerifyOtp(onVerifyOtp)}
                  disabled={!hasUserId || verifyNewEmailMutation.isPending}
                  loading={verifyNewEmailMutation.isPending}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </ThemedView>
        </KeyboardAwareScrollView>
      )}

      {activeTab === "password" && (
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          enableOnAndroid={true}
          enableAutomaticScroll
          enableResetScrollToCoords={false}
        >
          <ThemedView style={[styles.container, { backgroundColor }]}>
            <ThemedText type="subtitle" style={styles.title}>
              Change Password
            </ThemedText>
            <ThemedText type="callout" tone="muted" style={styles.description}>Enter your current password and set a new one.</ThemedText>

            <Controller
              control={passwordControl}
              name="currentPassword"
              render={({ field }) => (
                <FormInput
                  label="Current password"
                  leftIcon="lock-closed-outline"
                  showPasswordRule={false}
                  placeholder="Enter current password"
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  error={passwordErrors.currentPassword?.message as string | undefined}
                />
              )}
            />

            <Controller
              control={passwordControl}
              name="newPassword"
              render={({ field }) => (
                <FormInput
                  label="New password"
                  leftIcon="lock-closed-outline"
                  placeholder="Enter new password"
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  error={passwordErrors.newPassword?.message as string | undefined}
                />
              )}
            />

            <Controller
              control={passwordControl}
              name="confirmPassword"
              render={({ field }) => (
                <FormInput
                  label="Confirm new password"
                  leftIcon="lock-closed-outline"
                  showPasswordRule={false}
                  placeholder="Re-enter new password"
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  error={passwordErrors.confirmPassword?.message as string | undefined}
                />
              )}
            />

            <PrimaryButton
              title={changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              onPress={handleChangePassword(onChangePassword)}
              disabled={changePasswordMutation.isPending}
              loading={changePasswordMutation.isPending}
              style={{ marginTop: 12 }}
            />
          </ThemedView>
        </KeyboardAwareScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    flex: 1,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  description: {
    marginBottom: Spacing.xl,
  },
  tabsContainer: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
});
