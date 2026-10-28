import {
  AdminPriceItemRequestFilters,
  ApprovePriceItemRequest,
  AvailablePriceItemPageResponse,
  ChangeProviderPriceRequest,
  CreatePriceItemRequest,
  PriceItemRequestEventPageResponse,
  PriceItemRequestFilters,
  PriceItemRequestPageResponse,
  PriceItemRequestResponse,
  ProviderPriceEventPageResponse,
  ProviderPriceFilters,
  ProviderPricePageResponse,
  ProviderPriceResponse,
  RejectPriceItemRequest,
  SubmitProviderPriceRequest,
} from "@/interfaces/providerPrice.interface";
import { pageParams } from "@/utility/apiTransport";
import { audToCents, centsToAud, requireDatabaseId } from "@/utility/apiValues";
import { checkedPrices, PRICE_CATALOGUE_CODE } from "@/utility/priceCatalogueRules";
import { getData, postData, putData } from "./api";

const path = (id: number, action = "") => `/api/provider-prices/${requireDatabaseId(id)}${action}`;
const adminPath = (id: number, action = "") => `/api/admin/provider-prices/${requireDatabaseId(id)}${action}`;
const requestPath = (id: number, action = "") => `/api/provider-prices/item-requests/${requireDatabaseId(id)}${action}`;
const adminRequestPath = (id: number, action = "") => `/api/admin/provider-prices/item-requests/${requireDatabaseId(id)}${action}`;

/** Positive AUD with at most 2 decimals; the range is checked by the server against the current item. */
const aud = (price: number) => centsToAud(audToCents(price));

/** includeArchived/includeWithdrawn default to true, so only false is sent. */
export const providerPriceParams = (filters: ProviderPriceFilters = {}, page = 1, pageSize = 20) => {
  if (filters.year !== undefined && !(Number.isInteger(filters.year) && filters.year >= 2020 && filters.year <= 9999)) {
    throw new RangeError("The year must be from 2020 to 9999.");
  }
  return {
    ...(filters.businessId !== undefined ? { businessId: requireDatabaseId(filters.businessId) } : {}),
    ...(filters.itemId !== undefined ? { itemId: requireDatabaseId(filters.itemId) } : {}),
    ...(filters.year !== undefined ? { year: filters.year } : {}),
    ...(filters.includeArchived === false ? { includeArchived: false } : {}),
    ...(filters.includeWithdrawn === false ? { includeWithdrawn: false } : {}),
    ...pageParams(page, pageSize),
  };
};

export const priceItemRequestParams = (filters: AdminPriceItemRequestFilters = {}, page = 1, pageSize = 20) => ({
  ...(filters.providerUserId !== undefined ? { providerUserId: requireDatabaseId(filters.providerUserId) } : {}),
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.businessId !== undefined ? { businessId: requireDatabaseId(filters.businessId) } : {}),
  ...pageParams(page, pageSize),
});

const checkedItemRequest = (body: CreatePriceItemRequest): CreatePriceItemRequest => ({
  occupationCode: body.occupationCode,
  proposedName: body.proposedName.trim(),
  proposedDescription: body.proposedDescription?.trim() || null,
  suggestedPrice: body.suggestedPrice == null ? null : aud(body.suggestedPrice),
});

