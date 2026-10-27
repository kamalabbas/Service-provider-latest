import type { Employee, SaveEmployeeRequest } from "@/interfaces/employee.interface";
import * as yup from "yup";

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  occupationCode: string;
  positionCode: string;
  licence: string;
}

export const EMPLOYEE_FIELDS = [
  "firstName", "lastName", "phone", "email", "occupationCode", "positionCode", "licence",
] as const satisfies readonly (keyof EmployeeFormValues)[];

export function employeeFormValues(employee?: Employee | null): EmployeeFormValues {
  return {
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    phone: employee?.phone ?? "",
    email: employee?.email ?? "",
    occupationCode: employee?.occupationCode ?? "",
    positionCode: employee?.positionCode ?? "",
    licence: employee?.licence ?? "",
  };
}

const PHONE = /^(?=.*\d)\+?[0-9 ()-]+$/;
const required = (label: string, max: number) => yup.string().trim().required(`Enter ${label}`).max(max, `Use at most ${max} characters`);
const optional = (max: number) => yup.string().trim().max(max, `Use at most ${max} characters`).defined();

/** Mirrors SaveEmployeeRequest. Email uniqueness is checked by the server. */
export const employeeSchema: yup.ObjectSchema<EmployeeFormValues> = yup.object({
  firstName: required("a first name", 100),
  lastName: required("a last name", 100),
  phone: required("a phone number", 30).matches(PHONE, "Enter a valid phone number"),
  email: optional(254).email("Enter a valid email address"),
  occupationCode: yup.string().required("Choose an occupation"),
  positionCode: optional(80),
  licence: optional(255),
});

const optionalText = (value: string) => value.trim() || null;

/** The complete record; optional fields left blank are sent as null on create and update alike. */
export function toSaveEmployeeRequest(values: EmployeeFormValues): SaveEmployeeRequest {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim(),
    email: optionalText(values.email),
    occupationCode: values.occupationCode,
    positionCode: values.positionCode || null,
    licence: optionalText(values.licence),
  };
}

export const employeeName = (employee: Pick<Employee, "firstName" | "lastName">) => `${employee.firstName} ${employee.lastName}`;
