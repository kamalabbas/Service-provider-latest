import { useThemeColor } from "@/hooks/useThemeColor";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
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

  // NEW — optional custom content inside modal
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
  isLoading = false
}) => {
  const bg = useThemeColor({}, "surface");
  const text = useThemeColor({}, "text");
  const cancelBg = useThemeColor({}, "muted");
  const cancelBorder = useThemeColor({}, "borderColor");

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onCancel} />

        <View style={[styles.modal, { backgroundColor: bg }]}>
          <ThemedText type="defaultSemiBold" style={styles.title}>
            {title}
          </ThemedText>

          {/* If custom content exists, show it — else show message */}
          {customContent ? (
            <View style={{ width: "100%", marginBottom: 20 }}>
              {customContent}
            </View>
          ) : (
            message && (
              <ThemedText style={[styles.message, { color: text }]}>
                {message}
              </ThemedText>
            )
          )}

          {/* Buttons row */}
          <View style={styles.buttonRow}>
            <PrimaryButton
              title={isLoading ? "Loading..." : confirmLabel}
              onPress={onConfirm}
              style={{ flex: 1, marginRight: 8 }}
              disabled={isLoading}
            />

            <TouchableOpacity onPress={onCancel} style={[styles.cancelBtn, { backgroundColor: cancelBg, borderColor: cancelBorder }]}>
              <ThemedText style={{ color: text }}>{cancelLabel}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <Pressable style={{ flex: 1 }} onPress={onCancel} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  modal: {
    padding: 20,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
  },
  title: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 22,
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
});
