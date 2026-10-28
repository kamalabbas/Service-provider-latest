import type { PriceCatalogueItem } from "@/interfaces/priceCatalogue.interface";
import type { PriceItemRequestStatus, ProviderPrice } from "@/interfaces/providerPrice.interface";
import type { User } from "@/interfaces/user.interface";
import { BUSINESS_USER_TYPES, can } from "@/utility/access";
import { audToCents } from "@/utility/apiValues";
import * as yup from "yup";

/** The server picks the UTC calendar year for new and editable rows. */
export const currentUtcYear = (now = Date.now()) => new Date(now).getUTCFullYear();

export const PRICE_REQUEST_STATUS_LABELS: Record<PriceItemRequestStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Writes need a provider type plus the operation's permission; history visibility isn't eligibility. */
export const canWriteProviderPrices = (user: User | null | undefined, userTypeCode?: string | null) =>
  !!userTypeCode && BUSINESS_USER_TYPES.includes(userTypeCode) && can(user, ["prices.manage"]);

/** The latest year for its business and item among the rows loaded (the server confirms). */
export const isLatestRow = (row: Pick<ProviderPrice, "id" | "businessId" | "itemId" | "calendarYear">, rows: readonly Pick<ProviderPrice, "id" | "businessId" | "itemId" | "calendarYear">[]) =>
  !rows.some((other) => other.id !== row.id && other.businessId === row.businessId && other.itemId === row.itemId && other.calendarYear > row.calendarYear);

export interface ProviderPriceActions {
  edit: boolean;
  withdraw: boolean;
  restore: boolean;
}

/**
 * Current-year rows can be edited, withdrawn and restored; the latest older row can
 * only be withdrawn. Retired items allow withdrawal only. Archived businesses are history.
 */
export function providerPriceActions(
  row: ProviderPrice,
  rows: readonly ProviderPrice[],
  user: User | null | undefined,
  userTypeCode?: string | null,
  now = Date.now(),
): ProviderPriceActions {
  const owner = !!user?.id && String(row.providerUserId) === user.id;
  const eligible = owner && !row.businessArchivedAtUtc && !!userTypeCode && BUSINESS_USER_TYPES.includes(userTypeCode);
  const current = row.calendarYear === currentUtcYear(now);
  const withdrawn = !!row.withdrawnAtUtc;
  const retired = row.itemStatus === "retired";
  const manage = eligible && can(user, ["prices.manage"]);
  return {
    edit: manage && current && !withdrawn && !retired,
    restore: manage && current && withdrawn && !retired,
    withdraw: eligible && !withdrawn && (current || isLatestRow(row, rows)) && can(user, ["prices.delete"]),
  };
}

/** Positive AUD with at most 2 decimals, inside the item's current min–max range. */
export function priceRangeError(value: string, item: Pick<PriceCatalogueItem, "minProviderPrice" | "maxProviderPrice">): string | null {
  let cents: number;
  try { cents = audToCents(value.trim()); } catch { return "Enter a positive amount with at most 2 decimal places."; }
  if (cents < audToCents(item.minProviderPrice) || cents > audToCents(item.maxProviderPrice)) return "Enter a price within the allowed range.";
  return null;
}

export interface PriceItemRequestFormValues {
  occupationCode: string;
  proposedName: string;
  proposedDescription: string;
  suggestedPrice: string;
}

export const PRICE_ITEM_REQUEST_FIELDS = ["occupationCode", "proposedName", "proposedDescription", "suggestedPrice"] as const satisfies readonly (keyof PriceItemRequestFormValues)[];

const isOptionalAmount = (value: string | undefined) => {
  if (!value?.trim()) return true;
  try { return audToCents(value.trim()) > 0; } catch { return false; }
};

export const priceItemRequestSchema: yup.ObjectSchema<PriceItemRequestFormValues> = yup.object({
  occupationCode: yup.string().trim().required("Choose an occupation"),
  proposedName: yup.string().trim().required("Enter a name for the item").max(150, "Use at most 150 characters"),
  proposedDescription: yup.string().trim().max(2000, "Use at most 2000 characters").defined(),
  suggestedPrice: yup.string().trim().defined().test("aud", "Enter a positive amount with at most 2 decimal places", isOptionalAmount),
});
