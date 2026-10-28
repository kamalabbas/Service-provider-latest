import { ThemedText } from "@/components/ThemedText";
import { Radius, Shadow, Spacing } from "@/constants/Theme";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ClientRelationship } from "@/interfaces/client.interface";
import { clientMembershipText, inspectionCountText } from "@/utility/clientRules";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PropsWithChildren } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

const date = (value: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

type RelationshipCardProps = PropsWithChildren<{
  relationship: ClientRelationship;
  /** client: a provider looking at a client; provider: a customer looking at a business. */
  perspective: "client" | "provider";
}>;

// Guide 12: one business–client relationship. Only the fields the list is entitled to.
export function RelationshipCard({ relationship, perspective, children }: RelationshipCardProps) {
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "separatorColor");
  const tint = useThemeColor({}, "tint");
  const archived = !!relationship.businessArchivedAtUtc;
  const badges = [
    perspective === "client" && relationship.clientAccountDeactivated ? "Account deactivated" : null,
    archived ? "Business archived" : null,
    perspective === "client" && relationship.isHidden ? "Hidden" : null,
  ].filter(Boolean);

  return (
    <View style={[styles.card, Shadow.card, { backgroundColor: surface, borderColor: border }]}>
      <ThemedText type="headline">{perspective === "client" ? relationship.clientName : relationship.businessName}</ThemedText>
      <ThemedText type="caption" tone="muted">
        {perspective === "client"
          ? `${clientMembershipText(relationship)} · ${relationship.businessName}`
          : `${relationship.providerName} · Membership ID ${relationship.providerMembershipId}`}
      </ThemedText>
      {badges.length ? <ThemedText type="caption" tone="error">{badges.join(" · ")}</ThemedText> : null}

      {perspective === "client" ? (
        <Pressable
          onPress={() => Linking.openURL(`tel:${relationship.clientMobilePhone.replace(/[^\d+]/g, "")}`)}
          accessibilityRole="link"
          accessibilityLabel={`Call ${relationship.clientName}`}
          style={styles.phone}
        >
          <Ionicons name="call-outline" size={16} color={tint} />
          <ThemedText type="callout" style={{ color: tint }}>{relationship.clientMobilePhone}</ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="caption" tone="muted" style={styles.meta}>
        {inspectionCountText(relationship)} · since {date(relationship.firstAcceptedAtUtc)} · last {date(relationship.lastAcceptedAtUtc)}
      </ThemedText>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.md, gap: Spacing.xxs },
  phone: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm, alignSelf: "flex-start" },
  meta: { marginTop: Spacing.sm },
  actions: { marginTop: Spacing.md },
});
