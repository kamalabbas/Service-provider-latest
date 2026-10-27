import { ThemedText } from "@/components/ThemedText";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useAuth } from "@/hooks/useAuth";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuthStore } from "@/stores/authStore";
import { ThemePreference, useThemeStore } from "@/stores/theme";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

const THEME_OPTIONS = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const satisfies readonly { label: string; value: ThemePreference }[];

export default function MenuScreen() {
  const router = useRouter();
  const { logoutAndGoToLogin } = useAuth();
  const user = useAuthStore((state) => state.user);
  const themePreference = useThemeStore((state) => state.preference);
  const setThemePreference = useThemeStore((state) => state.setPreference);
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const logOut = async () => {
    setLoggingOut(true);
    try {
      await logoutAndGoToLogin();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <Screen title="Account">
      <View style={[styles.profile, Shadow.card, { backgroundColor: surface, borderColor: border }]}>
        <Avatar name={user?.email} size={56} />
        <View style={styles.profileText}>
          <ThemedText type="headline" numberOfLines={1}>{user?.email ?? "Signed in"}</ThemedText>
          <ThemedText type="caption" tone="muted">{user?.roles.length ? user.roles.join(", ") : "Member"}</ThemedText>
        </View>
      </View>

      <ListSection title="Security">
        <ListRow
          icon="key-outline"
          title="Email & password"
          subtitle="Change your sign-in details"
          onPress={() => router.push("/(dashboard)/(menu)/changeEmailPassword")}
        />
      </ListSection>

      <ListSection title="Appearance">
        <View style={styles.appearance}>
          <SegmentedControl options={THEME_OPTIONS} value={themePreference} onChange={setThemePreference} />
        </View>
      </ListSection>

      <ListSection>
        <ListRow icon="log-out-outline" title="Log out" destructive onPress={() => setConfirmLogout(true)} />
      </ListSection>

      <ThemedText type="footnote" tone="muted" style={styles.version}>
        Service Provider {Constants.expoConfig?.version ?? ""}
      </ThemedText>

      <ConfirmModal
        visible={confirmLogout}
        icon="log-out-outline"
        tone="danger"
        title="Log out?"
        message="You'll need to sign in again to use your account on this device."
        confirmLabel="Log out"
        isLoading={loggingOut}
        onConfirm={logOut}
        onCancel={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xl,
  },
  profileText: { flex: 1, gap: Spacing.xxs },
  appearance: { padding: Spacing.md },
  version: { textAlign: "center", marginTop: Spacing.sm },
});
