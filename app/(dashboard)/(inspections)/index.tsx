import { SelectInput } from "@/components/form/SelectInput";
import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spacing } from "@/constants/Theme";
import { useMyInspections } from "@/hooks/useInspections";
import { InspectionSide, InspectionStatus } from "@/interfaces/inspection.interface";
import { useAuthStore } from "@/stores/authStore";
import { canViewInspections } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { STATUS_LABELS, inspectionRole } from "@/utility/inspectionRules";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

const SIDES = [
  { label: "All", value: "all" },
  { label: "I requested", value: "requester" },
  { label: "For my business", value: "provider" },
] as const;

const ANY = "";
const STATUS_OPTIONS = [{ label: "Any status", value: ANY }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value }))];

// Guide 08: requester and provider inspections, with filters and hidden copies.
export default function InspectionsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "borderColor");
  const [side, setSide] = useState<InspectionSide>("all");
  const [status, setStatus] = useState(ANY);
  const [includeHidden, setIncludeHidden] = useState(false);
  const inspections = useMyInspections({ side, status: (status || undefined) as InspectionStatus | undefined, includeHidden });

  // Other parties act on these; refresh when returning to the tab.
  useFocusEffect(useCallback(() => {
    inspections.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  if (!canViewInspections(user)) {
    return <Screen title="Inspections"><Notice tone="warning" message="You don't have permission to view inspections." /></Screen>;
  }

  const list = inspections.data ?? [];

  return (
    <Screen title="Inspections" subtitle="Requests you've made and requests for your business.">
      <SegmentedControl options={SIDES} value={side} onChange={setSide} style={styles.spaced} />
      <SelectInput label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
      <View style={styles.switchRow}>
        <ThemedText style={styles.switchLabel}>Show hidden</ThemedText>
        <Switch value={includeHidden} onValueChange={setIncludeHidden} trackColor={{ true: tint, false: border }} accessibilityLabel="Show hidden inspections" />
      </View>

      {inspections.isLoading ? (
        <Loader visible overlay={false} message="Loading inspections…" />
      ) : list.length === 0 ? (
        <Notice message="No inspections here yet. Find a service to request one." />
      ) : (
        <>
          <ListSection>
            {list.map((inspection) => {
              const role = inspectionRole(inspection, user?.id);
              const other = role === "provider" ? inspection.requesterName : inspection.businessName;
              const when = inspection.scheduledAtUtc ? ` · ${formatLocalTimestamp(inspection.scheduledAtUtc)}` : "";
              return (
                <ListRow
                  key={inspection.id}
                  icon={role === "provider" ? "briefcase-outline" : "clipboard-outline"}
                  title={inspection.serviceTitle}
                  subtitle={`${STATUS_LABELS[inspection.status] ?? inspection.status}${inspection.isHidden ? " (hidden)" : ""} · ${other}${when}`}
                  onPress={() => router.push({ pathname: "/(dashboard)/(inspections)/[id]", params: { id: String(inspection.id) } })}
                />
              );
            })}
          </ListSection>
          {inspections.hasNextPage ? (
            <PrimaryButton
              title={inspections.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => inspections.fetchNextPage()}
              loading={inspections.isFetchingNextPage}
              disabled={inspections.isFetchingNextPage}
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
  spaced: { marginBottom: Spacing.lg },
  switchRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.lg },
  switchLabel: { flex: 1 },
  end: { textAlign: "center" },
});
