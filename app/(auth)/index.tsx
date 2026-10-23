import { FormInput } from "@/components/form/FormInput";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { yupResolver } from "@hookform/resolvers/yup";
import { Link } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as yup from "yup";

import { Logo } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { LoginRequest } from "@/interfaces/auth.interface";
import React from "react";

const schema = yup
  .object({
    email: yup.string().email("Invalid email").required("Email is required"),
    password: yup.string().min(8, "Password must be at least 8 characters").required("Password is required"),
  })
  .required();

export default function Index() {
  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Theme colors
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const tint = useThemeColor({}, "tint");

  // Login mutation
  const { mutate: loginMutate, isPending } = useAuth().loginMutation;

  // submit handler
  const onSubmit = async (data: LoginRequest) => {
    loginMutate(data);
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: backgroundColor }}
      contentContainerStyle={{ flexGrow: 1, backgroundColor: backgroundColor }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      enableResetScrollToCoords={false}
      extraScrollHeight={24}
    >
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
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Password"
                placeholder="Enter your password"
                secureTextEntry
                showPasswordRule={false}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message as string}
              />
            )}
          />

          <View style={styles.forgotPasswordLinkContainer}>
            <Link href="/(auth)/forgot-password" style={[styles.forgotLink, { color: tint }]}>
              Forgot password?
            </Link>
          </View>

          {!process.env.EXPO_PUBLIC_BASE_URL && (
            <ThemedText style={{ marginBottom: 16 }}>Sign-in will be available when the service is connected.</ThemedText>
          )}
          <PrimaryButton title={isPending ? "Logging in..." : "Login"} onPress={handleSubmit(onSubmit)} disabled={isPending || !process.env.EXPO_PUBLIC_BASE_URL} loading={isPending} />

          <View style={styles.signupContainer}>
            <ThemedText style={[styles.switchText, { color: textColor }]}>{"Don't have an account? "}</ThemedText>
            <Link href="/(auth)/register" style={[styles.registerLink, { color: tint }]}>
              Register
            </Link>
          </View>
        </View>
      </ThemedView>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  form: {
    width: "100%",
  },
  forgotPasswordLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 16,
  },
  forgotLink: {
    fontWeight: "bold",
    textDecorationLine: "underline",
    fontSize: 14,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },

  registerLink: {
    fontWeight: "bold",
    textDecorationLine: "underline",
    fontSize: 14,
  },
  switchText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
