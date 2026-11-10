import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Radius, Spacing } from "@/constants/Theme";
import { useMyPushInstallations, usePushOnThisDevice } from "@/hooks/useNotifications";
import { useThemeColor } from "@/hooks/useThemeColor";
import { pushUnavailableReason } from "@/services/pushRegistration";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useToastStore } from "@/stores/toastStore";
import { canRegisterPushInstallation, canUnregisterPushInstallation } from "@/utility/access";
import { isAxiosError } from "axios";
import { Linking, Platform, StyleSheet, Switch, View } from "react-native";

const LIVE_LABELS = {
  live: { label: "Connected", tone: "success" },
  connecting: { label: "Connecting…", tone: "info" },
  reconnecting: { label: "Reconnecting…", tone: "warning" },
  retrying: { label: "Retrying…", tone: "warning" },
  off: { label: "Off", tone: "neutral" },
} as const;

// Guide 17/18: push notifications on this device, and the live in-app connection. The switch
// shows the real state: it's only on once this device is registered with the server.
export function PushSettings() {
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const tokenStatus = useNotificationStore((state) => state.tokenStatus);
  const registration = useNotificationStore((state) => state.registration);
  const live = useNotificationStore((state) => state.live);
  const installations = useMyPushInstallations();
  const { enable, disable } = usePushOnThisDevice();
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const surface = useThemeColor({}, "surface");
  const separator = useThemeColor({}, "separatorColor");

  const supported = Platform.OS === "ios" || Platform.OS === "android";
  const on = registration === "registered";
  const busy = enable.isPending || disable.isPending || tokenStatus === "loading";
  // Explain why it's off (blocked, Expo Go, another account), except when simply turned off.
  const reason = !on && registration !== "disabled" && registration !== "idle" ? pushUnavailableReason() : null;
  const blocked = tokenStatus === "denied";
  const unavailable = tokenStatus === "unavailable";
  const count = installations.data?.length ?? 0;

  const toggle = (next: boolean) => {
    const mutation = next ? enable : disable;
    mutation.mutate(undefined, {
      onSuccess: () => showToast(next ? "Notifications are on for this phone." : "Notifications are off for this phone.", "success"),
      // Local reasons (blocked, Expo Go, another account) aren't API errors; show them.
      onError: (error) => { if (!isAxiosError(error)) showToast(error.message, "error"); },
    });
  };

  return (
    <>
      {supported && canRegisterPushInstallation(user) ? (
        <View style={[styles.card, { backgroundColor: surface, borderColor: separator }]}>
          <View style={styles.row}>
            <View style={styles.text}>
              <ThemedText type="headline">Push notifications</ThemedText>
              <ThemedText type="caption" tone="muted">
                {on ? "You'll get alerts on this phone, even when the app is closed." : "Turn on to get alerts about inspections, quotes, cards and support."}
              </ThemedText>
            </View>
            <Switch
              value={on}
              onValueChange={toggle}
              disabled={busy || unavailable || (on && !canUnregisterPushInstallation(user))}
              trackColor={{ true: tint, false: border }}
              accessibilityLabel="Push notifications on this phone"
            />
          </View>
          <StatusBadge label={on ? "On" : busy ? "Updating…" : unavailable ? "Not available here" : blocked ? "Blocked" : "Off"} tone={on ? "success" : blocked ? "danger" : "neutral"} />
          {reason || unavailable ? <Notice tone={blocked ? "warning" : "info"} message={reason ?? pushUnavailableReason() ?? ""} /> : null}
          {blocked ? <PrimaryButton title="Open phone settings" variant="secondary" size="md" leftIcon="settings-outline" onPress={() => Linking.openSettings()} /> : null}
        </View>
      ) : null}

      <ListSection title="In the app" footer="While the app is open, screens update by themselves when something changes.">
        <ListRow
          icon="pulse-outline"
          title="Live updates"
          trailing={<StatusBadge label={LIVE_LABELS[live].label} tone={LIVE_LABELS[live].tone} />}
        />
      </ListSection>

      {count ? (
        <ThemedText type="footnote" tone="muted" style={styles.footer}>
          {`Your account gets notifications on ${count} device${count === 1 ? "" : "s"}.`}
        </ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  text: { flex: 1, gap: Spacing.xxs },
  footer: { textAlign: "center" },
});
