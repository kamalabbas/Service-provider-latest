import { FormInput } from "@/components/form/FormInput";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { BackToLogin } from "@/components/ui/BackToLogin";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { RegisterRequest } from "@/interfaces/auth.interface";
import { newPasswordSchema } from "@/utility/passwordPolicy";
import { yupResolver } from "@hookform/resolvers/yup";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet } from "react-native";
import * as yup from "yup";

// yup schema for form validation
const schema = yup
  .object({
    email: yup.string().email("Enter a valid email address").required("Email is required"),
    password: newPasswordSchema(),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref("password")], "Passwords must match")
      .required("Confirm your password"),
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

  // API Request Hook
  const { mutate: registerMutate, isPending } = useAuth().registerMutation;

  // Submit handler
  const onSubmit = (data: RegisterRequest) => {
    registerMutate(data);
  };

  return (
    <AuthLayout
      hasHeader
      title="Create your account"
      subtitle="We'll send a verification code to your email."
      footer={<BackToLogin messageText="Already have an account?" LinkText="Sign in" onPress={() => router.back()} />}
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
            placeholder="Create a password"
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
            label="Confirm password"
            placeholder="Re-enter your password"
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
        title={isPending ? "Creating account..." : "Create account"}
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
