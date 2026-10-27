import { ThemedText } from "@/components/ThemedText";
import { Loader } from "@/components/ui/loader";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { BrandMark } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useAuth } from "@/hooks/useAuth";
import { useMyMember } from "@/hooks/useMembership";
import { useMyProfile } from "@/hooks/useProfile";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

// Guide 01 routes profileCompletionRequired sessions here: choose a member type
// (guide 03), then complete the profile (guide 04) and refresh the session.
export default function SetupScreen() {
  const router = useRouter();
  const email = useAuthStore((state) => state.user?.email);
  const { logoutAndGoToLogin } = useAuth();
  const { data: member, isLoading } = useMyMember();
  const { data: profile } = useMyProfile();
  const typeChosen = Boolean(member);

  return (
    <Screen>
      <View style={styles.header}>
        <BrandMark size={56} />
        <ThemedText type="display" style={styles.title}>Finish setting up</ThemedText>
        <ThemedText type="callout" tone="muted">
          {email ? `Signed in as ${email}. ` : ""}Two quick steps and your account is ready.
        </ThemedText>
      </View>

      {isLoading ? (
        <Loader visible overlay={false} message="Loading your membership…" />
      ) : (
        <ListSection title="Next steps">
          <ListRow
            icon={typeChosen ? "checkmark-circle" : "briefcase-outline"}
            title="1. Choose your member type"
            subtitle={member ? `${member.userTypeDisplayName} · Membership ID ${member.membershipId}` : "Tradesperson, builder, individual and more"}
            onPress={typeChosen ? undefined : () => router.push("/member-type")}
          />
          <ListRow
            icon="person-circle-outline"
            title="2. Complete your profile"
            subtitle={!typeChosen ? "Available after step 1" : profile ? "Review and save to finish" : "Your details and contact information"}
            onPress={typeChosen ? () => router.push("/profile") : undefined}
          />
        </ListSection>
      )}

      <PrimaryButton title="Log out" variant="secondary" leftIcon="log-out-outline" onPress={logoutAndGoToLogin} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm, marginBottom: Spacing.xl },
  title: { marginTop: Spacing.lg },
});
