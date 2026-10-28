import {
  AdminCardActionRequest,
  AdminCardListFilters,
  Card,
  CardListFilters,
  CardPageResponse,
  CardResponse,
  CardSettingsResponse,
  ReplaceCardRequest,
  UpdateCardSettingsRequest,
} from "@/interfaces/card.interface";
import { CardReplacementReason, CardRequestResponse } from "@/interfaces/cardRequest.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import { getData, postData, putData } from "./api";

const REPLACEMENT_REASONS: readonly CardReplacementReason[] = ["expired", "damaged", "lost"];
const ACTIONS_WITHOUT_REASON = new Set(["dispatch"]);

export const cardListParams = (filters: CardListFilters = {}, page = 1, pageSize = 20) => ({
  ...(filters.status ? { status: filters.status } : {}),
  ...pageParams(page, pageSize),
});

// Guide 11-b: the member's and their employees' issued cards.
export const listMyCards = (filters: CardListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<CardPageResponse>("/api/cards/me", { params: cardListParams(filters, page, pageSize), signal });

export const getCard = (cardId: number, signal?: AbortSignal) =>
  getData<CardResponse>(`/api/cards/${requireDatabaseId(cardId)}`, { signal });

/** Only after the card has actually arrived. The signed-in request and its time are the proof. */
export const receiveCard = (cardId: number) =>
  postData<undefined, CardResponse>(`/api/cards/${requireDatabaseId(cardId)}/receive`, undefined);

/** Personal or employee route by the card's subject. Creates a new approval request. */
export const requestCardReplacement = (card: Pick<Card, "id" | "subjectType">, reason: CardReplacementReason) => {
  if (!REPLACEMENT_REASONS.includes(reason)) throw new Error("Choose expired, damaged or lost.");
  const route = card.subjectType === "employee" ? "employee" : "personal";
  return postData<ReplaceCardRequest, CardRequestResponse>(`/api/card-requests/${route}/replacement`, { cardId: requireDatabaseId(card.id), reason });
};

// Admin (guide 19): SuperAdmin issuance, fulfilment and validity settings.
/** Repeating it doesn't create a duplicate card. */
export const adminIssueCard = (requestId: number) =>
  postData<undefined, CardResponse>(`/api/admin/card-requests/${requireDatabaseId(requestId)}/issue`, undefined);

export const adminListCards = (filters: AdminCardListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<CardPageResponse>("/api/admin/cards", {
    params: {
      ...(filters.ownerUserId !== undefined ? { ownerUserId: requireDatabaseId(filters.ownerUserId) } : {}),
      ...cardListParams(filters, page, pageSize),
    },
    signal,
  });

export const adminGetCard = (cardId: number, signal?: AbortSignal) =>
  getData<CardResponse>(`/api/admin/cards/${requireDatabaseId(cardId)}`, { signal });

/** A reissue may return a different card; use the returned record. */
export const adminCardAction = (cardId: number, body: AdminCardActionRequest) => {
  const reason = body.reason?.trim() || null;
  if (!ACTIONS_WITHOUT_REASON.has(body.action) && !reason) throw new Error("An audit reason is required for this action.");
  return postData<AdminCardActionRequest, CardResponse>(`/api/admin/cards/${requireDatabaseId(cardId)}/action`, {
    action: body.action,
    reason,
    carrier: body.carrier?.trim() || null,
    trackingReference: body.trackingReference?.trim() || null,
  });
};

export const adminGetCardSettings = (signal?: AbortSignal) =>
  getData<CardSettingsResponse>("/api/admin/card-settings", { signal });

export const adminUpdateCardSettings = (body: UpdateCardSettingsRequest) => {
  if (!Number.isInteger(body.validityYears) || body.validityYears < 1 || body.validityYears > 20) {
    throw new RangeError("Validity must be a whole number of years from 1 to 20.");
  }
  return putData<UpdateCardSettingsRequest, CardSettingsResponse>("/api/admin/card-settings", { validityYears: body.validityYears });
};
