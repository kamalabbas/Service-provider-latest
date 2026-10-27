import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { BrandMark } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { StyleSheet, View } from "react-native";

// Guide 01 routes profileCompletionRequired sessions here. Choosing a user type
// (guide 03) and saving the profile (guide 04) will replace this placeholder.
export default function SetupScreen() {
  const email = useAuthStore((state) => state.user?.email);
  const { logoutAndGoToLogin } = useAuth();

  return (
    <Screen>
      <View style={styles.header}>
        <BrandMark size={56} />
        <ThemedText type="display" style={styles.title}>Finish setting up</ThemedText>
        <ThemedText type="callout" tone="muted">
          {email ? `Signed in as ${email}. ` : ""}Two quick steps and your account is ready.
        </ThemedText>
      </View>

      <ListSection title="Next steps">
        <ListRow icon="briefcase-outline" title="Choose your member type" subtitle="Tradesperson, builder, individual and more" />
        <ListRow icon="person-circle-outline" title="Complete your profile" subtitle="Your details and contact information" />
      </ListSection>

      <PrimaryButton title="Log out" variant="secondary" leftIcon="log-out-outline" onPress={logoutAndGoToLogin} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm, marginBottom: Spacing.xl },
  title: { marginTop: Spacing.lg },
});
