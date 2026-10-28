import { ThemedText } from "@/components/ThemedText";
import { PushSettings } from "@/components/notification/PushSettings";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useAuth } from "@/hooks/useAuth";
import { useDeactivateMyAccount, useMyMember } from "@/hooks/useMembership";
import { useMyProfile } from "@/hooks/useProfile";
import { useToastStore } from "@/stores/toastStore";
import { canDeactivateOwnAccount, canViewCardRequests, canViewCards, canViewClients, canViewProviderPrices, canViewEmployees, canViewOwnBusiness, canViewOwnProfile, canViewServices, canViewSupport } from "@/utility/access";
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
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const { data: member, isLoading: memberLoading } = useMyMember();
  const { data: profile } = useMyProfile();
  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : null;
  const deactivate = useDeactivateMyAccount();
  const showToast = useToastStore((state) => state.showToast);

  // Guide 03: self-deactivation revokes every session server-side; then clear
  // this device's session and caches through the normal sign-out path.
  const deactivateAccount = () =>
    deactivate.mutate(undefined, {
      onSuccess: async () => {
        setConfirmDeactivate(false);
        showToast("Your account has been deactivated.", "success");
        await logoutAndGoToLogin();
      },
    });

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
        <Avatar name={fullName ?? user?.email} uri={profile?.pictureUrl} size={56} />
        <View style={styles.profileText}>
          <ThemedText type="headline" numberOfLines={1}>{fullName ?? user?.email ?? "Signed in"}</ThemedText>
          {fullName ? <ThemedText type="caption" tone="muted" numberOfLines={1}>{user?.email}</ThemedText> : null}
          <ThemedText type="caption" tone="muted">{user?.roles.length ? user.roles.join(", ") : "Member"}</ThemedText>
        </View>
      </View>

      <ListSection title="Membership">
        {canViewCards(user) ? (
          <ListRow
            icon="wallet-outline"
            title="My cards"
            subtitle="Issued cards, delivery and replacements"
            onPress={() => router.push("/(dashboard)/(menu)/cards")}
          />
        ) : null}
        {canViewCardRequests(user) ? (
          <ListRow
            icon="card-outline"
            title="Membership cards"
            subtitle="Request a card for you or an employee"
            onPress={() => router.push("/(dashboard)/(menu)/card-requests")}
          />
        ) : null}
        {canViewOwnProfile(user) ? (
          <ListRow
            icon="person-circle-outline"
            title="Profile"
            subtitle="Your details, address and contact information"
            onPress={() => router.push("/(dashboard)/(menu)/profile")}
          />
        ) : null}
        <ListRow
          icon="ribbon-outline"
          title={member?.userTypeDisplayName ?? "Member type"}
          subtitle={member ? `Membership ID ${member.membershipId}` : memberLoading ? "Loading…" : "Not chosen yet"}
        />
      </ListSection>

      {canViewOwnBusiness(user, member?.userTypeCode) ? (
        <ListSection title="Business">
          <ListRow
            icon="storefront-outline"
            title="My business"
            subtitle="Name, ABN, address and picture"
            onPress={() => router.push("/(dashboard)/(menu)/business")}
          />
          {canViewServices(user) ? (
            <ListRow
              icon="construct-outline"
              title="My services"
              subtitle="Listings customers find nearby"
              onPress={() => router.push("/(dashboard)/(menu)/my-services")}
            />
          ) : null}
          {canViewEmployees(user, member?.userTypeCode) ? (
            <ListRow
              icon="people-outline"
              title="Employees"
              subtitle="Workers you assign to inspections"
              onPress={() => router.push("/(dashboard)/(menu)/employees")}
            />
          ) : null}
        </ListSection>
      ) : null}

      {canViewClients(user) ? (
        <ListSection title="Relationships">
          <ListRow icon="people-circle-outline" title="My clients" subtitle="Customers your business has worked for"
            onPress={() => router.push("/(dashboard)/(menu)/clients")} />
          <ListRow icon="storefront-outline" title="My providers" subtitle="Businesses that have worked for you"
            onPress={() => router.push("/(dashboard)/(menu)/providers")} />
        </ListSection>
      ) : null}

      {canViewProviderPrices(user) ? (
        // Outside Business: former providers keep read access to their price history.
        <ListSection title="Pricing">
          <ListRow icon="pricetags-outline" title="My prices" subtitle="Your yearly prices for price-guide items"
            onPress={() => router.push("/(dashboard)/(menu)/prices")} />
        </ListSection>
      ) : null}

      <ListSection title="Security">
        <ListRow
          icon="key-outline"
          title="Email & password"
          subtitle="Change your sign-in details"
          onPress={() => router.push("/(dashboard)/(menu)/changeEmailPassword")}
        />
      </ListSection>

      <PushSettings />

      <ListSection title="Appearance">
        <View style={styles.appearance}>
          <SegmentedControl options={THEME_OPTIONS} value={themePreference} onChange={setThemePreference} />
        </View>
      </ListSection>

      <ListSection title="Help">
        {canViewSupport(user) ? (
          <ListRow icon="chatbubbles-outline" title="Support" subtitle="Talk to our team about your account"
            onPress={() => router.push("/(dashboard)/(menu)/support")} />
        ) : null}
        <ListRow icon="bug-outline" title="Report a problem" subtitle="Tell us about an error in the app"
          onPress={() => router.push("/(dashboard)/(menu)/report-problem")} />
      </ListSection>

      <ListSection>
        <ListRow icon="log-out-outline" title="Log out" destructive onPress={() => setConfirmLogout(true)} />
        {canDeactivateOwnAccount(user) ? (
          <ListRow icon="person-remove-outline" title="Deactivate account" destructive onPress={() => setConfirmDeactivate(true)} />
        ) : null}
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

      <ConfirmModal
        visible={confirmDeactivate}
        icon="person-remove-outline"
        tone="danger"
        title="Deactivate your account?"
        message="You'll be signed out on every device and can't sign in again. Your business history is kept, not deleted. Only an administrator can reactivate your account."
        confirmLabel="Deactivate"
        isLoading={deactivate.isPending}
        onConfirm={deactivateAccount}
        onCancel={() => setConfirmDeactivate(false)}
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
