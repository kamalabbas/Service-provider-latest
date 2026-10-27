import { Radius, Spacing, Typography } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useToastStore } from "@/stores/toastStore";
import { yupResolver } from "@hookform/resolvers/yup";
import React, { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import OTPTextInput from "react-native-otp-textinput";
import * as yup from "yup";
import { ThemedText } from "../ThemedText";
import { PrimaryButton } from "./PrimaryButton";

const RESEND_COOLDOWN_SECONDS = 60;

export interface OTPComponentProps {
  isPending?: boolean;
  email?: string;
  onSubmit: (data: { otp: string }) => void | Promise<void>;
  // Return false when no code was sent, so the resend countdown does not start.
  reSendOtp?: () => boolean | void | Promise<boolean | void>;
  submitLabel?: string;
}

const schema = yup
  .object({
    otp: yup.string().length(6, "Enter all 6 digits of the code").required("Enter the 6-digit code"),
  })
  .required();

export function OTPComponent({ isPending, email, onSubmit, reSendOtp, submitLabel = "Verify" }: OTPComponentProps) {
  // react-hook-form
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { otp: "" },
  });

  // Toast Store
  const { showToast } = useToastStore();

  // theme colors
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const surface = useThemeColor({}, "surface");
  const textColor = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const errorColor = useThemeColor({}, "error");

  // States for resend otp
  const [resendDisabled, setResendDisabled] = useState(false);
  // The backend allows one resend per minute.
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN_SECONDS);
  const resendInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleResendOtp = async () => {
    if (!email || !reSendOtp) return;

    // Disable while the request is in flight to prevent duplicate sends.
    setResendDisabled(true);
    let sent = false;
    try {
      sent = (await reSendOtp()) !== false;
    } catch {
      showToast("Something went wrong.", "error");
    }

    if (!sent) {
      setResendDisabled(false);
      return;
    }

    setResendTimer(RESEND_COOLDOWN_SECONDS);
    resendInterval.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          if (resendInterval.current) {
            clearInterval(resendInterval.current);
            resendInterval.current = null;
          }
          setResendDisabled(false);
          return RESEND_COOLDOWN_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (resendInterval.current) {
        clearInterval(resendInterval.current);
      }
    };
  }, []);

  const canResend = !resendDisabled && !!process.env.EXPO_PUBLIC_BASE_URL;
  const counting = resendDisabled && resendInterval.current;

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="otp"
        render={({ field: { onChange, value } }) => (
          <OTPTextInput
            inputCount={6}
            handleTextChange={onChange}
            defaultValue={value}
            tintColor={errors.otp ? errorColor : tint}
            offTintColor={errors.otp ? errorColor : border}
            containerStyle={styles.otpContainer}
            // The library types this as a ViewStyle, but applies it to each TextInput.
            textInputStyle={{
              ...styles.otpInput,
              color: textColor,
              backgroundColor: surface,
            } as ViewStyle}
            keyboardType="number-pad"
          />
        )}
      />
      {errors.otp?.message ? (
        <ThemedText type="caption" tone="error" style={styles.error}>{errors.otp.message}</ThemedText>
      ) : null}
      <PrimaryButton
        title={isPending ? "Verifying..." : submitLabel}
        onPress={handleSubmit(onSubmit)}
        disabled={isPending || !process.env.EXPO_PUBLIC_BASE_URL}
        loading={isPending}
        style={styles.button}
      />
      <Text style={[styles.resend, { color: muted }]}>
        {"Didn't receive a code? "}
        <Text
          style={[styles.resendAction, { color: canResend ? tint : muted }]}
          onPress={canResend ? handleResendOtp : undefined}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canResend }}
        >
          {counting ? `Resend in ${resendTimer}s` : "Resend code"}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  otpContainer: {
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderBottomWidth: 1,
    ...Typography.title,
    textAlign: "center",
    marginHorizontal: 0,
  },
  error: {
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  button: {
    marginTop: Spacing.xl,
  },
  resend: {
    ...Typography.callout,
    marginTop: Spacing.xl,
    textAlign: "center",
  },
  resendAction: {
    fontWeight: "600",
  },
});
