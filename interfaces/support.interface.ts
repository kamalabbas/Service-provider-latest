import type { ApiPage, ApiResponse } from "./serviceProviderApi.interface";

/** Guide 15. open: support acts next; pending: the member replies next; closed: replies blocked. */
export type SupportTicketStatus = "open" | "pending" | "closed";

/** member: the owner's own routes; admin: SuperAdmin routes. Never a forged owner ID. */
export type SupportMode = "member" | "admin";

export interface SupportTicket {
  id: number;
  ownerUserId: number;
  ownerEmail: string;
  title: string;
  status: SupportTicketStatus;
  messageCount: number;
  lastMessageAtUtc: string;
  closedAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Immutable plain text. Pages arrive newest first. */
export interface SupportMessage {
  id: number;
  ticketId: number;
  senderUserId: number;
  senderKind: string;
  body: string;
  createdAtUtc: string;
}

export interface SupportTicketEvent {
  id: number;
  ticketId: number;
  actorUserId: number;
  action: string;
  previousStatus?: string | null;
  status: string;
  messageId?: number | null;
  createdAtUtc: string;
}

/** Nonblank; title ≤ 200 and initialMessage ≤ 5000 characters. */
export interface CreateSupportTicketRequest {
  title: string;
  initialMessage: string;
}

/** Nonblank, ≤ 5000 characters. */
export interface SendSupportMessageRequest {
  body: string;
}

export interface SupportTicketListFilters {
  status?: SupportTicketStatus;
}

export interface AdminSupportTicketListFilters extends SupportTicketListFilters {
  ownerUserId?: number;
}

export type SupportTicketResponse = ApiResponse<SupportTicket>;
export type SupportTicketPageResponse = ApiResponse<ApiPage<SupportTicket>>;
export type SupportMessageResponse = ApiResponse<SupportMessage>;
export type SupportMessagePageResponse = ApiResponse<ApiPage<SupportMessage>>;
export type SupportTicketEventPageResponse = ApiResponse<ApiPage<SupportTicketEvent>>;
