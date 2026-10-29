import { SelectInput } from "@/components/form/SelectInput";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useCardRequestActions, useMyCardRequests } from "@/hooks/useCardRequests";
import { useMyEmployees } from "@/hooks/useEmployees";
import { useToastStore } from "@/stores/toastStore";
import { canViewEmployees } from "@/utility/access";
import { canRequestEmployeeCard, hasOpenCardRequest } from "@/utility/cardRequestRules";
import { employeeName } from "@/utility/employeeForm";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

// Guide 11: pick an active employee to request a card for. Employees never sign in.
export default function EmployeeCardRequestScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const { user, member, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const employees = useMyEmployees({}, 100);
  const requests = useMyCardRequests({ subjectType: "employee" });
  const actions = useCardRequestActions();
  const [employeeId, setEmployeeId] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (member.isLoading || business.isLoading || employees.isLoading || requests.isLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading your team…" /></Screen>;
  }
  if (!canRequestEmployeeCard(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to request employee cards." /></Screen>;
  }
  if (!business.data) {
    return <Screen hasHeader><Notice tone="warning" message="Add your business first. Employee cards are for your active business's employees." /></Screen>;
  }
  if (!canViewEmployees(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="You need permission to view employees before you can choose one." /></Screen>;
  }
  if (employees.isError) {
    return (
      <Screen hasHeader>
        <Notice tone="error" message="Your employees couldn't be loaded." style={styles.spaced} />
        <PrimaryButton title="Try again" variant="secondary" leftIcon="refresh-outline" onPress={() => employees.refetch()} />
      </Screen>
    );
  }

  const active = (employees.data ?? []).filter((employee) => !employee.archivedAtUtc);
  const options = active.map((employee) => {
    const open = hasOpenCardRequest(requests.data ?? [], { employeeId: employee.id });
    const detail = open ? "request already open" : [employee.occupationName, employee.positionName].filter(Boolean).join(", ");
    return { label: detail ? `${employeeName(employee)} (${detail})` : employeeName(employee), value: String(employee.id), open };
  });
  const selected = active.find((employee) => String(employee.id) === employeeId) ?? null;
  const selectedOpen = options.find((option) => option.value === employeeId)?.open ?? false;

  const request = () =>
    selected && actions.requestEmployee.mutate(selected.id, {
      onSuccess: (response) => {
        showToast(`Card requested for ${employeeName(selected)}. Check the delivery address.`, "success");
        if (response.data) router.replace({ pathname: "/(dashboard)/(menu)/card-request", params: { id: String(response.data.id) } });
        else router.back();
      },
      onSettled: () => setConfirming(false),
    });

  return (
    <Screen hasHeader title="Employee card" subtitle="Choose who the card is for. It's sent to your business address by default.">
      {active.length === 0 ? (
        <>
          <Notice message="You have no active employees yet. Add one first, then come back to request their card." style={styles.spaced} />
          <PrimaryButton title="Add an employee" leftIcon="person-add-outline" onPress={() => router.push("/(dashboard)/(menu)/employee-edit")} />
        </>
      ) : (
        <>
          <SelectInput
            label="Employee"
            placeholder="Choose an employee"
            pickerLabel="Choose an employee"
            value={employeeId}
            onChange={setEmployeeId}
            options={options.map(({ label, value, open }) => ({ label, value, disabled: open }))}
            error={selectedOpen ? "This employee already has an open card request." : undefined}
          />
          <PrimaryButton
            title="Request card"
            leftIcon="card-outline"
            onPress={() => setConfirming(true)}
            disabled={!selected || selectedOpen}
          />
        </>
      )}

      <ConfirmModal
        visible={confirming && selected !== null}
        icon="card-outline"
        title={selected ? `Request a card for ${employeeName(selected)}?` : ""}
        message="An administrator reviews the request. You can change the delivery address while it's pending."
        confirmLabel="Request card"
        isLoading={actions.requestEmployee.isPending}
        onConfirm={request}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spaced: { marginBottom: Spacing.lg },
});
