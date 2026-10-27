import { ObjectApiResponse } from "@/interfaces/serviceProviderAuth.interface";
import {
  DiscoveredServiceResponse,
  SaveServiceRequest,
  ServiceListingListResponse,
  ServiceListingResponse,
  ServiceSearchFilters,
  ServiceSearchResponse,
} from "@/interfaces/service.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireCoordinates, requireDatabaseId } from "@/utility/apiValues";
import { deleteData, getData, postData, putData } from "./api";

const checked = (body: SaveServiceRequest): SaveServiceRequest => ({ ...body, ...requireCoordinates(body.latitude, body.longitude) });

/** Search query: required location, validated radius, and only non-empty filters. */
export function searchParams(filters: ServiceSearchFilters, page = 1, pageSize = 20) {
  const { latitude, longitude } = requireCoordinates(filters.latitude, filters.longitude);
  if (filters.radiusKm !== undefined && !(filters.radiusKm >= 1 && filters.radiusKm <= 500)) {
    throw new RangeError("The search radius must be 1–500 km.");
  }
  const membershipId = filters.membershipId?.trim();
  const occupationCode = filters.occupationCode?.trim();
  return {
    latitude,
    longitude,
    ...(filters.radiusKm !== undefined ? { radiusKm: filters.radiusKm } : {}),
    ...(membershipId ? { membershipId } : {}),
    ...(occupationCode ? { occupationCode } : {}),
    ...pageParams(page, pageSize),
  };
}

// Guide 07: the provider's own listings (including archived history).
export const getMyServices = (signal?: AbortSignal) =>
  getData<ServiceListingListResponse>("/api/services/me", { signal });

export const getMyService = (serviceId: number, signal?: AbortSignal) =>
  getData<ServiceListingResponse>(`/api/services/me/${requireDatabaseId(serviceId)}`, { signal });

export const createMyService = (body: SaveServiceRequest) =>
  postData<SaveServiceRequest, ServiceListingResponse>("/api/services/me", checked(body));

/** Active listings only; an archived listing can't be edited or republished. */
export const updateMyService = (serviceId: number, body: SaveServiceRequest) =>
  putData<SaveServiceRequest, ServiceListingResponse>(`/api/services/me/${requireDatabaseId(serviceId)}`, checked(body));

/** Removes the listing from discovery; owner history is kept. */
export const archiveMyService = (serviceId: number) =>
  deleteData<ObjectApiResponse>(`/api/services/me/${requireDatabaseId(serviceId)}`);

// Guide 07: discovery. Excludes the signed-in provider's own listings; ordered by estimated distance.
export const searchServices = (filters: ServiceSearchFilters, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<ServiceSearchResponse>("/api/services/search", { params: searchParams(filters, page, pageSize), signal });

/** Another member's discoverable listing; may 404 once it is no longer discoverable. */
export const getDiscoveredService = (serviceId: number, signal?: AbortSignal) =>
  getData<DiscoveredServiceResponse>(`/api/services/${requireDatabaseId(serviceId)}`, { signal });

// Admin (guide 19): SuperAdmin target-user listings, by stable IDs.
export const adminListUserServices = (userId: number, signal?: AbortSignal) =>
  getData<ServiceListingListResponse>(`/api/admin/services/users/${requireDatabaseId(userId)}`, { signal });

export const adminCreateUserService = (userId: number, body: SaveServiceRequest) =>
  postData<SaveServiceRequest, ServiceListingResponse>(`/api/admin/services/users/${requireDatabaseId(userId)}`, checked(body));

export const adminGetService = (serviceId: number, signal?: AbortSignal) =>
  getData<ServiceListingResponse>(`/api/admin/services/${requireDatabaseId(serviceId)}`, { signal });

export const adminUpdateService = (serviceId: number, body: SaveServiceRequest) =>
  putData<SaveServiceRequest, ServiceListingResponse>(`/api/admin/services/${requireDatabaseId(serviceId)}`, checked(body));

export const adminArchiveService = (serviceId: number) =>
  deleteData<ObjectApiResponse>(`/api/admin/services/${requireDatabaseId(serviceId)}`);
