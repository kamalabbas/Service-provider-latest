import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 07. The provider's own listing; own reads include archived history. */
export interface ServiceListing {
  id: number;
  title: string;
  description: string;
  occupationCode: string;
  occupationName: string;
  suburb: string;
  regionCode: string;
  /** The listing's own location, separate from the business location. */
  latitude: number;
  longitude: number;
  /** Archived listings can't be edited or republished. */
  archivedAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** POST creates, PUT edits an active listing. Submit the complete record. */
export interface SaveServiceRequest {
  title: string;
  description: string;
  occupationCode: string;
  suburb: string;
  regionCode: string;
  /** Explicit coordinates; the API neither geocodes nor checks the suburb. 0 is valid. */
  latitude: number;
  longitude: number;
}

/** Another member's discoverable listing. No provider email or phone. */
export interface DiscoveredService {
  id: number;
  title: string;
  description: string;
  occupationCode: string;
  occupationName: string;
  suburb: string;
  regionCode: string;
  latitude: number;
  longitude: number;
  createdAtUtc: string;
  providerUserId: number;
  providerMembershipId: string;
  providerUserTypeCode: string;
  providerName: string;
  profilePictureUrl?: string | null;
  businessName: string;
  businessPictureUrl?: string | null;
  businessLatitude: number;
  businessLongitude: number;
  /** Estimated straight-line distance, not travel distance. */
  distanceKm?: number | null;
  /** Advisory; also needs inspections.manage. The create endpoint revalidates. */
  canRequestInspection: boolean;
  /** null means no ratings, not zero stars. */
  providerAverageRating?: number | null;
  providerRatingCount: number;
}

/** Search location is required; empty filters are omitted. */
export interface ServiceSearchFilters {
  latitude: number;
  longitude: number;
  /** 1–500 km; the server defaults to 50. */
  radiusKm?: number;
  membershipId?: string;
  occupationCode?: string;
}

export type ServiceListingResponse = ApiResponse<ServiceListing>;
export type ServiceListingListResponse = ApiResponse<ServiceListing[]>;
export type DiscoveredServiceResponse = ApiResponse<DiscoveredService>;
export type ServiceSearchResponse = ApiResponse<ApiPage<DiscoveredService>>;
