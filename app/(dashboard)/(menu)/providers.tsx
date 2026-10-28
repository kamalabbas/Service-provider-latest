import { RelationshipCard } from "@/components/client/RelationshipCard";
import { ThemedText } from "@/components/ThemedText";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useMyProviders } from "@/hooks/useClients";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useAuthStore } from "@/stores/authStore";
import { canViewClients } from "@/utility/access";
import { relationshipKey } from "@/utility/clientRules";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

// Guide 12: "My providers", the customer's view. Not affected by a provider hiding them.
export default function ProvidersScreen() {
  const user = useAuthStore((state) => state.user);
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const [includeArchived, setIncludeArchived] = useState(false);
  const providers = useMyProviders({ includeArchivedBusinesses: includeArchived });

  useFocusEffect(useCallback(() => {
    providers.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (!canViewClients(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view providers." /></Screen>;
  }

  const list = providers.data ?? [];

  return (
    <Screen hasHeader title="My providers" subtitle="Businesses that accepted your inspection requests.">
      <View style={styles.switchRow}>
        <ThemedText style={styles.switchLabel}>Include archived businesses</ThemedText>
        <Switch value={includeArchived} onValueChange={setIncludeArchived} trackColor={{ true: tint, false: border }} accessibilityLabel="Include archived businesses" />
      </View>

      {providers.isLoading ? (
        <Loader visible overlay={false} message="Loading providers…" />
      ) : list.length === 0 ? (
        <Notice message="No providers yet. They appear here once a provider accepts your inspection request." />
      ) : (
        <>
          {list.map((relationship) => (
            <RelationshipCard key={relationshipKey(relationship)} relationship={relationship} perspective="provider" />
          ))}
          {providers.hasNextPage ? (
            <PrimaryButton
              title={providers.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => providers.fetchNextPage()}
              loading={providers.isFetchingNextPage}
              disabled={providers.isFetchingNextPage}
            />
          ) : (
            <ThemedText type="footnote" tone="muted" style={styles.end}>End of list.</ThemedText>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.lg },
  switchLabel: { flex: 1 },
  end: { textAlign: "center" },
});
