import {
  AdminPriceCatalogueFilters,
  CreatePriceCatalogueItemRequest,
  PriceCatalogueEventPageResponse,
  PriceCatalogueFilters,
  PriceCatalogueItemResponse,
  PriceCataloguePageResponse,
  UpdatePriceCatalogueItemRequest,
} from "@/interfaces/priceCatalogue.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import { checkedPrices, PRICE_CATALOGUE_CODE } from "@/utility/priceCatalogueRules";
import { getData, postData, putData } from "./api";

const adminPath = (itemId: number, action = "") => `/api/admin/price-catalogue/${requireDatabaseId(itemId)}${action}`;

/** Empty filters are omitted. */
export const catalogueParams = (filters: AdminPriceCatalogueFilters = {}, page = 1, pageSize = 20) => {
  const search = filters.search?.trim();
  return {
    ...("status" in filters && filters.status ? { status: filters.status } : {}),
    ...(filters.occupationCode ? { occupationCode: filters.occupationCode } : {}),
    ...(search ? { search } : {}),
    ...pageParams(page, pageSize),
  };
};

// Guide 13: published items with an active occupation.
export const listPriceCatalogue = (filters: PriceCatalogueFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<PriceCataloguePageResponse>("/api/price-catalogue", { params: catalogueParams(filters, page, pageSize), signal });

export const getPriceCatalogueItem = (itemId: number, signal?: AbortSignal) =>
  getData<PriceCatalogueItemResponse>(`/api/price-catalogue/${requireDatabaseId(itemId)}`, { signal });

// Management (delegated permissions; SuperAdmin bypasses them).
export const adminListPriceCatalogue = (filters: AdminPriceCatalogueFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<PriceCataloguePageResponse>("/api/admin/price-catalogue", { params: catalogueParams(filters, page, pageSize), signal });

export const adminGetPriceCatalogueItem = (itemId: number, signal?: AbortSignal) =>
  getData<PriceCatalogueItemResponse>(adminPath(itemId), { signal });

/** Creates a pending item; code and occupation can't change afterwards. */
export const adminCreatePriceCatalogueItem = (body: CreatePriceCatalogueItemRequest) => {
  if (!PRICE_CATALOGUE_CODE.test(body.code)) throw new Error("Use a code like ELEC_01: a capital letter, then 1–29 capitals, digits, _ or -.");
  return postData<CreatePriceCatalogueItemRequest, PriceCatalogueItemResponse>("/api/admin/price-catalogue", {
    code: body.code,
    occupationCode: body.occupationCode,
    ...checkedPrices(body),
  });
};

/** Pending or published only; a retired item is republished before editing. */
export const adminUpdatePriceCatalogueItem = (itemId: number, body: UpdatePriceCatalogueItemRequest) =>
  putData<UpdatePriceCatalogueItemRequest, PriceCatalogueItemResponse>(adminPath(itemId), checkedPrices(body));

export const adminGetPriceCatalogueHistory = (itemId: number, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<PriceCatalogueEventPageResponse>(adminPath(itemId, "/history"), { params: pageParams(page, pageSize), signal });

/** Publishes a pending item or republishes a retired one (occupation must be active). */
export const adminPublishPriceCatalogueItem = (itemId: number) =>
  postData<undefined, PriceCatalogueItemResponse>(adminPath(itemId, "/publish"), undefined);

/** Reversible: history is kept and the item can be republished. */
export const adminRetirePriceCatalogueItem = (itemId: number) =>
  postData<undefined, PriceCatalogueItemResponse>(adminPath(itemId, "/retire"), undefined);
