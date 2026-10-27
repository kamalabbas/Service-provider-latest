import { FormInput } from "@/components/form/FormInput";
import { ThemedText } from "@/components/ThemedText";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { yupResolver } from "@hookform/resolvers/yup";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import * as yup from "yup";

import { useAuth } from "@/hooks/useAuth";
import { LoginRequest } from "@/interfaces/auth.interface";
import React from "react";

const schema = yup
  .object({
    email: yup.string().email("Enter a valid email address").required("Email is required"),
    // Sign-in accepts any nonblank password; the backend applies its own checks.
    password: yup.string().trim().required("Password is required"),
  })
  .required();

export default function Index() {
  const router = useRouter();

  // Email verification returns here with the verified address.
  const { email: verifiedEmail } = useLocalSearchParams<{ email?: string }>();

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { email: verifiedEmail ?? "", password: "" },
  });

  // Login mutation
  const { mutate: loginMutate, isPending } = useAuth().loginMutation;

  // submit handler
  const onSubmit = async (data: LoginRequest) => {
    loginMutate(data);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account to continue."
      footer={
        <BackToLogin messageText="Don't have an account?" LinkText="Create account" onPress={() => router.push("/(auth)/register")} />
      }
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
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <FormInput
            label="Password"
            placeholder="Enter your password"
            leftIcon="lock-closed-outline"
            secureTextEntry
            showPasswordRule={false}
            autoComplete="current-password"
            textContentType="password"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password?.message as string}
          />
        )}
      />

      <View style={styles.forgot}>
        <Link href="/(auth)/forgot-password">
          <ThemedText type="link">Forgot password?</ThemedText>
        </Link>
      </View>

      {!process.env.EXPO_PUBLIC_BASE_URL && (
        <Notice message="Sign-in will be available when the service is connected." style={styles.notice} />
      )}
      <PrimaryButton
        title={isPending ? "Signing in..." : "Sign in"}
        onPress={handleSubmit(onSubmit)}
        disabled={isPending || !process.env.EXPO_PUBLIC_BASE_URL}
        loading={isPending}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgot: {
    alignItems: "flex-end",
    marginTop: -4,
    marginBottom: 24,
  },
  notice: {
    marginBottom: 16,
  },
});
