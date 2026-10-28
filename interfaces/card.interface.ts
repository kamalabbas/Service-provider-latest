import type { CardDeliveryAddress, CardReplacementReason, CardSubjectType } from "./cardRequest.interface";
import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 11-b. Status alone isn't proof of a usable card; see isValid and the timestamps. */
export type CardStatus = "issued" | "dispatched" | "delivery_failed" | "received" | "expired" | "voided" | "replaced";

export interface CardEvent {
  actorUserId?: number | null;
  action: string;
  previousStatus?: string | null;
  status: string;
  note?: string | null;
  createdAtUtc: string;
}

/** Subject, business and address fields are snapshots taken at issuance. */
export interface Card {
  id: number;
  /** Immutable display string; not an API resource ID. */
  cardNumber: string;
  requestId: number;
  ownerUserId: number;
  subjectType: CardSubjectType;
  employeeId?: number | null;
  businessId?: number | null;
  previousCardId?: number | null;
  subjectName: string;
  membershipId?: string | null;
  employeeOccupationCode?: string | null;
  employeeOccupationName?: string | null;
  businessName?: string | null;
  providerMembershipId?: string | null;
  deliveryAddress: CardDeliveryAddress;
  validityYears: number;
  issuedAtUtc: string;
  expiresAtUtc: string;
  status: CardStatus;
  isValid: boolean;
  dispatchedAtUtc?: string | null;
  carrier?: string | null;
  trackingReference?: string | null;
  receivedAtUtc?: string | null;
  invalidatedAtUtc?: string | null;
  invalidationReason?: string | null;
  history: CardEvent[];
}

/** Creates a new approval request, not a valid card. Needs a previously received card. */
export interface ReplaceCardRequest {
  cardId: number;
  reason: CardReplacementReason;
}

export interface CardListFilters {
  status?: CardStatus;
}

export type AdminCardAction = "dispatch" | "delivery_failed" | "resend" | "reissue" | "receive" | "void";

/** Every action except dispatch needs an audit reason. Dispatch time is recorded by the server. */
export interface AdminCardActionRequest {
  action: AdminCardAction;
  reason?: string | null;
  carrier?: string | null;
  trackingReference?: string | null;
}

export interface AdminCardListFilters extends CardListFilters {
  ownerUserId?: number;
}

/** 1–20 years; applies to cards issued afterwards only. */
export interface CardSettings {
  validityYears: number;
  updatedByUserId?: number | null;
  updatedAtUtc: string;
}

export interface UpdateCardSettingsRequest {
  validityYears: number;
}

export type CardResponse = ApiResponse<Card>;
export type CardPageResponse = ApiResponse<ApiPage<Card>>;
export type CardSettingsResponse = ApiResponse<CardSettings>;
