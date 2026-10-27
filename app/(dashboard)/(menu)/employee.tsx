import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess } from "@/hooks/useBusiness";
import { useArchiveMyEmployee, useMyEmployee } from "@/hooks/useEmployees";
import { useToastStore } from "@/stores/toastStore";
import { canArchiveEmployees, canManageEmployees } from "@/utility/access";
import { formatLocalTimestamp } from "@/utility/apiValues";
import { employeeName } from "@/utility/employeeForm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

// Guide 10: one roster record, active or archived.
export default function EmployeeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const employeeId = Number(id);
  const showToast = useToastStore((state) => state.showToast);
  const { user, userTypeCode } = useBusinessAccess();
  const { data: employee, isLoading, refetch } = useMyEmployee(Number.isSafeInteger(employeeId) && employeeId > 0 ? employeeId : null);
  const archive = useArchiveMyEmployee();
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading the employee…" /></Screen>;
  if (!employee) return <Screen hasHeader><Notice tone="warning" message="This employee is unavailable." /></Screen>;

  const archived = Boolean(employee.archivedAtUtc);
  const archiveEmployee = () =>
    archive.mutate(employee.id, {
      onSuccess: () => {
        setConfirmArchive(false);
        showToast(`${employeeName(employee)} has been archived.`, "success");
      },
      onError: () => refetch(),
    });

  return (
    <Screen hasHeader title={employeeName(employee)} subtitle={employee.positionName ?? undefined}>
      {archived ? (
        <Notice
          message={`Archived ${formatLocalTimestamp(employee.archivedAtUtc!)}. Archived employees can't be assigned to inspections or receive cards.`}
          style={styles.notice}
        />
      ) : null}

      <ListSection title="Work">
        <ListRow icon="construct-outline" title="Occupation" subtitle={employee.occupationName} />
        <ListRow icon="briefcase-outline" title="Position" subtitle={employee.positionName ?? "Not set"} />
        <ListRow icon="ribbon-outline" title="Licence" subtitle={employee.licence || "Not provided"} />
      </ListSection>

      <ListSection title="Contact">
        <ListRow icon="call-outline" title="Phone" subtitle={employee.phone} />
        <ListRow icon="mail-outline" title="Email" subtitle={employee.email || "Not provided"} />
      </ListSection>

      <ListSection footer="Inspection requesters see only the name, occupation and position. Editing doesn't change existing assignments; reassign to share updated details.">
        <ListRow icon="calendar-outline" title="Added" subtitle={formatLocalTimestamp(employee.createdAtUtc)} />
        <ListRow icon="time-outline" title="Updated" subtitle={formatLocalTimestamp(employee.updatedAtUtc)} />
      </ListSection>

      {archived ? null : (
        <View style={styles.actions}>
          {canManageEmployees(user, userTypeCode) ? (
            <PrimaryButton
              title="Edit details"
              variant="secondary"
              leftIcon="create-outline"
              onPress={() => router.push({ pathname: "/(dashboard)/(menu)/employee-edit", params: { id: String(employee.id) } })}
            />
          ) : null}
          {canArchiveEmployees(user, userTypeCode) ? (
            <PrimaryButton title="Archive employee" variant="danger" leftIcon="archive-outline" onPress={() => setConfirmArchive(true)} />
          ) : null}
        </View>
      )}

      <ConfirmModal
        visible={confirmArchive}
        icon="archive-outline"
        tone="danger"
        title={`Archive ${employeeName(employee)}?`}
        message="Their record is kept as history. Accepted inspection assignments may be cleared, and their pending card requests and cards cancelled or invalidated. Archived employees can't be assigned again."
        confirmLabel="Archive"
        isLoading={archive.isPending}
        onConfirm={archiveEmployee}
        onCancel={() => setConfirmArchive(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.xl },
  actions: { gap: Spacing.md },
});