// Guide 14: the provider's annual prices.
export const listMyProviderPrices = (filters: ProviderPriceFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<ProviderPricePageResponse>("/api/provider-prices/me", { params: providerPriceParams(filters, page, pageSize), signal });

/** Published items this business can price now (matching active listing). */
export const listAvailablePriceItems = (page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<AvailablePriceItemPageResponse>("/api/provider-prices/available-items", { params: pageParams(page, pageSize), signal });

export const getProviderPrice = (id: number, signal?: AbortSignal) =>
  getData<ProviderPriceResponse>(path(id), { signal });

export const getProviderPriceHistory = (id: number, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<ProviderPriceEventPageResponse>(path(id, "/history"), { params: pageParams(page, pageSize), signal });

/** Creates the current year's row; a second POST for the same item and year is rejected. */
export const submitProviderPrice = (body: SubmitProviderPriceRequest) =>
  postData<SubmitProviderPriceRequest, ProviderPriceResponse>("/api/provider-prices", { itemId: requireDatabaseId(body.itemId), price: aud(body.price) });

/** Current-year rows only. */
export const updateProviderPrice = (id: number, body: ChangeProviderPriceRequest) =>
  putData<ChangeProviderPriceRequest, ProviderPriceResponse>(path(id), { price: aud(body.price) });

export const withdrawProviderPrice = (id: number) =>
  postData<undefined, ProviderPriceResponse>(path(id, "/withdraw"), undefined);

/** Current-year withdrawn rows only, with a new currently valid price. */
export const restoreProviderPrice = (id: number, body: ChangeProviderPriceRequest) =>
  postData<ChangeProviderPriceRequest, ProviderPriceResponse>(path(id, "/restore"), { price: aud(body.price) });

// Guide 14: new catalogue item suggestions.
export const listMyPriceItemRequests = (filters: PriceItemRequestFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<PriceItemRequestPageResponse>("/api/provider-prices/item-requests/me", { params: priceItemRequestParams(filters, page, pageSize), signal });

export const getPriceItemRequest = (id: number, signal?: AbortSignal) =>
  getData<PriceItemRequestResponse>(requestPath(id), { signal });

export const getPriceItemRequestHistory = (id: number, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<PriceItemRequestEventPageResponse>(requestPath(id, "/history"), { params: pageParams(page, pageSize), signal });

export const createPriceItemRequest = (body: CreatePriceItemRequest) =>
  postData<CreatePriceItemRequest, PriceItemRequestResponse>("/api/provider-prices/item-requests", checkedItemRequest(body));

// Admin (guide 19): SuperAdmin. Keeps current-year/state/money integrity; not a historic-amount editor.
export const adminListProviderPrices = (filters: ProviderPriceFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<ProviderPricePageResponse>("/api/admin/provider-prices", { params: providerPriceParams(filters, page, pageSize), signal });

export const adminGetProviderPrice = (id: number, signal?: AbortSignal) =>
  getData<ProviderPriceResponse>(adminPath(id), { signal });

export const adminUpdateProviderPrice = (id: number, body: ChangeProviderPriceRequest) =>
  putData<ChangeProviderPriceRequest, ProviderPriceResponse>(adminPath(id), { price: aud(body.price) });

export const adminGetProviderPriceHistory = (id: number, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<ProviderPriceEventPageResponse>(adminPath(id, "/history"), { params: pageParams(page, pageSize), signal });

export const adminRestoreProviderPrice = (id: number, body: ChangeProviderPriceRequest) =>
  postData<ChangeProviderPriceRequest, ProviderPriceResponse>(adminPath(id, "/restore"), { price: aud(body.price) });

export const adminWithdrawProviderPrice = (id: number) =>
  postData<undefined, ProviderPriceResponse>(adminPath(id, "/withdraw"), undefined);

export const adminSubmitProviderPrice = (businessId: number, body: SubmitProviderPriceRequest) =>
  postData<SubmitProviderPriceRequest, ProviderPriceResponse>(`/api/admin/provider-prices/businesses/${requireDatabaseId(businessId)}`, {
    itemId: requireDatabaseId(body.itemId), price: aud(body.price),
  });

export const adminCreatePriceItemRequest = (businessId: number, body: CreatePriceItemRequest) =>
  postData<CreatePriceItemRequest, PriceItemRequestResponse>(`/api/admin/provider-prices/businesses/${requireDatabaseId(businessId)}/item-requests`, checkedItemRequest(body));

export const adminListPriceItemRequests = (filters: AdminPriceItemRequestFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<PriceItemRequestPageResponse>("/api/admin/provider-prices/item-requests", { params: priceItemRequestParams(filters, page, pageSize), signal });

export const adminGetPriceItemRequest = (id: number, signal?: AbortSignal) =>
  getData<PriceItemRequestResponse>(adminRequestPath(id), { signal });

export const adminGetPriceItemRequestHistory = (id: number, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<PriceItemRequestEventPageResponse>(adminRequestPath(id, "/history"), { params: pageParams(page, pageSize), signal });

/** Creates a pending catalogue item (same code/range rules as guide 13); publishing is separate. */
export const adminApprovePriceItemRequest = (id: number, body: ApprovePriceItemRequest) => {
  if (!PRICE_CATALOGUE_CODE.test(body.code)) throw new Error("Use a code like ELEC_01: a capital letter, then 1–29 capitals, digits, _ or -.");
  return postData<ApprovePriceItemRequest, PriceItemRequestResponse>(adminRequestPath(id, "/approve"), { code: body.code, ...checkedPrices(body) });
};

export const adminRejectPriceItemRequest = (id: number, body: RejectPriceItemRequest) => {
  if (!body.reason.trim()) throw new Error("A rejection needs a reason.");
  return postData<RejectPriceItemRequest, PriceItemRequestResponse>(adminRequestPath(id, "/reject"), { reason: body.reason.trim() });
};
