import type { ApiResponse } from "@/interfaces/serviceProviderApi.interface";
import {
  InspectionPaymentRequest,
  InspectionRefundPageResponse,
  PaymentAccountResponse,
  PaymentConfirmationPageResponse,
  PaymentOperationRequest,
  PaymentOperationResponse,
  PaymentPlanListResponse,
  PaymentTransactionPageResponse,
  SavedCardListResponse,
  SubscriptionPaymentRequest,
} from "@/interfaces/payment.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import { UUID_PATTERN } from "@/utility/uuid";
import { deleteData, getData, postData, putData } from "./api";

/** Payment request IDs are idempotency keys: one per logical action, reused on retries. */
export function requireRequestId(requestId: string): string {
  if (!UUID_PATTERN.test(requestId)) throw new Error("A payment request needs a valid request ID.");
  return requestId;
}

const operationPath = (operationId: string, action = "") => `/api/payments/operations/${requireRequestId(operationId)}${action}`;

/** Stripe payment-method IDs, e.g. pm_123. */
const cardPath = (cardId: string, action = "") => {
  if (!/^[A-Za-z0-9_]{1,255}$/.test(cardId)) throw new Error("Unknown saved card.");
  return `/api/payments/cards/${encodeURIComponent(cardId)}${action}`;
};

const base = (body: PaymentOperationRequest): PaymentOperationRequest => ({
  requestId: requireRequestId(body.requestId),
  consentAccepted: body.consentAccepted === true,
});

// Guide 21: the member's own billing. Reads support profile-setup sessions.
export const getPaymentAccount = (signal?: AbortSignal) => getData<PaymentAccountResponse>("/api/payments/me", { signal });

export const listPaymentPlans = (signal?: AbortSignal) => getData<PaymentPlanListResponse>("/api/payments/plans", { signal });

export const getPaymentOperation = (operationId: string, signal?: AbortSignal) =>
  getData<PaymentOperationResponse>(operationPath(operationId), { signal });

/** Cancels an unpaid Checkout; returns a new cancellation operation to poll. */
export const cancelPaymentOperation = (operationId: string, body: PaymentOperationRequest) =>
  postData<PaymentOperationRequest, PaymentOperationResponse>(operationPath(operationId, "/cancel"), base(body));

export const listSavedCards = (signal?: AbortSignal) => getData<SavedCardListResponse>("/api/payments/cards", { signal });

/** Saves a card on Stripe's page without charging; it becomes the default. Needs consent. */
export const setupSavedCard = (body: PaymentOperationRequest) => {
  if (body.consentAccepted !== true) throw new Error("Agree to save a card before continuing.");
  return postData<PaymentOperationRequest, PaymentOperationResponse>("/api/payments/cards/setup", base(body));
};

export const setDefaultSavedCard = (cardId: string) => putData<undefined, ApiResponse<boolean>>(cardPath(cardId, "/default"), undefined);

/** Removing the renewal card can be refused until another default is chosen or renewal stops. */
export const removeSavedCard = (cardId: string) => deleteData<ApiResponse<boolean>>(cardPath(cardId));

const subscription = (body: SubscriptionPaymentRequest): SubscriptionPaymentRequest => {
  if (body.planCode !== "price_list" && body.planCode !== "provider") throw new Error("Choose a plan.");
  if (body.consentAccepted !== true) throw new Error("Agree to the yearly charge before continuing.");
  return { ...base(body), planCode: body.planCode };
};

export const startSubscriptionCheckout = (body: SubscriptionPaymentRequest) =>
  postData<SubscriptionPaymentRequest, PaymentOperationResponse>("/api/payments/subscriptions/checkout", subscription(body));

/** Upgrade (prorated now) or downgrade (at renewal). */
export const changeSubscriptionPlan = (body: SubscriptionPaymentRequest) =>
  postData<SubscriptionPaymentRequest, PaymentOperationResponse>("/api/payments/subscriptions/change", subscription(body));

/** Stops renewal; paid access continues to the end of the term. */
export const cancelSubscriptionRenewal = (body: PaymentOperationRequest) =>
  postData<PaymentOperationRequest, PaymentOperationResponse>("/api/payments/subscriptions/cancel", base(body));

/**
 * Books an inspection. A free confirmation may fund it without charging (consent can be false);
 * otherwise Stripe Checkout collects the confirmation fee. The booking exists only once the
 * operation returns its inspectionId.
 */
export const startInspectionCheckout = (body: InspectionPaymentRequest) =>
  postData<InspectionPaymentRequest, PaymentOperationResponse>("/api/payments/inspections/checkout", {
    ...base(body),
    serviceId: requireDatabaseId(body.serviceId),
    streetAddress: body.streetAddress.trim(),
    suburb: body.suburb.trim(),
    regionCode: body.regionCode,
    postalCode: body.postalCode.trim(),
    note: body.note?.trim() || null,
  });

// History. Member reads always cover the signed-in owner; no userId filter is sent.
export const listPaymentTransactions = (page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<PaymentTransactionPageResponse>("/api/payments/transactions", { params: pageParams(page, pageSize), signal });

export const listPaymentConfirmations = (page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<PaymentConfirmationPageResponse>("/api/payments/confirmations", { params: pageParams(page, pageSize), signal });

export const listInspectionRefunds = (page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<InspectionRefundPageResponse>("/api/payments/refunds", { params: pageParams(page, pageSize), signal });
