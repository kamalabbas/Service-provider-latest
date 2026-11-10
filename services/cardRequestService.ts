import {
  AdminCancelCardRequest,
  AdminCardDecisionRequest,
  AdminCardRequestListFilters,
  AdminCreateCardRequest,
  CardDeliveryAddress,
  CardRequestListFilters,
  CardRequestPageResponse,
  CardRequestResponse,
  CardAllowanceResponse,
  CardPaymentRefundPageResponse,
  CardPaymentRequest,
  CardReplacementReason,
} from "@/interfaces/cardRequest.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import type { PaymentOperationResponse } from "@/interfaces/payment.interface";
import type { ApiResponse } from "@/interfaces/serviceProviderApi.interface";
import { requireRequestId } from "@/services/paymentService";
import { getData, postData, putData } from "./api";

const path = (requestId: number, action = "") => `/api/card-requests/${requireDatabaseId(requestId)}${action}`;
const adminPath = (requestId: number, action = "") => `/api/admin/card-requests/${requireDatabaseId(requestId)}${action}`;

export const cardRequestListParams = (filters: CardRequestListFilters = {}, page = 1, pageSize = 20) => ({
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.subjectType ? { subjectType: filters.subjectType } : {}),
  ...pageParams(page, pageSize),
});

/** All four fields, trimmed; the server rejects blanks. */
const address = (body: CardDeliveryAddress): CardDeliveryAddress => ({
  streetAddress: body.streetAddress.trim(),
  suburb: body.suburb.trim(),
  regionCode: body.regionCode,
  postalCode: body.postalCode.trim(),
});

// Guide 11: card requests for the member or one of their employees.
export const listMyCardRequests = (filters: CardRequestListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<CardRequestPageResponse>("/api/card-requests/me", { params: cardRequestListParams(filters, page, pageSize), signal });

export const getCardRequest = (requestId: number, signal?: AbortSignal) =>
  getData<CardRequestResponse>(path(requestId), { signal });

/** Guide 22: free card credits, the fee and whether requests are paused. */
export const getCardAllowances = (signal?: AbortSignal) =>
  getData<CardAllowanceResponse>("/api/card-requests/allowances", { signal });

/** Automatic card refunds. */
export const listCardRefunds = (page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<CardPaymentRefundPageResponse>("/api/card-requests/refunds", { params: pageParams(page, pageSize), signal });

const REPLACEMENT_REASONS: readonly CardReplacementReason[] = ["expired", "damaged", "lost"];

/**
 * One funded Checkout for personal, employee and replacement cards (the old per-kind routes
 * are gone). A request exists only once the operation returns its cardRequestId.
 */
export function startCardCheckout(body: CardPaymentRequest) {
  const hasPrevious = body.previousCardId != null;
  if (hasPrevious !== (body.replacementReason != null)) throw new Error("A replacement needs both the previous card and the reason.");
  if (body.replacementReason && !REPLACEMENT_REASONS.includes(body.replacementReason)) throw new Error("Choose expired, damaged or lost.");
  return postData<CardPaymentRequest, PaymentOperationResponse>("/api/card-requests/checkout", {
    requestId: requireRequestId(body.requestId),
    consentAccepted: body.consentAccepted === true,
    ...address(body),
    employeeId: body.employeeId == null ? null : requireDatabaseId(body.employeeId),
    previousCardId: hasPrevious ? requireDatabaseId(body.previousCardId!) : null,
    replacementReason: body.replacementReason ?? null,
  });
}

/** Immediately invalidates the card, even if the replacement payment is then abandoned. */
export const reportCardLost = (cardId: number) =>
  postData<undefined, ApiResponse<boolean>>(`/api/card-requests/cards/${requireDatabaseId(cardId)}/report-lost`, undefined);

/** Editable until the card is first dispatched. */
export const updateCardDeliveryAddress = (requestId: number, body: CardDeliveryAddress) =>
  putData<CardDeliveryAddress, CardRequestResponse>(path(requestId, "/delivery-address"), address(body));

/** Pending only. */
export const cancelCardRequest = (requestId: number) =>
  postData<undefined, CardRequestResponse>(path(requestId, "/cancel"), undefined);

// Admin (guide 19): SuperAdmin review queue and on-behalf requests.
export const adminListCardRequests = (filters: AdminCardRequestListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<CardRequestPageResponse>("/api/admin/card-requests", {
    params: {
      ...(filters.ownerUserId !== undefined ? { ownerUserId: requireDatabaseId(filters.ownerUserId) } : {}),
      ...cardRequestListParams(filters, page, pageSize),
    },
    signal,
  });

export const adminGetCardRequest = (requestId: number, signal?: AbortSignal) =>
  getData<CardRequestResponse>(adminPath(requestId), { signal });

export const adminCreateCardRequest = (ownerUserId: number, body: AdminCreateCardRequest) => {
  const hasPrevious = body.previousCardId != null;
  if (!body.auditReason?.trim()) throw new Error("An audit reason is required.");
  if (hasPrevious !== (body.replacementReason != null)) throw new Error("A replacement needs both the previous card and the reason.");
  return postData<AdminCreateCardRequest, CardRequestResponse>(`/api/admin/card-requests/users/${requireDatabaseId(ownerUserId)}`, {
    auditReason: body.auditReason.trim(),
    employeeId: body.employeeId == null ? null : requireDatabaseId(body.employeeId),
    previousCardId: hasPrevious ? requireDatabaseId(body.previousCardId!) : null,
    replacementReason: body.replacementReason ?? null,
  });
};

export const adminDecideCardRequest = (requestId: number, body: AdminCardDecisionRequest) => {
  const reason = body.reason?.trim() || null;
  if (body.action === "reject" && !reason) throw new Error("A rejection needs a reason.");
  return postData<AdminCardDecisionRequest, CardRequestResponse>(adminPath(requestId, "/decision"), { action: body.action, reason });
};

export const adminCancelCardRequest = (requestId: number, body: AdminCancelCardRequest) => {
  if (!body.reason.trim()) throw new Error("An audit reason is required.");
  return postData<AdminCancelCardRequest, CardRequestResponse>(adminPath(requestId, "/cancel"), { reason: body.reason.trim() });
};

export const adminUpdateCardDeliveryAddress = (requestId: number, body: CardDeliveryAddress) =>
  putData<CardDeliveryAddress, CardRequestResponse>(adminPath(requestId, "/delivery-address"), address(body));
