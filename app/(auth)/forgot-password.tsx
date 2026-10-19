import { FormInput } from "@/components/form/FormInput";
import { ThemedView } from "@/components/ThemedView";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { Logo } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { sendForgotPasswordOtpRequest } from "@/interfaces/auth.interface";
import { yupResolver } from "@hookform/resolvers/yup";
import { useRouter } from "expo-router";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import * as yup from "yup";

// Yup schema for form validation
const schema = yup
  .object({
    email: yup.string().email("Invalid email").required("Email is required"),
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

  const onSubmit = (data: sendForgotPasswordOtpRequest) => {
    // handle forgot password logic here
    sendForgetPasswordMutate(data);
  };

  return (
    <ThemedView style={styles.container}>
      <Logo />
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormInput
              label="Email"
              placeholder="Enter your email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message as string}
            />
          )}
        />
        <PrimaryButton
          title={isPending ? "Sending..." : "Send Reset Link"}
          onPress={handleSubmit(onSubmit)}
          disabled={isPending || !process.env.EXPO_PUBLIC_BASE_URL}
          loading={isPending}
          style={{ marginTop: 12 }}
        />
        <BackToLogin LinkText="Return to Login" onPress={() => router.back()} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  form: {
    width: "100%",
  },
});
