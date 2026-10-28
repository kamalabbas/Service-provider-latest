import { ThemedText } from "@/components/ThemedText";
import { ListSection } from "@/components/ui/ListSection";
import { Spacing } from "@/constants/Theme";
import { useMyPushInstallations, usePushOnThisDevice } from "@/hooks/useNotifications";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useToastStore } from "@/stores/toastStore";
import { canRegisterPushInstallation, canUnregisterPushInstallation } from "@/utility/access";
import { isAxiosError } from "axios";
import { Platform, StyleSheet, Switch, View } from "react-native";

const NOTES = {
  denied: "Notifications are off for this app in your phone's settings. Turn them on there first.",
  unavailable: "Push notifications aren't available here (for example in Expo Go or a simulator).",
  refused: "This device is already linked to another account. Sign out of that account on this device first.",
  error: "Notifications couldn't be set up. We'll try again later.",
} as const;

// Guide 17: turn this device's push destination on or off. No per-event preferences.
export function PushSettings() {
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const tokenStatus = useNotificationStore((state) => state.tokenStatus);
  const registration = useNotificationStore((state) => state.registration);
  const installations = useMyPushInstallations();
  const { enable, disable } = usePushOnThisDevice();
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");

  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  if (!canRegisterPushInstallation(user)) return null;

  const on = registration === "registered";
  const busy = enable.isPending || disable.isPending;
  const note = tokenStatus === "denied" ? NOTES.denied
    : tokenStatus === "unavailable" ? NOTES.unavailable
    : registration === "refused" ? NOTES.refused
    : registration === "error" ? NOTES.error
    : null;
  const count = installations.data?.length ?? 0;

  const toggle = (next: boolean) => {
    const mutation = next ? enable : disable;
    mutation.mutate(undefined, {
      onSuccess: () => showToast(next ? "Notifications are on for this device." : "Notifications are off for this device.", "success"),
      onError: (error) => { if (!isAxiosError(error)) showToast(error.message, "error"); },
    });
  };

  return (
    <ListSection title="Notifications" footer={count ? `Your account receives notifications on ${count} device${count === 1 ? "" : "s"}.` : undefined}>
      <View style={styles.row}>
        <View style={styles.text}>
          <ThemedText>Push notifications on this device</ThemedText>
          {note ? <ThemedText type="caption" tone="muted">{note}</ThemedText> : null}
        </View>
        <Switch
          value={on}
          onValueChange={toggle}
          disabled={busy || (on ? !canUnregisterPushInstallation(user) : tokenStatus === "unavailable")}
          trackColor={{ true: tint, false: border }}
          accessibilityLabel="Push notifications on this device"
        />
      </View>
    </ListSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg },
  text: { flex: 1, gap: Spacing.xxs },
});
