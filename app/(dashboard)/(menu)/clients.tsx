import { RelationshipCard } from "@/components/client/RelationshipCard";
import { ThemedText } from "@/components/ThemedText";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess } from "@/hooks/useBusiness";
import { useMyClients, useSetClientHidden } from "@/hooks/useClients";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useToastStore } from "@/stores/toastStore";
import { canViewClients } from "@/utility/access";
import { clientActions, relationshipKey } from "@/utility/clientRules";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

// Guide 12: "My clients", created by accepted inspections; one row per business and client.
export default function ClientsScreen() {
  const showToast = useToastStore((state) => state.showToast);
  const { user, userTypeCode } = useBusinessAccess();
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const clients = useMyClients({ includeHidden, includeArchivedBusinesses: includeArchived });
  const visibility = useSetClientHidden();

  useFocusEffect(useCallback(() => {
    clients.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (!canViewClients(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view clients." /></Screen>;
  }

  const list = clients.data ?? [];
  const toggle = (label: string, value: boolean, onChange: (next: boolean) => void) => (
    <View style={styles.switchRow}>
      <ThemedText style={styles.switchLabel}>{label}</ThemedText>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: tint, false: border }} accessibilityLabel={label} />
    </View>
  );

  return (
    <Screen hasHeader title="My clients" subtitle="Customers whose inspection requests your business accepted.">
      {toggle("Show hidden", includeHidden, setIncludeHidden)}
      {toggle("Include archived businesses", includeArchived, setIncludeArchived)}

      {clients.isLoading ? (
        <Loader visible overlay={false} message="Loading clients…" />
      ) : list.length === 0 ? (
        <Notice message="No clients yet. They appear here when you accept an inspection request." />
      ) : (
        <>
          {list.map((relationship) => {
            const allowed = clientActions(relationship, user, userTypeCode);
            const setHidden = (isHidden: boolean) => visibility.mutate(
              { businessId: relationship.businessId, clientUserId: relationship.clientUserId, isHidden },
              { onSuccess: () => showToast(isHidden ? "Hidden from your list. Their history is unchanged." : "Restored to your list.", "success") },
            );
            return (
              <RelationshipCard key={relationshipKey(relationship)} relationship={relationship} perspective="client">
                {allowed.hide ? <PrimaryButton title="Hide from my list" variant="ghost" size="md" leftIcon="eye-off-outline" onPress={() => setHidden(true)} disabled={visibility.isPending} /> : null}
                {allowed.restore ? <PrimaryButton title="Show in my list" variant="ghost" size="md" leftIcon="eye-outline" onPress={() => setHidden(false)} disabled={visibility.isPending} /> : null}
              </RelationshipCard>
            );
          })}
          {clients.hasNextPage ? (
            <PrimaryButton
              title={clients.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => clients.fetchNextPage()}
              loading={clients.isFetchingNextPage}
              disabled={clients.isFetchingNextPage}
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
  switchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.md },
  switchLabel: { flex: 1 },
  end: { textAlign: "center" },
});
