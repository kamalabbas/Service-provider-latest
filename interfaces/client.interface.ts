import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/**
 * Guide 12. Keyed by business ID + client account ID. Created by inspection
 * acceptance; there is no manual create or delete. No email, profile or visit address.
 */
export interface ClientRelationship {
  businessId: number;
  businessName: string;
  businessArchivedAtUtc?: string | null;
  providerUserId: number;
  providerName: string;
  providerMembershipId: string;
  clientUserId: number;
  clientName: string;
  /** Current ID; can differ from the original after a type change. */
  clientMembershipId: string;
  originalClientMembershipId: string;
  /** Still shown when the client account is deactivated. */
  clientMobilePhone: string;
  clientAccountDeactivated: boolean;
  firstInspectionId: number;
  firstAcceptedAtUtc: string;
  lastAcceptedAtUtc: string;
  acceptedInspectionCount: number;
  completedInspectionCount: number;
  /** The provider's own list only. */
  isHidden?: boolean | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ClientListFilters {
  businessId?: number;
  includeHidden?: boolean;
  /** History screen: archived businesses are omitted by default. */
  includeArchivedBusinesses?: boolean;
}

export interface ClientVisibilityRequest {
  isHidden: boolean;
}

export interface AdminClientListFilters extends ClientListFilters {
  providerUserId?: number;
  clientUserId?: number;
}

export type ClientRelationshipResponse = ApiResponse<ClientRelationship>;
export type ClientRelationshipPageResponse = ApiResponse<ApiPage<ClientRelationship>>;
