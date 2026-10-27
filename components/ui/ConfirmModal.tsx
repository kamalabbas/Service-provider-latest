import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { ComponentProps } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "../ThemedText";
import { PrimaryButton } from "./PrimaryButton";

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** danger styles the confirm action as destructive. */
  tone?: "default" | "danger";
  icon?: ComponentProps<typeof Ionicons>["name"];

  // Optional custom content inside the modal
  customContent?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  customContent,
  isLoading = false,
  tone = "default",
  icon,
}) => {
  const surface = useThemeColor({}, "surface");
  const overlay = useThemeColor({}, "overlay");
  const danger = useThemeColor({}, "error");
  const dangerSurface = useThemeColor({}, "errorSurface");
  const tint = useThemeColor({}, "tint");
  const tintSurface = useThemeColor({}, "primaryLight");

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close dialog" />

        <View style={[styles.modal, Shadow.floating, { backgroundColor: surface }]} accessibilityViewIsModal>
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: tone === "danger" ? dangerSurface : tintSurface }]}>
              <Ionicons name={icon} size={24} color={tone === "danger" ? danger : tint} />
            </View>
          ) : null}
          <ThemedText type="headline" style={styles.title}>{title}</ThemedText>

          {customContent ? (
            <View style={styles.custom}>{customContent}</View>
          ) : message ? (
            <ThemedText type="callout" tone="muted" style={styles.message}>{message}</ThemedText>
          ) : null}

          <View style={styles.buttonRow}>
            <PrimaryButton title={cancelLabel} variant="secondary" size="md" onPress={onCancel} disabled={isLoading} style={styles.button} />
            <PrimaryButton
              title={confirmLabel}
              variant={tone === "danger" ? "danger" : "primary"}
              size="md"
              onPress={onConfirm}
              loading={isLoading}
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modal: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: "center",
  },
  custom: {
    width: "100%",
    marginTop: Spacing.sm,
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  button: {
    flex: 1,
  },
});
