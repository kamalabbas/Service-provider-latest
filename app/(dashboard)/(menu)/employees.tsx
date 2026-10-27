import { ThemedText } from "@/components/ThemedText";
import { ListRow, ListSection } from "@/components/ui/ListSection";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spacing } from "@/constants/Theme";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useMyEmployees } from "@/hooks/useEmployees";
import { canManageEmployees, canViewEmployees } from "@/utility/access";
import { employeeName } from "@/utility/employeeForm";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";

const FILTERS = [
  { label: "Active", value: "active" },
  { label: "Include archived", value: "all" },
] as const;

// Guide 10: the business roster. Employees are records, not sign-in accounts.
export default function EmployeesScreen() {
  const router = useRouter();
  const { user, member, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const [filter, setFilter] = useState<"active" | "all">("active");
  const employees = useMyEmployees({ includeArchived: filter === "all" });

  if (member.isLoading || business.isLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading your team…" /></Screen>;
  }
  if (!canViewEmployees(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to view employees." /></Screen>;
  }

  const list = employees.data ?? [];
  const canAdd = canManageEmployees(user, userTypeCode);

  return (
    <Screen hasHeader title="Employees" subtitle="Workers you can assign to inspections. They don't sign in to the app.">
      {canAdd && business.data ? (
        <PrimaryButton title="Add an employee" leftIcon="person-add-outline" onPress={() => router.push("/(dashboard)/(menu)/employee-edit")} style={styles.spaced} />
      ) : canAdd ? (
        <Notice message="Add your business first. Employees belong to your active business." style={styles.spaced} />
      ) : null}

      <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} style={styles.spaced} />

      {employees.isLoading ? (
        <Loader visible overlay={false} message="Loading employees…" />
      ) : list.length === 0 ? (
        <Notice message={filter === "active" ? "You have no active employees." : "No employees yet."} />
      ) : (
        <>
          <ListSection>
            {list.map((employee) => (
              <ListRow
                key={employee.id}
                icon={employee.archivedAtUtc ? "archive-outline" : "person-outline"}
                title={employee.archivedAtUtc ? `${employeeName(employee)} (archived)` : employeeName(employee)}
                subtitle={[employee.occupationName, employee.positionName].filter(Boolean).join(" · ")}
                onPress={() => router.push({ pathname: "/(dashboard)/(menu)/employee", params: { id: String(employee.id) } })}
              />
            ))}
          </ListSection>
          {employees.hasNextPage ? (
            <PrimaryButton
              title={employees.isFetchingNextPage ? "Loading..." : "Show more"}
              variant="secondary"
              onPress={() => employees.fetchNextPage()}
              loading={employees.isFetchingNextPage}
              disabled={employees.isFetchingNextPage}
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
  end: { textAlign: "center" },
});
