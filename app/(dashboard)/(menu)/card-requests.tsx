import { ThemedText } from "@/components/ThemedText";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useCardRequestActions, useMyCardRequests } from "@/hooks/useCardRequests";
import { useToastStore } from "@/stores/toastStore";
import { canViewCardRequests } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { CARD_REQUEST_STATUS_LABELS, canRequestEmployeeCard, canRequestPersonalCard, hasOpenCardRequest } from "@/utility/cardRequestRules";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

const SUBJECTS = [
  { label: "All", value: "all" },
  { label: "Mine", value: "personal" },
  { label: "Employees", value: "employee" },
] as const;

// Guide 11: membership card requests for the member and their employees.
export default function CardRequestsScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const { user, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const [subject, setSubject] = useState<"all" | "personal" | "employee">("all");
  const requests = useMyCardRequests(subject === "all" ? {} : { subjectType: subject });
  // Checked against personal requests whatever filter is shown; the server still decides.
  const personal = useMyCardRequests({ subjectType: "personal" });
  const actions = useCardRequestActions();
  const [confirmPersonal, setConfirmPersonal] = useState(false);

  if (!canViewCardRequests(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view card requests." /></Screen>;
  }

  const list = requests.data ?? [];
  const showPersonal = canRequestPersonalCard(user) && !personal.isLoading && !hasOpenCardRequest(personal.data ?? [], {});
  const showEmployee = canRequestEmployeeCard(user, userTypeCode) && !!business.data;

  const requestPersonal = () =>
    actions.requestPersonal.mutate(undefined, {
      onSuccess: (response) => {
        setConfirmPersonal(false);
        showToast("Card requested. Check the delivery address.", "success");
        if (response.data) router.push({ pathname: "/(dashboard)/(menu)/card-request", params: { id: String(response.data.id) } });
      },
      onError: () => setConfirmPersonal(false),
    });

  return (
    <Screen hasHeader title="Membership cards" subtitle="Request a physical card for yourself or an employee. An administrator reviews each request.">
      <View style={styles.actions}>
        {showPersonal ? <PrimaryButton title="Request my card" leftIcon="card-outline" onPress={() => setConfirmPersonal(true)} /> : null}
        {showEmployee ? (
          <PrimaryButton title="Request for an employee" variant="secondary" leftIcon="people-outline" onPress={() => router.push("/(dashboard)/(menu)/card-request-employee")} />
        ) : null}
      </View>

      <SegmentedControl options={SUBJECTS} value={subject} onChange={setSubject} style={styles.spaced} />

      {requests.isLoading ? (
        <Loader visible overlay={false} message="Loading card requests…" />
      ) : list.length === 0 ? (
        <Notice message="No card requests yet." />
      ) : (
        <>
          <ListSection>
            {list.map((request) => (
              <ListRow
                key={request.id}
                icon={request.subjectType === "employee" ? "people-outline" : "card-outline"}
                title={request.subjectName}
                subtitle={`${CARD_REQUEST_STATUS_LABELS[request.status] ?? request.status} · ${formatLocalTimestamp(request.createdAtUtc)}`}
                onPress={() => router.push({ pathname: "/(dashboard)/(menu)/card-request", params: { id: String(request.id) } })}
              />
            ))}
          </ListSection>
          {requests.hasNextPage ? (
            <PrimaryButton
              title={requests.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => requests.fetchNextPage()}
              loading={requests.isFetchingNextPage}
              disabled={requests.isFetchingNextPage}
            />
          ) : (
            <ThemedText type="footnote" tone="muted" style={styles.end}>End of list.</ThemedText>
          )}
        </>
      )}

      <ConfirmModal
        visible={confirmPersonal}
        icon="card-outline"
        title="Request your membership card?"
        message="It's sent to your profile's postal address by default; you can change the address while the request is pending."
        confirmLabel="Request card"
        isLoading={actions.requestPersonal.isPending}
        onConfirm={requestPersonal}
        onCancel={() => setConfirmPersonal(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.md, marginBottom: Spacing.lg },
  spaced: { marginBottom: Spacing.lg },
  end: { textAlign: "center" },
});
