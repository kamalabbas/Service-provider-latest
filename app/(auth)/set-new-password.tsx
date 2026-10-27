import { FormInput } from "@/components/form/FormInput";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { ResetPasswordRequest } from "@/interfaces/serviceProviderAuth.interface";
import { mapApiValidation } from "@/services/apiError";
import { usePasswordRecoveryStore } from "@/stores/passwordRecoveryStore";
import { useToastStore } from "@/stores/toastStore";
import { newPasswordSchema } from "@/utility/passwordPolicy";
import { yupResolver } from "@hookform/resolvers/yup";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet } from "react-native";
import * as yup from "yup";

const FIELDS = ["newPassword", "confirmNewPassword"] as const;

// Yup schema for form validation (same policy as registration)
const schema = yup
  .object({
    newPassword: newPasswordSchema(),
    confirmNewPassword: yup
      .string()
      .oneOf([yup.ref("newPassword")], "Passwords must match")
      .required("Confirm your new password"),
  })
  .required();

export default function SetNewPasswordScreen() {
  // Form setup
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { newPassword: "", confirmNewPassword: "" },
  });

  // Toast Store
  const { showToast } = useToastStore();
  const router = useRouter();

  // Guide 02: email and code come from transient state, never the route.
  const { email, code } = usePasswordRecoveryStore.getState();

  // APi Request Hook
  const { mutate: resetPassword, isPending } = useAuth().setNewPasswordMutation;

  // Submit handler
  const onSubmit = (data: { newPassword: string; confirmNewPassword: string }) => {
    if (!email || !code) {
      showToast("Your recovery session ended. Request a new code.", "error");
      router.replace("/(auth)/forgot-password");
      return;
    }

    const payload: ResetPasswordRequest = { email, code, ...data };

    resetPassword(payload, {
      // A password-policy failure keeps the code valid: show it on the field and let the member retry.
      onError: (error) => {
        const { fieldErrors } = mapApiValidation(error, FIELDS);
        FIELDS.forEach((field) => {
          if (fieldErrors[field]) setError(field, { message: fieldErrors[field] });
        });
      },
    });
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
      footer={<BackToLogin messageText="Changed your mind?" LinkText="Back to sign in" onPress={() => router.replace("/(auth)")} />}
    >
      <Controller
        control={control}
        name="newPassword"
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
            error={errors.newPassword?.message as string}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmNewPassword"
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
            error={errors.confirmNewPassword?.message as string}
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
