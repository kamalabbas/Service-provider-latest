import { FormInput } from "@/components/form/FormInput";
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
import { coordinateField } from "@/utility/coordinates";
import { referenceOptions } from "@/utility/referenceOptions";
import { distanceText, ratingText } from "@/utility/serviceForm";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

const RADIUS_OPTIONS = ["10", "25", "50", "100", "250", "500"].map((value) => ({ label: `${value} km`, value }));
const ANY = "";

// Guide 07: nearby discovery. Location is entered or taken from the business until
// device location is approved; results are ordered by estimated distance.
export default function FindServicesScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const business = useMyBusiness();
  const occupations = useReferenceChoices("occupations");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("50");
  const [occupation, setOccupation] = useState(ANY);
  const [membershipId, setMembershipId] = useState("");
  const [locationError, setLocationError] = useState<string | undefined>();
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

  const runSearch = () => {
    try {
      coordinateField("latitude").validateSync(latitude);
      coordinateField("longitude").validateSync(longitude);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Enter a valid location.");
      return;
    }
    setLocationError(undefined);
    setFilters({
      latitude: Number(latitude),
      longitude: Number(longitude),
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
          {ownBusiness ? (
            <PrimaryButton
              title="Use my business location"
              variant="ghost"
              size="md"
              leftIcon="business-outline"
              onPress={() => { setLatitude(String(ownBusiness.latitude)); setLongitude(String(ownBusiness.longitude)); }}
              style={styles.spaced}
            />
          ) : null}
          <FormInput label="Latitude" value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" placeholder="-33.8688" />
          <FormInput label="Longitude" value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" placeholder="151.2093" error={locationError} />
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

      <PrimaryButton title="Search" leftIcon="search-outline" onPress={runSearch} loading={search.isFetching && !search.isFetchingNextPage} style={styles.spaced} />

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
