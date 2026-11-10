import { PushSettings } from "@/components/notification/PushSettings";
import { Screen } from "@/components/ui/Screen";

// Guide 17/18: notification settings for this phone and the live in-app connection.
export default function NotificationSettingsScreen() {
  return (
    <Screen hasHeader title="Notifications" subtitle="Choose how this phone tells you about updates.">
      <PushSettings />
    </Screen>
  );
}
