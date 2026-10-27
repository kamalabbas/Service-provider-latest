import { FormInput } from "@/components/form/FormInput";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as yup from "yup";

type ActiveTab = "email" | "password";

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
    newPassword: yup.string().min(8, "Password must be at least 8 characters").required("New password is required"),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref("newPassword")], "Passwords must match")
      .required("Confirm password is required"),
  })
  .required();

export default function ChangeEmailPasswordScreen() {
  const backgroundColor = useThemeColor({}, "muted");
  const textColor = useThemeColor({}, "text");
  const tabBg = useThemeColor({}, "primaryLight");
  const tabActiveBg = useThemeColor({}, "primary");
  const tabActiveText = useThemeColor({}, "buttonText");

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
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: activeTab === "email" ? tabActiveBg : tabBg }]}
          onPress={() => setActiveTab("email")}
        >
          <ThemedText style={[styles.tabText, activeTab === "email" && [styles.tabTextActive, { color: tabActiveText }]]}>Change Email</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: activeTab === "password" ? tabActiveBg : tabBg }]}
          onPress={() => {
            setActiveTab("password");
            setOtpSent(false);
            setPendingEmail("");
            resetOtpForm();
          }}
        >
          <ThemedText style={[styles.tabText, activeTab === "password" && [styles.tabTextActive, { color: tabActiveText }]]}>Change Password</ThemedText>
        </TouchableOpacity>
      </View>

      {activeTab === "email" && (
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          enableOnAndroid={true}
          enableAutomaticScroll
          enableResetScrollToCoords={false}
        >
          <ThemedView style={[styles.container, { backgroundColor }]}>
            <ThemedText type="title" style={styles.title}>
              Change Email
            </ThemedText>
            <ThemedText style={[styles.description, { color: textColor }]}>Enter your new email address and request a PIN to verify it.</ThemedText>

            <Controller
              control={emailControl}
              name="email"
              render={({ field }) => (
                <FormInput
                  label="New Email"
                  labelStyle={{ backgroundColor }}
                  placeholder="example@mail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={field.value}
                  onChangeText={field.onChange}
                  style={{ backgroundColor }}
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
                <ThemedText style={[styles.description, { color: textColor }]}>Enter the PIN sent to {pendingEmail}</ThemedText>
                <Controller
                  control={otpControl}
                  name="otp"
                  render={({ field }) => (
                    <FormInput
                      label="PIN"
                      labelStyle={{ backgroundColor }}
                      placeholder="Enter PIN"
                      keyboardType="numeric"
                      value={field.value}
                      onChangeText={field.onChange}
                      style={{ backgroundColor }}
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
            <ThemedText type="title" style={styles.title}>
              Change Password
            </ThemedText>
            <ThemedText style={[styles.description, { color: textColor }]}>Enter your current password and set a new one.</ThemedText>

            <Controller
              control={passwordControl}
              name="currentPassword"
              render={({ field }) => (
                <FormInput
                  label="Current Password"
                  labelStyle={{ backgroundColor }}
                  placeholder="Enter current password"
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  style={{ backgroundColor }}
                  error={passwordErrors.currentPassword?.message as string | undefined}
                />
              )}
            />

            <Controller
              control={passwordControl}
              name="newPassword"
              render={({ field }) => (
                <FormInput
                  label="New Password"
                  labelStyle={{ backgroundColor }}
                  placeholder="Enter new password"
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  style={{ backgroundColor }}
                  error={passwordErrors.newPassword?.message as string | undefined}
                />
              )}
            />

            <Controller
              control={passwordControl}
              name="confirmPassword"
              render={({ field }) => (
                <FormInput
                  label="Confirm Password"
                  labelStyle={{ backgroundColor }}
                  placeholder="Re-enter new password"
                  secureTextEntry
                  value={field.value}
                  onChangeText={field.onChange}
                  style={{ backgroundColor }}
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
    padding: 16,
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    marginBottom: 20,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  tabText: {
    fontSize: 14,
  },
  tabTextActive: {
    fontWeight: "700",
  },
});
