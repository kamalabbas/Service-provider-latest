import { FormInput } from "@/components/form/FormInput";
import { ThemedView } from "@/components/ThemedView";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { Logo } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { RegisterRequest } from "@/interfaces/auth.interface";
import { newPasswordSchema } from "@/utility/passwordPolicy";
import { yupResolver } from "@hookform/resolvers/yup";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as yup from "yup";

// yup schema for form validation
const schema = yup
  .object({
    email: yup.string().email("Invalid email").required("Email is required"),
    password: newPasswordSchema(),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref("password")], "Passwords must match")
      .required("Confirm Password is required"),
  })
  .required();

export default function RegisterScreen() {
  // Router hook
  const router = useRouter();

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema), defaultValues: { email: "", password: "", confirmPassword: "" } });

  // Theme colors
  const backgroundColor = useThemeColor({}, "background");

  // API Request Hook
  const { mutate: registerMutate, isPending } = useAuth().registerMutation;

  // Submit handler
  const onSubmit = (data: RegisterRequest) => {
    registerMutate(data);
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: backgroundColor }}
      contentContainerStyle={{ flexGrow: 1, backgroundColor: backgroundColor }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      enableResetScrollToCoords={false}
      extraScrollHeight={64}
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
                placeholder="Confirm your password"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message as string}
              />
            )}
          />
          <PrimaryButton
            title={isPending ? "Registering..." : "Register"}
            onPress={handleSubmit(onSubmit)}
            disabled={isPending || !process.env.EXPO_PUBLIC_BASE_URL}
            style={{ marginTop: 12 }}
          />

          <BackToLogin messageText="Already have an account?" LinkText="Return to Login" onPress={() => router.back()} />
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
});
