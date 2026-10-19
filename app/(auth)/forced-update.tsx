import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Logo } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";

export default function ForcedUpdate() {
  const params = useLocalSearchParams<{ message?: string; latestVersion?: string; updateUrl?: string }>();
  const latestVersion = params.latestVersion?.toString().padStart(3, "0");
  const displayVersion = latestVersion ? latestVersion.slice(0, 3).split("").join(".") : undefined;

  return (
    <ThemedView style={styles.container}>
      <Logo />
      <ThemedText type="title">App Update Required</ThemedText>
      <ThemedText>{params.message || "Please update Service Provider to continue."}</ThemedText>
      {displayVersion ? <ThemedText>Latest Version: {displayVersion}</ThemedText> : null}
      <PrimaryButton
        title="Update App"
        disabled={!params.updateUrl}
        onPress={() => { if (params.updateUrl) Linking.openURL(params.updateUrl); }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
});
