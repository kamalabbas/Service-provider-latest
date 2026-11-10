import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/**
 * Guide 21 (BRD 18): Stripe payments and subscriptions. Every `…Minor` amount is integer
 * AUD cents (500 is AUD 5.00). Card details are only ever entered on Stripe's hosted page.
 */
export type PlanCode = "price_list" | "provider";

export interface PaymentPlanPrice {
  id: number;
  /** e.g. "stripe"; App Store / Google Play channels are pending on the backend. */
  channel: string;
  amountMinor: number;
  currency: string;
  isPublished: boolean;
  createdAtUtc: string;
}

export interface PaymentPlan {
  code: PlanCode | string;
  name: string;
  description: string;
  isAvailable: boolean;
  isEligible: boolean;
  prices: PaymentPlanPrice[];
}

export interface PaymentSubscription {
  channel: string;
  planCode: PlanCode | string;
  /** e.g. active, past_due, cancelled; display text comes from paymentRules. */
  status: string;
  paidUntilUtc?: string | null;
  cancelAtPeriodEnd: boolean;
  renewalOffRequired: boolean;
  /** A downgrade waiting for the renewal date. */
  pendingPlanCode?: string | null;
}

export interface PaymentBalance {
  /** Legacy compatibility only: never offer it as booking credit. */
  availablePaid: number;
  /** Spendable free inspection confirmations. */
  availableComplimentary: number;
  /** Paid funding held for outstanding refunds. */
  refundReserved: number;
}

/** GET /api/payments/me: verified benefits drive paid-feature visibility. */
export interface PaymentAccount {
  userId: number;
  hasStripeCustomer: boolean;
  hasPriceListAccess: boolean;
  hasProviderVisibility: boolean;
  confirmationFeeMinor?: number | null;
  informativeInspectionPriceMinor?: number | null;
  inspectionRequestsEnabled: boolean;
  subscription?: PaymentSubscription | null;
  balance: PaymentBalance;
}

export type PaymentOperationStatus = "queued" | "processing" | "requires_action" | "succeeded" | "failed" | "review_required";

/** One logical purchase/setup/cancellation, polled until it settles. */
export interface PaymentOperation {
  id: string;
  kind: string;
  status: PaymentOperationStatus | string;
  /** Stripe-hosted HTTPS page to open when status is requires_action. */
  checkoutUrl?: string | null;
  inspectionId?: number | null;
  cardRequestId?: number | null;
  /** Paid but the resource couldn't be created: an automatic full refund follows. */
  refundRequired: boolean;
  errorCode?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** The base of every charging/setup request. Reuse the same requestId on retries. */
export interface PaymentOperationRequest {
  requestId: string;
  consentAccepted: boolean;
}

export interface SubscriptionPaymentRequest extends PaymentOperationRequest {
  planCode: PlanCode;
}

export interface InspectionPaymentRequest extends PaymentOperationRequest {
  serviceId: number;
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
  note?: string | null;
}

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface PaymentTransaction {
  id: number;
  userId: number;
  purpose: string;
  amountMinor: number;
  refundedMinor: number;
  isDisputed: boolean;
  currency: string;
  /** Stripe receipt; opened in the browser. */
  receiptUrl?: string | null;
  createdAtUtc: string;
}

/** A free or paid inspection confirmation (funding unit). */
export interface PaymentConfirmation {
  id: number;
  userId: number;
  source: string;
  status: string;
  originalAmountMinor?: number | null;
  currency: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Inspection refunds are automatic; there is no member refund request any more. */
export interface InspectionRefund {
  id: number;
  userId: number;
  confirmationId: number;
  isAutomatic: boolean;
  operationId?: string | null;
  status: string;
  reason: string;
  decisionReason?: string | null;
  originalAmountMinor: number;
  currency: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export type PaymentAccountResponse = ApiResponse<PaymentAccount>;
export type PaymentPlanListResponse = ApiResponse<PaymentPlan[]>;
export type PaymentOperationResponse = ApiResponse<PaymentOperation>;
export type SavedCardListResponse = ApiResponse<SavedCard[]>;
export type PaymentTransactionPageResponse = ApiResponse<ApiPage<PaymentTransaction>>;
export type PaymentConfirmationPageResponse = ApiResponse<ApiPage<PaymentConfirmation>>;
export type InspectionRefundPageResponse = ApiResponse<ApiPage<InspectionRefund>>;
