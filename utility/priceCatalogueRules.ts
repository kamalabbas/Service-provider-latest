import type { PriceCatalogueItem, UpdatePriceCatalogueItemRequest } from "@/interfaces/priceCatalogue.interface";
import type { PriceRange } from "@/interfaces/providerPrice.interface";
import type { User } from "@/interfaces/user.interface";
import { can } from "@/utility/access";
import { audToCents, centsToAud, formatAud } from "@/utility/apiValues";

export const PRICE_CATALOGUE_CODE = /^[A-Z][A-Z0-9_-]{1,29}$/;

/** Whole cents, then back to dollars; rejects more than 2 decimals or non-positive prices. */
const toAud = (value: number | string) => centsToAud(audToCents(typeof value === "string" ? value.trim() : value));

/** The editable fields, with prices checked and min <= guide <= max. */
export function checkedPrices(body: UpdatePriceCatalogueItemRequest): UpdatePriceCatalogueItemRequest {
  const guide = audToCents(body.guidePrice);
  const min = audToCents(body.minProviderPrice);
  const max = audToCents(body.maxProviderPrice);
  if (!(min <= guide && guide <= max)) throw new RangeError("The guide price must be between the minimum and maximum.");
  return {
    name: body.name.trim(),
    description: body.description?.trim() || null,
    guidePrice: toAud(body.guidePrice),
    minProviderPrice: toAud(body.minProviderPrice),
    maxProviderPrice: toAud(body.maxProviderPrice),
  };
}

/** The provider average is separate from the guide price; null is "no data", not $0. */
// Management views only: ordinary Global reads omit the average and its count (guide 22).
export function providerAverageText(item: Pick<PriceCatalogueItem, "providerAveragePrice" | "providerSubmissionCount">): string {
  const count = item.providerSubmissionCount ?? 0;
  if (item.providerAveragePrice == null || count === 0) return "No provider prices yet";
  return `Providers average ${formatAud(item.providerAveragePrice)} (${count} ${count === 1 ? "price" : "prices"})`;
}

export const priceRangeText = (item: PriceRange) => `${formatAud(item.minProviderPrice)} – ${formatAud(item.maxProviderPrice)}`;

export interface CatalogueManagerActions {
  edit: boolean;
  publish: boolean;
  retire: boolean;
}

/** The state table: retired items are republished before editing. The server has the final say. */
export function catalogueManagerActions(item: Pick<PriceCatalogueItem, "status">, user: User | null | undefined): CatalogueManagerActions {
  const manage = can(user, ["price-catalogue.manage"]);
  return {
    edit: item.status !== "retired" && manage,
    publish: item.status !== "published" && manage,
    retire: item.status !== "retired" && can(user, ["price-catalogue.delete"]),
  };
}
