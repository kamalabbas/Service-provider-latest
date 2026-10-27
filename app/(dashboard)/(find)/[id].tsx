import { ThemedText } from "@/components/ThemedText";
import { Avatar } from "@/components/ui/Avatar";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { Radius, Spacing } from "@/constants/Theme";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useDiscoveredService } from "@/hooks/useServices";
import { useAuthStore } from "@/stores/authStore";
import { canRequestInspectionFor } from "@/utility/access";
import { resolvePublicMediaUrl } from "@/utility/apiTransport";
import { referenceLabel } from "@/utility/referenceOptions";
import { distanceText, ratingText } from "@/utility/serviceForm";
import { useLocalSearchParams } from "expo-router";
import { Image, StyleSheet, View } from "react-native";

const publicUri = (url?: string | null) => {
  if (!url?.startsWith("/")) return url ?? null;
  try { return resolvePublicMediaUrl(url); } catch { return null; }
};

// Guide 07: another member's discoverable listing. No email or phone is exposed.
export default function DiscoveredServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const { data: service, isLoading, isError } = useDiscoveredService(Number(id));
  const regions = useReferenceChoices("regions");

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the service…" /></Screen>;
  // A listing can stop being discoverable after it appeared in results.
  if (isError || !service) return <Screen hasHeader><Notice tone="warning" message="This service is no longer available." /></Screen>;

  const businessPicture = publicUri(service.businessPictureUrl);
  const distance = distanceText(service.distanceKm);
  const inspection = canRequestInspectionFor(user, service);

  return (
    <Screen hasHeader title={service.title} subtitle={distance ?? undefined}>
      {businessPicture ? <Image source={{ uri: businessPicture }} style={styles.cover} accessibilityLabel={`${service.businessName} picture`} /> : null}

      <ListSection title="Provider">
        <View style={styles.provider}>
          <Avatar name={service.providerName} uri={service.profilePictureUrl} size={48} />
          <View style={styles.providerText}>
            <ThemedText type="headline">{service.providerName}</ThemedText>
            <ThemedText type="caption" tone="muted">{service.businessName} · Membership ID {service.providerMembershipId}</ThemedText>
            <ThemedText type="caption" tone="muted">{ratingText(service.providerAverageRating, service.providerRatingCount)}</ThemedText>
          </View>
        </View>
      </ListSection>

      <ListSection title="About">
        <ListRow icon="construct-outline" title="Occupation" subtitle={service.occupationName} />
        <View style={styles.description}>
          <ThemedText>{service.description}</ThemedText>
        </View>
      </ListSection>

      <ListSection title="Locations">
        <ListRow icon="location-outline" title="Service area" subtitle={`${service.suburb}, ${referenceLabel(regions.data, service.regionCode)} (${service.latitude}, ${service.longitude})`} />
        <ListRow icon="business-outline" title="Business" subtitle={`${service.businessLatitude}, ${service.businessLongitude}`} />
      </ListSection>

      <Notice
        tone={inspection ? "info" : "warning"}
        message={inspection
          ? "This provider is available for inspection requests. Requesting one arrives with inspections."
          : service.canRequestInspection
            ? "You don't have permission to request inspections."
            : "You can't request an inspection for this service right now, for example because you already have an open request."}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", aspectRatio: 4 / 3, borderRadius: Radius.lg, marginBottom: Spacing.xl },
  provider: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg },
  providerText: { flex: 1, gap: Spacing.xxs },
  description: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
});
