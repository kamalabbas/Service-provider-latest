import {
  AdminClientListFilters,
  ClientListFilters,
  ClientRelationshipPageResponse,
  ClientRelationshipResponse,
  ClientVisibilityRequest,
} from "@/interfaces/client.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import { getData, putData } from "./api";

/** Only set filters are sent. */
export const clientListParams = (filters: ClientListFilters = {}, page = 1, pageSize = 20) => ({
  ...(filters.businessId !== undefined ? { businessId: requireDatabaseId(filters.businessId) } : {}),
  ...(filters.includeHidden ? { includeHidden: true } : {}),
  ...(filters.includeArchivedBusinesses ? { includeArchivedBusinesses: true } : {}),
  ...pageParams(page, pageSize),
});

// Guide 12: the provider's clients, by business.
export const listMyClients = (filters: ClientListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<ClientRelationshipPageResponse>("/api/clients/me", { params: clientListParams(filters, page, pageSize), signal });

/** The customer's providers; doesn't inherit the provider's hidden flag. */
export const listMyProviders = (filters: ClientListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<ClientRelationshipPageResponse>("/api/clients/providers/me", { params: clientListParams(filters, page, pageSize), signal });

/** Hides or restores this provider's list row only. */
export const setClientHidden = (businessId: number, clientUserId: number, isHidden: boolean) =>
  putData<ClientVisibilityRequest, ClientRelationshipResponse>(
    `/api/clients/me/${requireDatabaseId(businessId)}/${requireDatabaseId(clientUserId)}/visibility`, { isHidden });

// Admin (guide 19): SuperAdmin global relationship list and visibility.
export const adminListClients = (filters: AdminClientListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<ClientRelationshipPageResponse>("/api/admin/clients", {
    params: {
      ...(filters.providerUserId !== undefined ? { providerUserId: requireDatabaseId(filters.providerUserId) } : {}),
      ...(filters.clientUserId !== undefined ? { clientUserId: requireDatabaseId(filters.clientUserId) } : {}),
      ...clientListParams(filters, page, pageSize),
    },
    signal,
  });

export const adminSetClientHidden = (businessId: number, clientUserId: number, isHidden: boolean) =>
  putData<ClientVisibilityRequest, ClientRelationshipResponse>(
    `/api/admin/clients/businesses/${requireDatabaseId(businessId)}/clients/${requireDatabaseId(clientUserId)}/visibility`, { isHidden });
