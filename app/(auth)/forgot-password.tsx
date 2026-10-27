import { FormInput } from "@/components/form/FormInput";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { PasswordRecoveryRequest } from "@/interfaces/serviceProviderAuth.interface";
import { yupResolver } from "@hookform/resolvers/yup";
import { useRouter } from "expo-router";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet } from "react-native";
import * as yup from "yup";

// Yup schema for form validation
const schema = yup
  .object({
    email: yup.string().email("Enter a valid email address").required("Email is required"),
  })
  .required();

export default function ForgotPasswordScreen() {
  // router hook
  const router = useRouter();

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { email: "" },
  });

  // API Request Hook
  const { mutate: sendForgetPasswordMutate, isPending } = useAuth().sendForgetPasswordMutation;

  const onSubmit = (data: PasswordRecoveryRequest) => {
    sendForgetPasswordMutate(data);
  };

  return (
    <AuthLayout
      hasHeader
      title="Reset your password"
      subtitle="Enter the email you registered with and we'll send you a reset code."
      footer={<BackToLogin messageText="Remembered it?" LinkText="Back to sign in" onPress={() => router.back()} />}
    >
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <FormInput
            label="Email"
            placeholder="name@example.com"
            leftIcon="mail-outline"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message as string}
          />
        )}
      />
      <PrimaryButton
        title={isPending ? "Sending code..." : "Send reset code"}
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
