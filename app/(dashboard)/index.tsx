import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Logo } from "@/components/ui/Logo";
import { useAuthStore } from "@/stores/authStore";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const email = useAuthStore((state) => state.user?.email);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <Logo />
        <ThemedText type="title">Welcome</ThemedText>
        {email ? <ThemedText>{email}</ThemedText> : null}
        <ThemedText style={styles.message}>Your workspace is ready.</ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  message: { textAlign: "center" },
});
