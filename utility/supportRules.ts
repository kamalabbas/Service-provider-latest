import type { SupportMessage, SupportMode, SupportTicket, SupportTicketStatus } from "@/interfaces/support.interface";
import type { User } from "@/interfaces/user.interface";
import { SUPPORT_MESSAGE_MAX, SUPPORT_TITLE_MAX } from "@/services/supportService";
import { can, grantsOf } from "@/utility/access";
import { isAdministrator } from "@/utility/permissions";
import * as yup from "yup";

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Waiting for support",
  pending: "Waiting for your reply",
  closed: "Closed",
};

/** The admin inbox reads the same statuses from the support side. */
export const ADMIN_SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Needs a reply",
  pending: "Waiting for the member",
  closed: "Closed",
};

export interface SupportTicketActions {
  reply: boolean;
  close: boolean;
  reopen: boolean;
}

/**
 * Owners act on their own tickets with support.manage (reply, reopen) and support.delete
 * (close), profile-setup sessions included; admin mode is SuperAdmin-only. Closed tickets
 * take no replies until explicitly reopened.
 */
export function supportTicketActions(ticket: Pick<SupportTicket, "ownerUserId" | "status">, user: User | null | undefined, mode: SupportMode): SupportTicketActions {
  const allowed = mode === "admin"
    ? { manage: isAdministrator(grantsOf(user)), remove: isAdministrator(grantsOf(user)) }
    : {
        manage: !!user?.id && String(ticket.ownerUserId) === user.id && can(user, ["support.manage"], true),
        remove: !!user?.id && String(ticket.ownerUserId) === user.id && can(user, ["support.delete"], true),
      };
  const closed = ticket.status === "closed";
  return { reply: allowed.manage && !closed, close: allowed.remove && !closed, reopen: allowed.manage && closed };
}

/**
 * Merges newest-first pages into one newest-first list without duplicates. A new reply
 * shifts page boundaries, so the same message can appear on two pages.
 */
export function mergeSupportMessages(pages: readonly (readonly SupportMessage[])[]): SupportMessage[] {
  const byId = new Map<number, SupportMessage>();
  pages.forEach((page) => page.forEach((message) => byId.set(message.id, message)));
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAtUtc) - Date.parse(a.createdAtUtc) || b.id - a.id);
}

/** Who sent a message, from the viewer's side; never from the generic senderKind text. */
export function supportSenderLabel(message: Pick<SupportMessage, "senderUserId">, ticket: Pick<SupportTicket, "ownerUserId" | "ownerEmail">, user: User | null | undefined) {
  if (user?.id && String(message.senderUserId) === user.id) return "You";
  return message.senderUserId === ticket.ownerUserId ? ticket.ownerEmail : "Support";
}

export interface SupportTicketFormValues {
  title: string;
  initialMessage: string;
}

export const SUPPORT_TICKET_FIELDS = ["title", "initialMessage"] as const satisfies readonly (keyof SupportTicketFormValues)[];

const characters = (max: number) => (value: string | undefined) => [...(value ?? "").trim()].length <= max;

export const supportTicketSchema: yup.ObjectSchema<SupportTicketFormValues> = yup.object({
  title: yup.string().trim().required("Enter a title")
    .test("max", `Use at most ${SUPPORT_TITLE_MAX} characters`, characters(SUPPORT_TITLE_MAX)),
  initialMessage: yup.string().trim().required("Describe what you need help with")
    .test("max", `Use at most ${SUPPORT_MESSAGE_MAX} characters`, characters(SUPPORT_MESSAGE_MAX)),
});
