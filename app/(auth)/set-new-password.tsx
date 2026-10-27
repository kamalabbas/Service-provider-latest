import { FormInput } from "@/components/form/FormInput";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { setNewPasswordRequest } from "@/interfaces/auth.interface";
import { useToastStore } from "@/stores/toastStore";
import { newPasswordSchema } from "@/utility/passwordPolicy";
import { yupResolver } from "@hookform/resolvers/yup";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet } from "react-native";
import * as yup from "yup";

// Yup schema for form validation
const schema = yup
  .object({
    password: newPasswordSchema(),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref("password")], "Passwords must match")
      .required("Confirm your new password"),
  })
  .required();

export default function SetNewPasswordScreen() {
  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Toast Store
  const { showToast } = useToastStore();

  // router params
  const router = useRouter();
  const params = useLocalSearchParams();
  const forgotPasswordToken = (params as any)?.forgotPasswordToken;

  // APi Request Hook
  const { mutate: setNewPassword, isPending } = useAuth().setNewPasswordMutation;

  // Submit handler
  const onSubmit = (data: { password: string; confirmPassword: string }) => {
    if (!forgotPasswordToken) {
      showToast("Something went wrong. Please login again.", "error");
      setTimeout(() => {
        router.replace("/(auth)");
      }, 2000);
      return;
    }

    // payload for API
    const payload: setNewPasswordRequest = {
      newPassword: data.password,
      confirmPassword: data.confirmPassword,
      forgotPasswordToken,
    };

    setNewPassword(payload);
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
      footer={<BackToLogin messageText="Changed your mind?" LinkText="Back to sign in" onPress={() => router.replace("/(auth)")} />}
    >
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <FormInput
            label="New password"
            placeholder="Create a new password"
            leftIcon="lock-closed-outline"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password?.message as string}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <FormInput
            label="Confirm new password"
            placeholder="Re-enter your new password"
            leftIcon="lock-closed-outline"
            secureTextEntry
            showPasswordRule={false}
            autoComplete="new-password"
            textContentType="newPassword"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.confirmPassword?.message as string}
          />
        )}
      />

      <PrimaryButton
        title={isPending ? "Saving..." : "Update password"}
        onPress={handleSubmit(onSubmit)}
        disabled={isPending || !process.env.EXPO_PUBLIC_BASE_URL}
        loading={isPending}
        style={styles.submit}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  submit: {
    marginTop: 8,
  },
});
