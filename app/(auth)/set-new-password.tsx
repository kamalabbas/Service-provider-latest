import { FormInput } from "@/components/form/FormInput";
import { ThemedView } from "@/components/ThemedView";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { Logo } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { setNewPasswordRequest } from "@/interfaces/auth.interface";
import { useToastStore } from "@/stores/toastStore";
import { newPasswordSchema } from "@/utility/passwordPolicy";
import { yupResolver } from "@hookform/resolvers/yup";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as yup from "yup";

// Yup schema for form validation
const schema = yup
  .object({
    password: newPasswordSchema(),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref("password")], "Passwords must match")
      .required("Confirm password is required"),
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

  // Theme colors
  const backgroundColor = useThemeColor({}, "background");

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
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormInput
              label="New Password"
              placeholder="Enter new password"
              secureTextEntry
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
              label="Confirm Password"
              placeholder="Re-enter new password"
              secureTextEntry
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword?.message as string}
            />
          )}
        />

        <PrimaryButton
          title={isPending ? "Saving..." : "Set Password"}
          onPress={handleSubmit(onSubmit)}
          disabled={isPending || !process.env.EXPO_PUBLIC_BASE_URL}
          loading={isPending}
          style={{ marginTop: 12 }}
        />

        <BackToLogin LinkText="Return to Login" onPress={() => router.replace("/(auth)")} />
      </ThemedView>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignContent: "center",
    justifyContent: "center",
    padding: 24,
  },
});
