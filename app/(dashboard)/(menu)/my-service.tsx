import { ThemedText } from "@/components/ThemedText";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess } from "@/hooks/useBusiness";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useArchiveMyService, useMyService } from "@/hooks/useServices";
import { useToastStore } from "@/stores/toastStore";
import { canArchiveOwnServices, canManageOwnServices } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { referenceLabel } from "@/utility/referenceOptions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

// Guide 07: one own listing. Archived listings are read-only history.
export default function MyServiceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const serviceId = Number(id);
  const showToast = useToastStore((state) => state.showToast);
  const { user, userTypeCode } = useBusinessAccess();
  const { data: service, isLoading, refetch } = useMyService(Number.isSafeInteger(serviceId) && serviceId > 0 ? serviceId : null);
  const regions = useReferenceChoices("regions");
  const archive = useArchiveMyService();
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the listing…" /></Screen>;
  if (!service) return <Screen hasHeader><Notice tone="warning" message="This listing is unavailable." /></Screen>;

  const archived = Boolean(service.archivedAtUtc);
  const archiveService = () =>
    archive.mutate(service.id, {
      onSuccess: () => {
        setConfirmArchive(false);
        showToast("The listing has been archived.", "success");
        refetch();
      },
      onError: () => refetch(),
    });

  return (
    <Screen hasHeader title={service.title}>
      {archived ? (
        <Notice
          message={`Archived ${formatLocalTimestamp(service.archivedAtUtc!)}. It no longer appears in search and can't be edited. Create a new listing if you offer this again.`}
          style={styles.notice}
        />
      ) : null}

      <ListSection title="About">
        <ListRow icon="construct-outline" title="Occupation" subtitle={service.occupationName} />
        <View style={styles.description}>
          <ThemedText>{service.description}</ThemedText>
        </View>
      </ListSection>

      <ListSection title="Listing location" footer="This is the listing's own location, separate from your business address.">
        <ListRow icon="location-outline" title="Area" subtitle={`${service.suburb}, ${referenceLabel(regions.data, service.regionCode)}`} />
        <ListRow icon="navigate-outline" title="Coordinates" subtitle={`${service.latitude}, ${service.longitude}`} />
      </ListSection>

      <ListSection>
        <ListRow icon="calendar-outline" title="Created" subtitle={formatLocalTimestamp(service.createdAtUtc)} />
        <ListRow icon="time-outline" title="Updated" subtitle={formatLocalTimestamp(service.updatedAtUtc)} />
      </ListSection>

      {archived ? null : (
        <View style={styles.actions}>
          {canManageOwnServices(user, userTypeCode) ? (
            <PrimaryButton
              title="Edit listing"
              variant="secondary"
              leftIcon="create-outline"
              onPress={() => router.push({ pathname: "/(dashboard)/(menu)/my-service-edit", params: { id: String(service.id) } })}
            />
          ) : null}
          {canArchiveOwnServices(user, userTypeCode) ? (
            <PrimaryButton title="Archive listing" variant="danger" leftIcon="archive-outline" onPress={() => setConfirmArchive(true)} />
          ) : null}
        </View>
      )}

      <ConfirmModal
        visible={confirmArchive}
        icon="archive-outline"
        tone="danger"
        title="Archive this listing?"
        message="It's removed from search and can't be edited or republished. Its history stays with your business. You can create a new listing later."
        confirmLabel="Archive"
        isLoading={archive.isPending}
        onConfirm={archiveService}
        onCancel={() => setConfirmArchive(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.xl },
  description: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  actions: { gap: Spacing.md },
});
