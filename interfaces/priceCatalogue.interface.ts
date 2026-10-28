import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 13. Price guidance only: not a service listing or a quote. Tax is unspecified. */
export type PriceCatalogueStatus = "pending" | "published" | "retired";

export interface PriceCatalogueItem {
  id: number;
  /** Immutable after creation. */
  code: string;
  /** Immutable after creation. */
  occupationCode: string;
  occupationName: string;
  name: string;
  description?: string | null;
  currencyCode: string;
  guidePrice: number;
  minProviderPrice: number;
  maxProviderPrice: number;
  /** From provider submissions; null means no data, not zero. */
  providerAveragePrice?: number | null;
  providerSubmissionCount: number;
  status: PriceCatalogueStatus;
  publishedAtUtc?: string | null;
  retiredAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface PriceCatalogueFilters {
  occupationCode?: string;
  search?: string;
}

export interface AdminPriceCatalogueFilters extends PriceCatalogueFilters {
  status?: PriceCatalogueStatus;
}

/** Prices are positive AUD with at most 2 decimals, and min <= guide <= max. */
export interface UpdatePriceCatalogueItemRequest {
  name: string;
  description?: string | null;
  guidePrice: number;
  minProviderPrice: number;
  maxProviderPrice: number;
}

/** New items start pending; an explicit publish makes them visible. */
export interface CreatePriceCatalogueItemRequest extends UpdatePriceCatalogueItemRequest {
  /** ^[A-Z][A-Z0-9_-]{1,29}$ and unique. */
  code: string;
  /** Must be an active occupation. */
  occupationCode: string;
}

/** Audit entry for an effective create/edit/publish/retire. */
export interface PriceCatalogueEvent {
  id: number;
  itemId: number;
  actorUserId: number;
  action: string;
  before?: Record<string, unknown> | null;
  after: Record<string, unknown>;
  createdAtUtc: string;
}

export type PriceCatalogueItemResponse = ApiResponse<PriceCatalogueItem>;
export type PriceCataloguePageResponse = ApiResponse<ApiPage<PriceCatalogueItem>>;
export type PriceCatalogueEventPageResponse = ApiResponse<ApiPage<PriceCatalogueEvent>>;
