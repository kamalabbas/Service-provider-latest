import {
  AdminSupportTicketListFilters,
  CreateSupportTicketRequest,
  SendSupportMessageRequest,
  SupportMessagePageResponse,
  SupportMessageResponse,
  SupportMode,
  SupportTicketEventPageResponse,
  SupportTicketListFilters,
  SupportTicketPageResponse,
  SupportTicketResponse,
} from "@/interfaces/support.interface";
import { pageParams } from "@/utility/apiTransport";
import { requireDatabaseId } from "@/utility/apiValues";
import { getData, postData } from "./api";

export const SUPPORT_TITLE_MAX = 200;
export const SUPPORT_MESSAGE_MAX = 5000;

const BASE: Record<SupportMode, string> = { member: "/api/support/tickets", admin: "/api/admin/support/tickets" };
const path = (mode: SupportMode, ticketId: number, action = "") => `${BASE[mode]}/${requireDatabaseId(ticketId)}${action}`;

const text = (value: string, max: number, message: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(message);
  if ([...trimmed].length > max) throw new Error(`Use at most ${max} characters.`);
  return trimmed;
};

const ticketBody = (body: CreateSupportTicketRequest): CreateSupportTicketRequest => ({
  title: text(body.title, SUPPORT_TITLE_MAX, "Enter a title."),
  initialMessage: text(body.initialMessage, SUPPORT_MESSAGE_MAX, "Enter a message."),
});

export const supportTicketListParams = (filters: AdminSupportTicketListFilters = {}, page = 1, pageSize = 20) => ({
  ...(filters.ownerUserId !== undefined ? { ownerUserId: requireDatabaseId(filters.ownerUserId) } : {}),
  ...(filters.status ? { status: filters.status } : {}),
  ...pageParams(page, pageSize),
});

// Guide 15: the owner's conversations. Profile-setup sessions are supported.
export const listMySupportTickets = (filters: SupportTicketListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<SupportTicketPageResponse>("/api/support/tickets/me", { params: supportTicketListParams({ status: filters.status }, page, pageSize), signal });

export const createSupportTicket = (body: CreateSupportTicketRequest) =>
  postData<CreateSupportTicketRequest, SupportTicketResponse>("/api/support/tickets", ticketBody(body));

// Shared by both modes: the same thread screen calls member or admin routes explicitly.
export const getSupportTicket = (mode: SupportMode, ticketId: number, signal?: AbortSignal) =>
  getData<SupportTicketResponse>(path(mode, ticketId), { signal });

/** Newest first. */
export const listSupportMessages = (mode: SupportMode, ticketId: number, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<SupportMessagePageResponse>(path(mode, ticketId, "/messages"), { params: pageParams(page, pageSize), signal });

export const listSupportTicketHistory = (mode: SupportMode, ticketId: number, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<SupportTicketEventPageResponse>(path(mode, ticketId, "/history"), { params: pageParams(page, pageSize), signal });

/** Rejected while closed; reopen first. */
export const sendSupportMessage = (mode: SupportMode, ticketId: number, body: SendSupportMessageRequest) =>
  postData<SendSupportMessageRequest, SupportMessageResponse>(path(mode, ticketId, "/messages"), {
    body: text(body.body, SUPPORT_MESSAGE_MAX, "Enter a message."),
  });

export const closeSupportTicket = (mode: SupportMode, ticketId: number) =>
  postData<undefined, SupportTicketResponse>(path(mode, ticketId, "/close"), undefined);

/** Always returns to open, keeping the same conversation. */
export const reopenSupportTicket = (mode: SupportMode, ticketId: number) =>
  postData<undefined, SupportTicketResponse>(path(mode, ticketId, "/reopen"), undefined);

// Admin (guide 19): SuperAdmin inbox and conversations opened for a member.
export const adminListSupportTickets = (filters: AdminSupportTicketListFilters = {}, page = 1, pageSize = 20, signal?: AbortSignal) =>
  getData<SupportTicketPageResponse>(BASE.admin, { params: supportTicketListParams(filters, page, pageSize), signal });

export const adminCreateSupportTicket = (ownerUserId: number, body: CreateSupportTicketRequest) =>
  postData<CreateSupportTicketRequest, SupportTicketResponse>(`${BASE.admin}/users/${requireDatabaseId(ownerUserId)}`, ticketBody(body));
