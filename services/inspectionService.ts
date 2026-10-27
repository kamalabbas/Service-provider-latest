import {
  AcceptInspectionRequest,
  AdminAssignInspectionEmployeeRequest,
  AdminInspectionDecisionRequest,
  AdminInspectionListFilters,
  AssignInspectionEmployeeRequest,
  CompleteInspectionRequest,
  CreateInspectionRequest,
  InspectionCompletionCodeResponse,
  InspectionListFilters,
  InspectionPageResponse,
  InspectionReasonRequest,
  InspectionResponse,
  InspectionVisibilityRequest,
  RateInspectionRequest,
} from "@/interfaces/inspection.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId, toUtcTimestamp } from "@/utility/apiValues";
import { getData, postData, putData } from "./api";

const path = (inspectionId: number, action = "") => `/api/inspections/${requireDatabaseId(inspectionId)}${action}`;
const adminPath = (inspectionId: number, action = "") => `/api/admin/inspections/${requireDatabaseId(inspectionId)}${action}`;

/** Only set filters are sent; the server defaults to side "all" and hides hidden copies. */
export const inspectionListParams = (filters: InspectionListFilters = {}, page = 1, pageSize = 20) => ({
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.side && filters.side !== "all" ? { side: filters.side } : {}),
  ...(filters.includeHidden ? { includeHidden: true } : {}),
  ...pageParams(page, pageSize),
});

const optionalEmployee = (employeeId?: number | null) => (employeeId == null ? null : requireDatabaseId(employeeId));

/** Appointments must carry an explicit offset and seconds; this also normalizes a Date. */
const appointment = (scheduledAt: string | Date) => toUtcTimestamp(scheduledAt);

// Guide 08: the member's inspections, as requester or provider.
export const listMyInspections = (filters: InspectionListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<InspectionPageResponse>("/api/inspections/me", { params: inspectionListParams(filters, page, pageSize), signal });

export const getInspection = (inspectionId: number, signal?: AbortSignal) =>
  getData<InspectionResponse>(path(inspectionId), { signal });

/** One pending/accepted request per requester and service; the server enforces it. */
export const createInspection = (body: CreateInspectionRequest) =>
  postData<CreateInspectionRequest, InspectionResponse>("/api/inspections", { ...body, serviceId: requireDatabaseId(body.serviceId) });

/** Provider, pending only. An invalid employee leaves the request pending. */
export const acceptInspection = (inspectionId: number, body: AcceptInspectionRequest) =>
  postData<AcceptInspectionRequest, InspectionResponse>(path(inspectionId, "/accept"), {
    scheduledAt: appointment(body.scheduledAt),
    employeeId: optionalEmployee(body.employeeId),
  });

export const rejectInspection = (inspectionId: number, body: InspectionReasonRequest = {}) =>
  postData<InspectionReasonRequest, InspectionResponse>(path(inspectionId, "/reject"), { reason: body.reason?.trim() || null });

export const cancelInspection = (inspectionId: number, body: InspectionReasonRequest = {}) =>
  postData<InspectionReasonRequest, InspectionResponse>(path(inspectionId, "/cancel"), { reason: body.reason?.trim() || null });

/** Requester, accepted only. Reissuing replaces (and invalidates) the previous code. */
export const issueCompletionCode = (inspectionId: number) =>
  postData<undefined, InspectionCompletionCodeResponse>(path(inspectionId, "/completion-code"), undefined);

/** Provider submits the requester's code. Wrong attempts count even when this fails. */
export const completeInspection = (inspectionId: number, body: CompleteInspectionRequest) => {
  if (!/^\d{6}$/.test(body.code)) throw new RangeError("Enter the 6-digit code from the customer.");
  return postData<CompleteInspectionRequest, InspectionResponse>(path(inspectionId, "/complete"), body);
};

/** Provider, accepted only. null clears the worker. */
export const assignInspectionEmployee = (inspectionId: number, employeeId: number | null) =>
  putData<AssignInspectionEmployeeRequest, InspectionResponse>(path(inspectionId, "/employee"), { employeeId: optionalEmployee(employeeId) });

/** Requester, once, after completion. */
export const rateInspection = (inspectionId: number, body: RateInspectionRequest) => {
  if (!Number.isInteger(body.score) || body.score < 1 || body.score > 5) throw new RangeError("Choose a rating from 1 to 5.");
  return postData<RateInspectionRequest, InspectionResponse>(path(inspectionId, "/rating"), { score: body.score, note: body.note?.trim() || null });
};

/** Hides or restores only this member's list copy of a finished request. */
export const setInspectionHidden = (inspectionId: number, isHidden: boolean) =>
  putData<InspectionVisibilityRequest, InspectionResponse>(path(inspectionId, "/visibility"), { isHidden });

// Admin (guide 19): SuperAdmin inspections. Decisions record the actual administrator.
export const adminListInspections = (filters: AdminInspectionListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<InspectionPageResponse>("/api/admin/inspections", {
    params: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.requesterUserId !== undefined ? { requesterUserId: requireDatabaseId(filters.requesterUserId) } : {}),
      ...(filters.providerUserId !== undefined ? { providerUserId: requireDatabaseId(filters.providerUserId) } : {}),
      ...pageParams(page, pageSize),
    },
    signal,
  });

export const adminGetInspection = (inspectionId: number, signal?: AbortSignal) =>
  getData<InspectionResponse>(adminPath(inspectionId), { signal });

export const adminCreateInspectionForRequester = (requesterUserId: number, body: CreateInspectionRequest) =>
  postData<CreateInspectionRequest, InspectionResponse>(`/api/admin/inspections/users/${requireDatabaseId(requesterUserId)}`, {
    ...body, serviceId: requireDatabaseId(body.serviceId),
  });

export const adminDecideInspection = (inspectionId: number, body: AdminInspectionDecisionRequest) => {
  if (!body.reason.trim()) throw new Error("An audit reason is required.");
  if (body.action === "accept" && !body.scheduledAt) throw new Error("Acceptance needs an appointment time.");
  return postData<AdminInspectionDecisionRequest, InspectionResponse>(adminPath(inspectionId, "/decision"), {
    ...body,
    reason: body.reason.trim(),
    scheduledAt: body.scheduledAt ? appointment(body.scheduledAt) : null,
    employeeId: optionalEmployee(body.employeeId),
  });
};

export const adminAssignInspectionEmployee = (inspectionId: number, body: AdminAssignInspectionEmployeeRequest) => {
  if (!body.reason.trim()) throw new Error("An audit reason is required.");
  return putData<AdminAssignInspectionEmployeeRequest, InspectionResponse>(adminPath(inspectionId, "/employee"), {
    employeeId: optionalEmployee(body.employeeId), reason: body.reason.trim(),
  });
};

export const adminRateInspection = (inspectionId: number, body: RateInspectionRequest) =>
  postData<RateInspectionRequest, InspectionResponse>(adminPath(inspectionId, "/rating"), body);
