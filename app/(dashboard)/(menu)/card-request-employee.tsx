import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useCardRequestActions, useMyCardRequests } from "@/hooks/useCardRequests";
import { useMyEmployees } from "@/hooks/useEmployees";
import { Employee } from "@/interfaces/employee.interface";
import { useToastStore } from "@/stores/toastStore";
import { canRequestEmployeeCard, hasOpenCardRequest } from "@/utility/cardRequestRules";
import { employeeName } from "@/utility/employeeForm";
import { useRouter } from "expo-router";
import { useState } from "react";

// Guide 11: pick an active employee to request a card for. Employees never sign in.
export default function EmployeeCardRequestScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const { user, member, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const employees = useMyEmployees({}, 100);
  const requests = useMyCardRequests({ subjectType: "employee" });
  const actions = useCardRequestActions();
  const [selected, setSelected] = useState<Employee | null>(null);

  if (member.isLoading || business.isLoading || employees.isLoading || requests.isLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading your team…" /></Screen>;
  }
  if (!canRequestEmployeeCard(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to request employee cards." /></Screen>;
  }
  if (!business.data) {
    return <Screen hasHeader><Notice tone="warning" message="Add your business first. Employee cards are for your active business's employees." /></Screen>;
  }

  const active = (employees.data ?? []).filter((employee) => !employee.archivedAtUtc);

  const request = () =>
    selected && actions.requestEmployee.mutate(selected.id, {
      onSuccess: (response) => {
        showToast(`Card requested for ${employeeName(selected)}. Check the delivery address.`, "success");
        if (response.data) router.replace({ pathname: "/(dashboard)/(menu)/card-request", params: { id: String(response.data.id) } });
        else router.back();
      },
      onSettled: () => setSelected(null),
    });

  return (
    <Screen hasHeader title="Choose an employee" subtitle="The card is sent to your business address by default.">
      {active.length === 0 ? (
        <Notice message="You have no active employees. Add one under Employees first." />
      ) : (
        <ListSection>
          {active.map((employee) => {
            const open = hasOpenCardRequest(requests.data ?? [], { employeeId: employee.id });
            return (
              <ListRow
                key={employee.id}
                icon="person-outline"
                title={employeeName(employee)}
                subtitle={open ? "A request is already open" : [employee.occupationName, employee.positionName].filter(Boolean).join(" · ")}
                onPress={open ? undefined : () => setSelected(employee)}
              />
            );
          })}
        </ListSection>
      )}

      <ConfirmModal
        visible={selected !== null}
        icon="card-outline"
        title={selected ? `Request a card for ${employeeName(selected)}?` : ""}
        message="An administrator reviews the request. You can change the delivery address while it's pending."
        confirmLabel="Request card"
        isLoading={actions.requestEmployee.isPending}
        onConfirm={request}
        onCancel={() => setSelected(null)}
      />
    </Screen>
  );
}
