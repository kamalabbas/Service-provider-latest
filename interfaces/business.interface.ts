import type { BusinessAdminEvent } from "./profile.interface";
import type { ApiResponse } from "./serviceProviderApi.interface";

/** Guide 05. GET /api/businesses/me: the active business, or null when there is none. */
export interface Business {
  id: number;
  businessName: string;
  /** Normalized by the server (spaces removed). */
  abn: string;
  acn?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  /** Public URL; changes when the picture is replaced. */
  pictureUrl?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** POST creates (only when none is active); PUT edits. Submit the complete record. */
export interface SaveBusinessRequest {
  businessName: string;
  /** Eleven digits with a valid checksum. */
  abn: string;
  /** Nine digits with a valid checksum when supplied. */
  acn?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  streetAddress: string;
  suburb: string;
  regionCode: string;
  postalCode: string;
  /** Explicit coordinates; 0 is a valid value. */
  latitude: number;
  longitude: number;
}

/** Admin detail wraps the business with its owner and archival metadata. */
export interface AdminBusiness {
  userId: number;
  business: Business;
  archivedAtUtc?: string | null;
  archiveReason?: string | null;
}

export type BusinessResponse = ApiResponse<Business>;
export type AdminBusinessResponse = ApiResponse<AdminBusiness>;
export type AdminBusinessListResponse = ApiResponse<AdminBusiness[]>;
export type BusinessHistoryResponse = ApiResponse<BusinessAdminEvent[]>;
