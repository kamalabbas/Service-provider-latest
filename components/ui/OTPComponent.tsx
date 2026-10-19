import { useThemeColor } from "@/hooks/useThemeColor";
import { useToastStore } from "@/stores/toastStore";
import { yupResolver } from "@hookform/resolvers/yup";
import React, { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import OTPTextInput from "react-native-otp-textinput";
import * as yup from "yup";
import { ThemedView } from "../ThemedView";
import { PrimaryButton } from "./PrimaryButton";
import { Logo } from "./Logo";

export interface OTPComponentProps {
  isPending?: boolean;
  email?: string; 
  onSubmit: (data: { otp: string }) => void | Promise<void>;
  reSendOtp?: () => void | Promise<void>;
}

export function OTPComponent({ isPending, email, onSubmit, reSendOtp }: OTPComponentProps) {
  // Yup schema
  const schema = yup
    .object({
      otp: yup.string().length(6, "OTP must be 6 digits").required("OTP is required"),
    })
    .required();

  // react-hook-form
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { otp: "" },
  });

  // Toast Store
  const { showToast } = useToastStore();

  // theme colors
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const bg = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const muted = useThemeColor({}, "optionSeparator");

  // States for resend otp
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(120);
  const resendInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleResendOtp = async () => {
    try {
      if (email && reSendOtp) {
        await reSendOtp();
      }
    } catch {
      showToast("Something went wrong.", "error");
    }

    setResendDisabled(true);
    setResendTimer(120);
    resendInterval.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          if (resendInterval.current) {
            clearInterval(resendInterval.current);
            resendInterval.current = null;
          }
          setResendDisabled(false);
          return 120;
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

  return (
    <ThemedView style={styles.container}>
      <Logo />
      <Controller
        control={control}
        name="otp"
        render={({ field: { onChange, value } }) => (
          <OTPTextInput
            inputCount={6}
            handleTextChange={onChange}
            defaultValue={value}
            tintColor={tint}
            offTintColor={border}
            containerStyle={styles.otpContainer}
            textInputStyle={{
              ...styles.otpInput,
              borderColor: border,
              backgroundColor: bg,
            }}
            keyboardType="number-pad"
          />
        )}
      />
      <PrimaryButton
        title={isPending ? "Verifying..." : "Verify OTP"}
        onPress={handleSubmit(onSubmit)}
        disabled={isPending || !process.env.EXPO_PUBLIC_BASE_URL}
        loading={isPending}
        style={styles.Button}
      />
      <Text style={[styles.resendContainer, { color: textColor }]}>
        {"Didn't receive an OTP? "}
        <Text style={resendDisabled ? [styles.resendTextDisabled, { color: muted }] : [styles.resendText, { color: tint }]} onPress={!resendDisabled && process.env.EXPO_PUBLIC_BASE_URL ? handleResendOtp : undefined}>
          Resend it
        </Text>
        {resendDisabled && (
          <Text style={[styles.counterText, { color: muted }]}> ({resendTimer}s)</Text>
        )}
      </Text>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logo: {
    width: 220,
    height: 200,
    marginBottom: 16,
    alignSelf: "center",
  },
  otpContainer: {
    marginVertical: 16,
    alignSelf: "center",
  },
  otpInput: {
    borderRadius: 8,
    borderWidth: 1,
    width: 40,
    height: 48,
    fontSize: 20,
    textAlign: "center",
    marginHorizontal: 4,
  },
  title: {
    marginBottom: 24,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    marginVertical: 16,
  },
  buttonText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  resendContainer: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 15,
  },
  resendText: {
    textDecorationLine: "underline",
    fontWeight: "bold",
  },
  resendTextDisabled: {
    textDecorationLine: "underline",
    fontWeight: "bold",
  },
  counterText: {
    fontSize: 15,
  },
  registerLink: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  Button: {
    marginTop: 12,
    marginBottom: 8,
  },
});
