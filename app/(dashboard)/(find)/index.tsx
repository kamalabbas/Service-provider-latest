import { FormInput } from "@/components/form/FormInput";
import { LocationPicker } from "@/components/form/LocationPicker";
import { SelectInput } from "@/components/form/SelectInput";
import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useMyBusiness } from "@/hooks/useBusiness";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useServiceSearch } from "@/hooks/useServices";
import { ServiceSearchFilters } from "@/interfaces/service.interface";
import { useAuthStore } from "@/stores/authStore";
import { canViewServices } from "@/utility/access";
import { Coordinates } from "@/utility/coordinates";
import { referenceOptions } from "@/utility/referenceOptions";
import { distanceText, ratingText } from "@/utility/serviceForm";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

const RADIUS_OPTIONS = ["10", "25", "50", "100", "250", "500"].map((value) => ({ label: `${value} km`, value }));
const ANY = "";

// Guide 07: nearby discovery. Searches from the device location when allowed;
// otherwise the member places the pin. Results are ordered by estimated distance.
export default function FindServicesScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const business = useMyBusiness();
  const occupations = useReferenceChoices("occupations");
  const [point, setPoint] = useState<Coordinates | null>(null);
  const [radius, setRadius] = useState("50");
  const [occupation, setOccupation] = useState(ANY);
  const [membershipId, setMembershipId] = useState("");
  const [filters, setFilters] = useState<ServiceSearchFilters | null>(null);
  const search = useServiceSearch(filters);

  // Listings change elsewhere; refresh results when returning to this tab.
  useFocusEffect(useCallback(() => {
    if (filters) search.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]));

  if (!canViewServices(user)) {
    return <Screen title="Find services"><Notice tone="warning" message="You don't have permission to search services." /></Screen>;
  }

  const runSearch = (at: Coordinates | null = point) => {
    if (!at) return;
    setFilters({
      latitude: at.latitude,
      longitude: at.longitude,
      radiusKm: Number(radius),
      occupationCode: occupation || undefined,
      membershipId: membershipId.trim() || undefined,
    });
  };

  const ownBusiness = business.data;
  const results = search.data ?? [];

  return (
    <Screen title="Find services" subtitle="Search for providers near a location.">
      <ListSection title="Location">
        <View style={styles.form}>
          <LocationPicker
            value={point}
            locateOnMount
            onChange={(next) => {
              setPoint(next);
              // The first location found searches straight away; later moves wait for Search.
              if (!filters) runSearch(next);
            }}
          />
          {ownBusiness ? (
            <PrimaryButton
              title="Use my business location"
              variant="ghost"
              size="md"
              leftIcon="business-outline"
              onPress={() => setPoint({ latitude: ownBusiness.latitude, longitude: ownBusiness.longitude })}
              style={styles.spaced}
            />
          ) : null}
          <SelectInput label="Within" value={radius} onChange={setRadius} options={RADIUS_OPTIONS} />
        </View>
      </ListSection>

      <ListSection title="Filters (optional)">
        <View style={styles.form}>
          <SelectInput
            label="Occupation"
            value={occupation}
            onChange={setOccupation}
            options={[{ label: "Any occupation", value: ANY }, ...referenceOptions(occupations.data)]}
            loading={occupations.isLoading}
          />
          <FormInput label="Membership ID" value={membershipId} onChangeText={setMembershipId} autoCapitalize="characters" placeholder="e.g. T100000" />
        </View>
      </ListSection>

      <PrimaryButton title="Search" leftIcon="search-outline" onPress={() => runSearch()} disabled={!point} loading={search.isFetching && !search.isFetchingNextPage} style={styles.spaced} />

      {filters === null ? null : search.isLoading ? (
        <Loader visible overlay={false} message="Searching…" />
      ) : results.length === 0 ? (
        <Notice message="No services found. Try a larger distance or fewer filters." />
      ) : (
        <>
          <ListSection title="Results" footer="Distances are estimated in a straight line, not by road.">
            {results.map((service) => (
              <ListRow
                key={service.id}
                icon="construct-outline"
                title={service.title}
                subtitle={[service.businessName, service.occupationName, distanceText(service.distanceKm), ratingText(service.providerAverageRating, service.providerRatingCount)]
                  .filter(Boolean).join(" · ")}
                onPress={() => router.push({ pathname: "/(dashboard)/(find)/[id]", params: { id: String(service.id) } })}
              />
            ))}
          </ListSection>
          {search.hasNextPage ? (
            <PrimaryButton
              title={search.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => search.fetchNextPage()}
              loading={search.isFetchingNextPage}
              disabled={search.isFetchingNextPage}
            />
          ) : (
            <ThemedText type="footnote" tone="muted" style={styles.end}>End of results.</ThemedText>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { padding: Spacing.lg, paddingBottom: 0 },
  spaced: { marginBottom: Spacing.lg },
  end: { textAlign: "center" },
});
