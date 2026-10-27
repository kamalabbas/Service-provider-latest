import type { Employee } from "@/interfaces/employee.interface";
import type { CreateInspectionRequest, Inspection, InspectionStatus } from "@/interfaces/inspection.interface";
import type { Profile } from "@/interfaces/profile.interface";
import type { User } from "@/interfaces/user.interface";
import { can } from "@/utility/access";
import * as yup from "yup";

export const STATUS_LABELS: Record<InspectionStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
  rated: "Rated",
};

/** Finished records can be hidden from (and restored to) this member's list. */
export const HIDEABLE_STATUSES: readonly InspectionStatus[] = ["completed", "rated", "rejected", "cancelled"];

export type InspectionRole = "requester" | "provider";

/** Decided by account IDs (JWT sub is a string), never by names or snapshots. */
export function inspectionRole(inspection: Pick<Inspection, "requesterUserId" | "providerUserId">, userId: string | null | undefined): InspectionRole | null {
  if (!userId) return null;
  if (String(inspection.requesterUserId) === userId) return "requester";
  if (String(inspection.providerUserId) === userId) return "provider";
  return null;
}

export interface InspectionActions {
  accept: boolean;
  reject: boolean;
  cancel: boolean;
  issueCode: boolean;
  complete: boolean;
  assignWorker: boolean;
  rate: boolean;
  hide: boolean;
  restore: boolean;
}

/**
 * The guide's state/action matrix. Permission never substitutes for being the
 * right participant; the server still decides.
 */
export function inspectionActions(inspection: Pick<Inspection, "status" | "isHidden" | "requesterUserId" | "providerUserId">, user: User | null | undefined): InspectionActions {
  const role = inspectionRole(inspection, user?.id);
  const manage = can(user, ["inspections.manage"]);
  const remove = can(user, ["inspections.delete"]);
  const { status } = inspection;
  const provider = role === "provider";
  const requester = role === "requester";
  const hideable = role !== null && HIDEABLE_STATUSES.includes(status);
  return {
    accept: provider && status === "pending" && manage,
    reject: provider && status === "pending" && remove,
    cancel: role !== null && (status === "pending" || status === "accepted") && remove,
    issueCode: requester && status === "accepted" && manage,
    complete: provider && status === "accepted" && manage,
    assignWorker: provider && status === "accepted" && manage,
    rate: requester && status === "completed" && manage,
    hide: hideable && !inspection.isHidden && remove,
    restore: hideable && inspection.isHidden && manage,
  };
}

/** Active roster workers whose occupation matches the inspected service. */
export const matchingEmployees = (employees: readonly Employee[], occupationCode: string) =>
  employees.filter((employee) => !employee.archivedAtUtc && employee.occupationCode === occupationCode);

/** Appointments must be in the future. */
export const isFutureAppointment = (value: Date | null | undefined, now = Date.now()) =>
  !!value && Number.isFinite(value.getTime()) && value.getTime() > now;

/** Whole seconds left before the completion code expires (never negative). */
export const secondsUntil = (expiresAtUtc: string, now = Date.now()) =>
  Math.max(0, Math.ceil((Date.parse(expiresAtUtc) - now) / 1000));

export const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export interface InspectionRequestFormValues {
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
  note: string;
}

export const INSPECTION_REQUEST_FIELDS = ["streetAddress", "suburb", "regionCode", "postalCode", "note"] as const satisfies readonly (keyof InspectionRequestFormValues)[];

/** Prefilled from the requester's profile address; the discovery location is not the visit address. */
export const inspectionRequestValues = (profile?: Profile | null): InspectionRequestFormValues => ({
  streetAddress: profile?.streetAddress ?? "",
  suburb: profile?.suburb ?? "",
  regionCode: profile?.regionCode ?? "",
  postalCode: profile?.postalCode ?? "",
  note: "",
});

const required = (label: string, max: number) => yup.string().trim().required(`Enter ${label}`).max(max, `Use at most ${max} characters`);

export const inspectionRequestSchema: yup.ObjectSchema<InspectionRequestFormValues> = yup.object({
  streetAddress: required("the street address", 255),
  suburb: required("the suburb", 100),
  regionCode: yup.string().required("Choose a state or territory"),
  postalCode: required("the postcode", 20),
  note: yup.string().trim().max(2000, "Use at most 2000 characters").defined(),
});

export const toCreateInspectionRequest = (serviceId: number, values: InspectionRequestFormValues): CreateInspectionRequest => ({
  serviceId,
  streetAddress: values.streetAddress.trim(),
  suburb: values.suburb.trim(),
  regionCode: values.regionCode,
  postalCode: values.postalCode.trim(),
  note: values.note.trim() || null,
});
