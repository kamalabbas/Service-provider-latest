import { FormInput } from "@/components/form/FormInput";
import { SelectInput } from "@/components/form/SelectInput";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { useBusinessAccess, useMyBusiness } from "@/hooks/useBusiness";
import { useMyEmployee, useSaveMyEmployee } from "@/hooks/useEmployees";
import { useInvalidateReferenceChoices, useReferenceChoices } from "@/hooks/useReferenceChoices";
import { Employee } from "@/interfaces/employee.interface";
import { mapApiValidation, toAppError } from "@/services/apiError";
import { useToastStore } from "@/stores/toastStore";
import { canManageEmployees } from "@/utility/access";
import { EMPLOYEE_FIELDS, EmployeeFormValues, employeeFormValues, employeeSchema, toSaveEmployeeRequest } from "@/utility/employeeForm";
import { referenceOptions } from "@/utility/referenceOptions";
import { yupResolver } from "@hookform/resolvers/yup";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ComponentProps } from "react";
import { Controller, useForm } from "react-hook-form";

const NO_POSITION = "";

// Guide 10: add (POST to the active business) or edit (full replacement PUT) an employee.
export default function EmployeeEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const employeeId = id && Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : null;
  const { user, member, userTypeCode } = useBusinessAccess();
  const business = useMyBusiness();
  const employee = useMyEmployee(employeeId);

  if (member.isLoading || business.isLoading || employee.isLoading) {
    return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;
  }
  if (!canManageEmployees(user, userTypeCode)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to change employees." /></Screen>;
  }
  if (!business.data) {
    return <Screen hasHeader><Notice tone="warning" message="Add your business first. Employees belong to your active business." /></Screen>;
  }
  if (employeeId !== null && (!employee.data || employee.data.archivedAtUtc)) {
    return <Screen hasHeader><Notice tone="warning" message="Archived employees can't be edited." /></Screen>;
  }
  return <EmployeeForm key={employee.data?.id ?? "new"} employee={employee.data ?? null} />;
}

function EmployeeForm({ employee }: { employee: Employee | null }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const occupations = useReferenceChoices("occupations");
  const positions = useReferenceChoices("employee-positions");
  const invalidateChoices = useInvalidateReferenceChoices();
  const save = useSaveMyEmployee(employee?.id ?? null);

  const { control, handleSubmit, setError, formState: { errors } } = useForm<EmployeeFormValues>({
    resolver: yupResolver(employeeSchema),
    defaultValues: employeeFormValues(employee),
  });
  // Retired saved choices stay visible while unchanged; new selections must be active.
  const occupationOptions = referenceOptions(occupations.data, employee?.occupationCode);
  const positionOptions = [{ label: "No position", value: NO_POSITION }, ...referenceOptions(positions.data, employee?.positionCode)];

  const onSubmit = (values: EmployeeFormValues) => {
    if (save.isPending) return;
    save.mutate(toSaveEmployeeRequest(values), {
      onSuccess: (response) => {
        const name = response.data ? `${response.data.firstName} ${response.data.lastName}` : "The employee";
        showToast(employee ? `${name}'s details have been saved.` : `${name} has been added.`, "success");
        router.back();
      },
      onError: (error) => {
        if (toAppError(error).status === 400) invalidateChoices();
        const { fieldErrors } = mapApiValidation(error, EMPLOYEE_FIELDS);
        EMPLOYEE_FIELDS.forEach((field) => {
          if (fieldErrors[field]) setError(field, { message: fieldErrors[field] });
        });
      },
    });
  };

  const text = (name: "firstName" | "lastName" | "phone" | "email" | "licence", label: string, extra: Partial<ComponentProps<typeof FormInput>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <FormInput label={label} value={value} onChangeText={onChange} onBlur={onBlur} error={errors[name]?.message} {...extra} />
      )}
    />
  );

  const select = (name: "occupationCode" | "positionCode", label: string, options: typeof occupationOptions, loading: boolean, placeholder: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <SelectInput label={label} placeholder={placeholder} value={value} onChange={onChange} options={options} loading={loading} error={errors[name]?.message} />
      )}
    />
  );

  return (
    <Screen hasHeader title={employee ? "Edit employee" : "Add an employee"} subtitle="Employees don't get an app account or password.">
      {text("firstName", "First name")}
      {text("lastName", "Last name")}
      {text("phone", "Phone", { keyboardType: "phone-pad" })}
      {text("email", "Email (optional)", {
        keyboardType: "email-address", autoCapitalize: "none",
        helperText: "Must not be used by another active employee in any business.",
      })}
      {select("occupationCode", "Occupation", occupationOptions, occupations.isLoading, "Choose an occupation")}
      {select("positionCode", "Position (optional)", positionOptions, positions.isLoading, "No position")}
      {text("licence", "Licence (optional)")}

      <PrimaryButton
        title={save.isPending ? "Saving..." : employee ? "Save changes" : "Add employee"}
        onPress={handleSubmit(onSubmit)}
        disabled={save.isPending}
        loading={save.isPending}
      />
    </Screen>
  );
}
