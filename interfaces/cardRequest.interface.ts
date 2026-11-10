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
/** Guide 22: how a request was funded. */
export type CardFundingSource = "paid" | "allowance" | "admin_waiver" | "legacy";

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
  /** Guide 22 payment fields. */
  fundingSource?: CardFundingSource | string;
  /** Integer AUD cents when paid. */
  paidAmountMinor?: number | null;
  refundStatus?: string | null;
  /** The first dispatch closes ordinary cancellation and address edits. */
  firstDispatchedAtUtc?: string | null;
}

/**
 * Guide 22: every new request (personal, employee or replacement) starts through one funded
 * Checkout. A free card credit funds it automatically; otherwise the fee is charged on Stripe.
 */
export interface CardPaymentRequest extends CardDeliveryAddress {
  requestId: string;
  consentAccepted: boolean;
  employeeId?: number | null;
  previousCardId?: number | null;
  replacementReason?: CardReplacementReason | null;
}

export interface CardAllowanceUnit {
  id: number;
  status: string;
  createdAtUtc: string;
}

/** GET /api/card-requests/allowances: free card credits and the current fee. */
export interface CardAllowance {
  available: number;
  /** Integer AUD cents; null until configured. */
  cardFeeMinor?: number | null;
  /** New requests are paused when false, including free ones. */
  cardRequestsEnabled: boolean;
  allowances: CardAllowanceUnit[];
}

/** Automatic card refunds; cardRequestId is null when creation failed after payment. */
export interface CardPaymentRefund {
  id: number;
  userId: number;
  cardRequestId?: number | null;
  amountMinor: number;
  operationId: string;
  status: string;
  reason: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CardRequestListFilters {
  status?: CardRequestStatus;
  subjectType?: CardSubjectType;
}

/** Previous card and replacement reason go together or not at all. */
export interface AdminCreateCardRequest {
  /** Guide 22: a one-off free request needs an audit reason. */
  auditReason: string;
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
export type CardAllowanceResponse = ApiResponse<CardAllowance>;
export type CardPaymentRefundPageResponse = ApiResponse<ApiPage<CardPaymentRefund>>;
