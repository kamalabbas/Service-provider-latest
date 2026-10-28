import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 11. "accepted" is shown as "Approved"; it doesn't create or dispatch a card. */
export type CardRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type CardSubjectType = "personal" | "employee";

export type CardReplacementReason = "expired" | "damaged" | "lost";

/** All four Australian address fields are required. */
export interface CardDeliveryAddress {
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
}

export interface CardRequestEvent {
  actorUserId?: number | null;
  action: string;
  previousStatus?: string | null;
  status: string;
  note?: string | null;
  createdAtUtc: string;
}

/** Subject name, membership and employee occupation are snapshots. */
export interface CardRequest {
  id: number;
  ownerUserId: number;
  subjectType: CardSubjectType;
  employeeId?: number | null;
  businessId?: number | null;
  subjectName: string;
  membershipId?: string | null;
  employeeOccupationCode?: string | null;
  employeeOccupationName?: string | null;
  previousCardId?: number | null;
  replacementReason?: CardReplacementReason | null;
  /** Editable by the owner only while pending; later profile/business changes don't rewrite it. */
  deliveryAddress?: CardDeliveryAddress | null;
  /** Approval from the earlier feature; history only. */
  legacyApproval: boolean;
  fulfillmentClosedAtUtc?: string | null;
  cardId?: number | null;
  status: CardRequestStatus;
  decisionReason?: string | null;
  decidedByUserId?: number | null;
  decidedAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  history: CardRequestEvent[];
}

/** Employee route only; the personal route has no body. */
export interface CreateEmployeeCardRequest {
  employeeId: number;
}

export interface CardRequestListFilters {
  status?: CardRequestStatus;
  subjectType?: CardSubjectType;
}

/** Previous card and replacement reason go together or not at all. */
export interface AdminCreateCardRequest {
  employeeId?: number | null;
  previousCardId?: number | null;
  replacementReason?: CardReplacementReason | null;
}

/** Rejection needs a nonblank reason; acceptance may include one. */
export interface AdminCardDecisionRequest {
  action: "accept" | "reject";
  reason?: string | null;
}

export interface AdminCancelCardRequest {
  reason: string;
}

export interface AdminCardRequestListFilters extends CardRequestListFilters {
  ownerUserId?: number;
}

export type CardRequestResponse = ApiResponse<CardRequest>;
export type CardRequestPageResponse = ApiResponse<ApiPage<CardRequest>>;
