import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 08 workflow states. */
export type InspectionStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed" | "rated";

/** Which side of the request the signed-in member is on; "all" lists both. */
export type InspectionSide = "all" | "requester" | "provider";

export interface InspectionAddress {
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
}

/** Snapshot shared with the requester: no phone, email or licence. */
export interface AssignedEmployee {
  id: number;
  name: string;
  occupationCode: string;
  occupationName: string;
  positionCode?: string | null;
  positionName?: string | null;
}

export interface InspectionEmployeeAssignment {
  employeeId: number;
  name: string;
  occupationCode: string;
  occupationName: string;
  positionCode?: string | null;
  positionName?: string | null;
  actorUserId: number;
  assignedAtUtc: string;
  endedAtUtc?: string | null;
  endReason?: string | null;
}

export interface InspectionEvent {
  actorUserId: number;
  action: string;
  previousStatus?: string | null;
  status: string;
  note?: string | null;
  createdAtUtc: string;
}

/** Service, provider, business and requester details are snapshots for history. */
export interface Inspection {
  id: number;
  serviceId: number;
  requesterUserId: number;
  providerUserId: number;
  businessId: number;
  serviceTitle: string;
  occupationCode: string;
  occupationName: string;
  businessName: string;
  providerName: string;
  providerMembershipId: string;
  requesterName: string;
  requesterMembershipId: string;
  requesterMobilePhone: string;
  /** Not editable after creation. */
  visitAddress: InspectionAddress;
  requestNote?: string | null;
  status: InspectionStatus;
  scheduledAtUtc?: string | null;
  acceptedAtUtc?: string | null;
  completedAtUtc?: string | null;
  ratingScore?: number | null;
  ratingNote?: string | null;
  ratedAtUtc?: string | null;
  /** This member's list copy only; the other party still sees it. */
  isHidden: boolean;
  assignedEmployee?: AssignedEmployee | null;
  /** May be empty in lists; load the detail for history. */
  employeeAssignmentHistory: InspectionEmployeeAssignment[];
  createdAtUtc: string;
  updatedAtUtc: string;
  history: InspectionEvent[];
}

/** The visit address is collected separately from the discovery location. */
export interface CreateInspectionRequest extends InspectionAddress {
  serviceId: number;
  note?: string | null;
}

export interface AcceptInspectionRequest {
  /** Future time with an explicit offset and seconds. */
  scheduledAt: string;
  employeeId?: number | null;
}

export interface InspectionReasonRequest {
  reason?: string | null;
}

/** Only the requester receives this; never store, log or put it in a URL. */
export interface InspectionCompletionCode {
  code: string;
  expiresAtUtc: string;
}

export interface CompleteInspectionRequest {
  /** Six digits held by the requester. */
  code: string;
}

/** employeeId null clears the assignment. */
export interface AssignInspectionEmployeeRequest {
  employeeId: number | null;
}

export interface RateInspectionRequest {
  /** Integer 1–5. */
  score: number;
  note?: string | null;
}

export interface InspectionVisibilityRequest {
  isHidden: boolean;
}

export interface InspectionListFilters {
  status?: InspectionStatus;
  side?: InspectionSide;
  includeHidden?: boolean;
}

export type AdminInspectionAction = "accept" | "reject" | "cancel" | "complete";

/** Admin decisions need an audit reason; accept also needs a future appointment. */
export interface AdminInspectionDecisionRequest {
  action: AdminInspectionAction;
  scheduledAt?: string | null;
  employeeId?: number | null;
  reason: string;
}

export interface AdminAssignInspectionEmployeeRequest {
  employeeId: number | null;
  reason: string;
}

export interface AdminInspectionListFilters {
  status?: InspectionStatus;
  requesterUserId?: number;
  providerUserId?: number;
}

export type InspectionResponse = ApiResponse<Inspection>;
export type InspectionPageResponse = ApiResponse<ApiPage<Inspection>>;
export type InspectionCompletionCodeResponse = ApiResponse<InspectionCompletionCode>;
