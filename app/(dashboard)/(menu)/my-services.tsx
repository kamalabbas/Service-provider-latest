import { VisibilityPrompt } from "@/components/business/VisibilityPrompt";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useMyServices } from "@/hooks/useServices";
import { canManageOwnServices, canViewOwnServices } from "@/utility/access";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

const FILTERS = [
  { label: "Active", value: "active" },
  { label: "Deleted", value: "archived" },
] as const;

// Guide 07: the provider's own listings, including archived history.
export default function MyServicesScreen() {
  const router = useRouter();
  const { user, member, userTypeCode } = useBusinessAccess();
  const { data: business, isLoading: businessLoading } = useMyBusiness();
  const { data: services = [], isLoading } = useMyServices();
  const [filter, setFilter] = useState<"active" | "archived">("active");

  if (!member.isLoading && !canViewOwnServices(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="My services is for tradespeople." /></Screen>;
  }
  if (member.isLoading || businessLoading || isLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading your services…" /></Screen>;
  }

  const shown = services.filter((service) => (filter === "archived") === Boolean(service.archivedAtUtc));
  const canPublish = canManageOwnServices(user, userTypeCode);

  return (
    <Screen hasHeader title="My services" subtitle="Listings customers find when they search nearby.">
      {canPublish && business ? (
        <>
          <VisibilityPrompt hideWhenOnServices />
          {services.every((service) => service.archivedAtUtc) ? (
            <Notice tone="warning" message="You're not visible in search yet. Add at least one service so customers can find you." style={styles.add} />
          ) : null}
          <PrimaryButton title="Add a service" leftIcon="add-circle-outline" onPress={() => router.push("/(dashboard)/(menu)/my-service-edit")} style={styles.add} />
        </>
      ) : (
        <VisibilityPrompt />
      )}

      <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} style={styles.filter} />

      {shown.length === 0 ? (
        <Notice message={filter === "active" ? "You have no active listings." : "You have no deleted listings."} />
      ) : (
        <ListSection>
          {shown.map((service) => (
            <ListRow
              key={service.id}
              icon={service.archivedAtUtc ? "trash-outline" : "construct-outline"}
              title={service.title}
              subtitle={`${service.occupationName} · ${service.suburb}`}
              onPress={() => router.push({ pathname: "/(dashboard)/(menu)/my-service", params: { id: String(service.id) } })}
            />
          ))}
        </ListSection>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: { marginBottom: Spacing.xl },
  filter: { marginBottom: Spacing.lg },
});
