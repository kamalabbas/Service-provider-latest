import {
  AdminQuoteDecisionRequest,
  AdminQuoteListFilters,
  CreateQuoteRequest,
  QuoteListFilters,
  QuotePageResponse,
  QuoteReasonRequest,
  QuoteResponse,
} from "@/interfaces/quote.interface";
import { pageParams } from "@/utility/apiTransport";
import { audToCents, centsToAud, requireDatabaseId, toUtcTimestamp } from "@/utility/apiValues";
import { getData, postData } from "./api";
import { NativeUploadFile, documentForm, downloadPrivatePdf, uploadApiFile } from "./apiFiles";

const path = (quoteId: number, action = "") => `/api/quotes/${requireDatabaseId(quoteId)}${action}`;
const adminPath = (quoteId: number, action = "") => `/api/admin/quotes/${requireDatabaseId(quoteId)}${action}`;

/** Only set filters are sent; side "all" is the server default. */
export const quoteListParams = (filters: QuoteListFilters = {}, page = 1, pageSize = 20) => ({
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.side && filters.side !== "all" ? { side: filters.side } : {}),
  ...pageParams(page, pageSize),
});

/** Amount checked to whole cents, expiry sent with an explicit offset. */
const checkedQuote = (body: CreateQuoteRequest): CreateQuoteRequest => ({
  inspectionId: requireDatabaseId(body.inspectionId),
  totalAmount: centsToAud(audToCents(body.totalAmount)),
  note: body.note?.trim() || null,
  expiresAt: toUtcTimestamp(body.expiresAt),
});

const reason = (body: QuoteReasonRequest = {}) => ({ reason: body.reason?.trim() || null });

// Guide 09: quotes for a completed inspection.
export const listMyQuotes = (filters: QuoteListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<QuotePageResponse>("/api/quotes/me", { params: quoteListParams(filters, page, pageSize), signal });

export const getQuote = (quoteId: number, signal?: AbortSignal) =>
  getData<QuoteResponse>(path(quoteId), { signal });

/** One pending quote per inspection; the server issues the quote number. */
export const createQuote = (body: CreateQuoteRequest) =>
  postData<CreateQuoteRequest, QuoteResponse>("/api/quotes", checkedQuote(body));

/** Customer, pending and before expiry. Not a payment. */
export const acceptQuote = (quoteId: number) =>
  postData<undefined, QuoteResponse>(path(quoteId, "/accept"), undefined);

export const rejectQuote = (quoteId: number, body?: QuoteReasonRequest) =>
  postData<QuoteReasonRequest, QuoteResponse>(path(quoteId, "/reject"), reason(body));

/** Provider, pending and before expiry. A replacement quote can follow. */
export const withdrawQuote = (quoteId: number, body?: QuoteReasonRequest) =>
  postData<QuoteReasonRequest, QuoteResponse>(path(quoteId, "/withdraw"), reason(body));

/** Pending only; replaces any earlier PDF. Field `document`, 10 MB, PDF. */
export const uploadQuotePdf = (quoteId: number, file: NativeUploadFile) =>
  uploadApiFile<QuoteResponse>("put", path(quoteId, "/pdf"), documentForm(file));

/** Authenticated bytes for the quote's own root-relative download URL. */
export const downloadQuotePdf = (pdfDownloadUrl: string) => {
  if (!pdfDownloadUrl.startsWith("/api/")) throw new Error("The quote PDF link isn't valid.");
  return downloadPrivatePdf(pdfDownloadUrl);
};

// Admin (guide 19): SuperAdmin quotes; the response history records the administrator.
export const adminListQuotes = (filters: AdminQuoteListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<QuotePageResponse>("/api/admin/quotes", {
    params: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.providerUserId !== undefined ? { providerUserId: requireDatabaseId(filters.providerUserId) } : {}),
      ...(filters.customerUserId !== undefined ? { customerUserId: requireDatabaseId(filters.customerUserId) } : {}),
      ...pageParams(page, pageSize),
    },
    signal,
  });

export const adminCreateQuote = (body: CreateQuoteRequest) =>
  postData<CreateQuoteRequest, QuoteResponse>("/api/admin/quotes", checkedQuote(body));

export const adminGetQuote = (quoteId: number, signal?: AbortSignal) =>
  getData<QuoteResponse>(adminPath(quoteId), { signal });

export const adminDecideQuote = (quoteId: number, body: AdminQuoteDecisionRequest) => {
  if (!body.reason.trim()) throw new Error("An audit reason is required.");
  return postData<AdminQuoteDecisionRequest, QuoteResponse>(adminPath(quoteId, "/decision"), { action: body.action, reason: body.reason.trim() });
};

export const adminUploadQuotePdf = (quoteId: number, file: NativeUploadFile) =>
  uploadApiFile<QuoteResponse>("put", adminPath(quoteId, "/pdf"), documentForm(file));

export const adminDownloadQuotePdf = (quoteId: number) => downloadPrivatePdf(adminPath(quoteId, "/pdf"));
