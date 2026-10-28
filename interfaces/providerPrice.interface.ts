import type { PriceCatalogueItem, PriceCatalogueStatus } from "./priceCatalogue.interface";
import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 14. One row per business, catalogue item and UTC calendar year (chosen by the server). */
export interface ProviderPrice {
  id: number;
  businessId: number;
  businessName: string;
  businessArchivedAtUtc?: string | null;
  providerUserId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemStatus: PriceCatalogueStatus;
  occupationCode: string;
  currencyCode: string;
  calendarYear: number;
  price: number;
  /** Withdrawn rows are kept; they contribute nothing to the average. */
  withdrawnAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ProviderPriceEvent {
  id: number;
  submissionId: number;
  actorUserId: number;
  action: string;
  before?: Record<string, unknown> | null;
  after: Record<string, unknown>;
  createdAtUtc: string;
}

/** No year field: the server uses the current UTC year. */
export interface SubmitProviderPriceRequest {
  itemId: number;
  /** Positive AUD, 2 decimals, within the item's current range. */
  price: number;
}

/** Edit (current year) or restore (current-year withdrawn row, with a new valid price). */
export interface ChangeProviderPriceRequest {
  price: number;
}

export interface ProviderPriceFilters {
  businessId?: number;
  itemId?: number;
  /** 2020–9999. */
  year?: number;
  /** Both default to true on the server. */
  includeArchived?: boolean;
  includeWithdrawn?: boolean;
}

export type PriceItemRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface PriceItemRequest {
  id: number;
  businessId: number;
  businessName: string;
  businessArchivedAtUtc?: string | null;
  providerUserId: number;
  occupationCode: string;
  occupationName: string;
  proposedName: string;
  proposedDescription?: string | null;
  suggestedPrice?: number | null;
  status: PriceItemRequestStatus;
  /** Set on approval: a pending catalogue item that still needs publishing. */
  catalogueItemId?: number | null;
  decisionReason?: string | null;
  decidedByUserId?: number | null;
  decidedAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** One pending request per business, occupation and name (trimmed, case-insensitive). */
export interface CreatePriceItemRequest {
  occupationCode: string;
  proposedName: string;
  proposedDescription?: string | null;
  suggestedPrice?: number | null;
}

export interface PriceItemRequestEvent {
  id: number;
  requestId: number;
  actorUserId?: number | null;
  action: string;
  previousStatus?: string | null;
  status: string;
  reason?: string | null;
  createdAtUtc: string;
}

export interface PriceItemRequestFilters {
  status?: PriceItemRequestStatus;
  businessId?: number;
}

/** Approval creates a pending catalogue item; it doesn't publish it or submit a price. */
export interface ApprovePriceItemRequest {
  code: string;
  name: string;
  description?: string | null;
  guidePrice: number;
  minProviderPrice: number;
  maxProviderPrice: number;
}

export interface RejectPriceItemRequest {
  reason: string;
}

export interface AdminPriceItemRequestFilters extends PriceItemRequestFilters {
  providerUserId?: number;
}

export type ProviderPriceResponse = ApiResponse<ProviderPrice>;
export type ProviderPricePageResponse = ApiResponse<ApiPage<ProviderPrice>>;
export type ProviderPriceEventPageResponse = ApiResponse<ApiPage<ProviderPriceEvent>>;
export type AvailablePriceItemPageResponse = ApiResponse<ApiPage<PriceCatalogueItem>>;
export type PriceItemRequestResponse = ApiResponse<PriceItemRequest>;
export type PriceItemRequestPageResponse = ApiResponse<ApiPage<PriceItemRequest>>;
export type PriceItemRequestEventPageResponse = ApiResponse<ApiPage<PriceItemRequestEvent>>;
