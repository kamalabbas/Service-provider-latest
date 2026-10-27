import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Logo } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Guide 01 routes profileCompletionRequired sessions here. Choosing a user type
// (guide 03) and saving the profile (guide 04) will replace this placeholder.
export default function SetupScreen() {
  const email = useAuthStore((state) => state.user?.email);
  const { logoutAndGoToLogin } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <Logo />
        <ThemedText type="title" style={styles.center}>Finish setting up</ThemedText>
        {email ? <ThemedText style={styles.center}>{email}</ThemedText> : null}
        <ThemedText style={styles.center}>
          Choose your member type and complete your profile to start using Service Provider.
        </ThemedText>
        <PrimaryButton title="Log out" onPress={logoutAndGoToLogin} style={styles.button} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  center: { textAlign: "center" },
  button: { alignSelf: "stretch" },
});
