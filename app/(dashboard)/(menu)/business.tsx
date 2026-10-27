import { ThemedText } from "@/components/ThemedText";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PicturePicker } from "@/components/ui/PicturePicker";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useArchiveMyBusiness, useBusinessAccess, useMyBusiness, useUploadMyBusinessPicture } from "@/hooks/useBusiness";
import { useReferenceChoices } from "@/hooks/useReferenceChoices";
import { useToastStore } from "@/stores/toastStore";
import { BUSINESS_USER_TYPES, canArchiveOwnBusiness, canManageOwnBusiness, canViewOwnBusiness } from "@/utility/access";
import { formatRegistrationNumber } from "@/utility/businessForm";
import { referenceLabel } from "@/utility/referenceOptions";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

const ARCHIVE_EFFECTS =
  "Your service listings and employee roster are archived, accepted worker assignments may be cleared, and related employee card requests and cards are cancelled. " +
  "Price contributions stop and pending quotes for this business can no longer be accepted. Clients, inspections, quotes and history stay with this business. " +
  "You can create a new business later, but it won't inherit the old roster or clients.";

// Guide 05: "My business": empty state, details, picture and archive.
export default function BusinessScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const { user, member, userTypeCode } = useBusinessAccess();
  const { data: business, isLoading, refetch } = useMyBusiness();
  const regions = useReferenceChoices("regions");
  const upload = useUploadMyBusinessPicture();
  const archive = useArchiveMyBusiness();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const canManage = canManageOwnBusiness(user, userTypeCode);

  if (member.isLoading || isLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading your business…" /></Screen>;
  }
  if (!userTypeCode || !BUSINESS_USER_TYPES.includes(userTypeCode)) {
    return <Screen hasHeader><Notice message="Business details are available to tradespeople, builders and developers." /></Screen>;
  }
  if (!canViewOwnBusiness(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view business details." /></Screen>;
  }

  if (!business) {
    return (
      <Screen hasHeader title="My business" subtitle="Add your business so customers can find your services.">
        <Notice message="You don't have an active business yet." style={styles.notice} />
        {canManage ? (
          <PrimaryButton title="Add your business" leftIcon="add-circle-outline" onPress={() => router.push("/(dashboard)/(menu)/business-edit")} />
        ) : (
          <Notice tone="warning" message="You don't have permission to add a business." />
        )}
      </Screen>
    );
  }

  const archiveBusiness = () =>
    archive.mutate(undefined, {
      onSuccess: () => {
        setConfirmArchive(false);
        showToast("Your business has been archived.", "success");
      },
      // A failed or timed-out archive may still have landed; show the server's state.
      onError: () => refetch(),
    });

  const address = `${business.streetAddress}, ${business.suburb} ${referenceLabel(regions.data, business.regionCode)} ${business.postalCode}`;

  return (
    <Screen hasHeader title={business.businessName}>
      <PicturePicker
        shape="cover"
        pictureUrl={business.pictureUrl}
        canUpload={canManage}
        uploading={upload.isPending}
        onUpload={upload.mutateAsync}
        successMessage="Business picture updated."
      />

      <ListSection title="Registration" footer="ABN and ACN checksums are checked; that doesn't confirm registration or ownership.">
        <ListRow icon="document-text-outline" title="ABN" subtitle={formatRegistrationNumber(business.abn)} />
        {business.acn ? <ListRow icon="document-outline" title="ACN" subtitle={formatRegistrationNumber(business.acn)} /> : null}
      </ListSection>

      <ListSection title="Contact">
        <ListRow icon="call-outline" title="Phone" subtitle={business.phone || "Not provided"} />
        <ListRow icon="phone-portrait-outline" title="Mobile" subtitle={business.mobilePhone || "Not provided"} />
      </ListSection>

      <ListSection title="Location">
        <ListRow icon="location-outline" title="Address" subtitle={address} />
        <ListRow icon="navigate-outline" title="Coordinates" subtitle={`${business.latitude}, ${business.longitude}`} />
      </ListSection>

      <View style={styles.actions}>
        {canManage ? (
          <PrimaryButton title="Edit details" variant="secondary" leftIcon="create-outline" onPress={() => router.push("/(dashboard)/(menu)/business-edit")} />
        ) : (
          <ThemedText type="footnote" tone="muted" style={styles.readOnly}>You can view this business but not change it.</ThemedText>
        )}
        {canArchiveOwnBusiness(user, userTypeCode) ? (
          <PrimaryButton title="Archive business" variant="danger" leftIcon="archive-outline" onPress={() => setConfirmArchive(true)} />
        ) : null}
      </View>

      <ConfirmModal
        visible={confirmArchive}
        icon="archive-outline"
        tone="danger"
        title="Archive this business?"
        message={ARCHIVE_EFFECTS}
        confirmLabel="Archive"
        isLoading={archive.isPending}
        onConfirm={archiveBusiness}
        onCancel={() => setConfirmArchive(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.xl },
  actions: { gap: Spacing.md },
  readOnly: { textAlign: "center" },
});
