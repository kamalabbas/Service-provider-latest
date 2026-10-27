import type { Inspection } from "@/interfaces/inspection.interface";
import type { CreateQuoteRequest, Quote, QuoteStatus } from "@/interfaces/quote.interface";
import type { User } from "@/interfaces/user.interface";
import { can } from "@/utility/access";
import { audToCents, centsToAud } from "@/utility/apiValues";
import { inspectionRole } from "@/utility/inspectionRules";
import * as yup from "yup";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export type QuoteRole = "provider" | "customer";

/** Decided by account IDs (JWT sub is a string). */
export function quoteRole(quote: Pick<Quote, "providerUserId" | "customerUserId">, userId: string | null | undefined): QuoteRole | null {
  if (!userId) return null;
  if (String(quote.providerUserId) === userId) return "provider";
  if (String(quote.customerUserId) === userId) return "customer";
  return null;
}

/** The local clock only hides actions; the server's status and expiry decide. */
export const isQuoteOpen = (quote: Pick<Quote, "status" | "expiresAtUtc">, now = Date.now()) =>
  quote.status === "pending" && Date.parse(quote.expiresAtUtc) > now;

export interface QuoteActions {
  accept: boolean;
  reject: boolean;
  withdraw: boolean;
  uploadPdf: boolean;
}

/** Ownership, state and permission are independent; all must allow the action. */
export function quoteActions(quote: Pick<Quote, "status" | "expiresAtUtc" | "canAccept" | "providerUserId" | "customerUserId">, user: User | null | undefined, now = Date.now()): QuoteActions {
  const role = quoteRole(quote, user?.id);
  const open = isQuoteOpen(quote, now);
  const manage = can(user, ["quotes.manage"]);
  const remove = can(user, ["quotes.delete"]);
  return {
    accept: role === "customer" && open && quote.canAccept && manage,
    reject: role === "customer" && open && remove,
    withdraw: role === "provider" && open && remove,
    uploadPdf: role === "provider" && open && manage,
  };
}

/** The provider of a completed or rated inspection may issue a quote for it. */
export const canIssueQuoteFor = (inspection: Pick<Inspection, "status" | "requesterUserId" | "providerUserId">, user: User | null | undefined) =>
  inspectionRole(inspection, user?.id) === "provider" &&
  (inspection.status === "completed" || inspection.status === "rated") &&
  can(user, ["quotes.manage"]);

export interface QuoteFormValues {
  totalAmount: string;
  note: string;
  expiresAt: Date | null;
}

export const QUOTE_FIELDS = ["totalAmount", "note", "expiresAt"] as const satisfies readonly (keyof QuoteFormValues)[];

const isAmount = (value: string | undefined) => {
  try { return !!value && audToCents(value.trim()) <= 999999999999; } catch { return false; }
};

/** A week from now, at the same time, as a starting expiry. */
export const defaultQuoteExpiry = (now = new Date()) => new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

export const quoteSchema = (now = () => Date.now()): yup.ObjectSchema<QuoteFormValues> => yup.object({
  totalAmount: yup.string().trim().required("Enter the total amount")
    .test("aud", "Enter a positive amount with at most 2 decimal places, e.g. 1250.50", isAmount),
  note: yup.string().trim().max(2000, "Use at most 2000 characters").defined(),
  expiresAt: yup.date().nullable().defined()
    .test("future", "Choose a future expiry date and time", (value) => !!value && value.getTime() > now()),
});

export const toCreateQuoteRequest = (inspectionId: number, values: QuoteFormValues): CreateQuoteRequest => ({
  inspectionId,
  totalAmount: centsToAud(audToCents(values.totalAmount.trim())),
  note: values.note.trim() || null,
  expiresAt: values.expiresAt!.toISOString(),
});

/** A safe local file name for an opened quote PDF. */
export const quotePdfFileName = (quoteNumber: string) => `${quoteNumber.replace(/[^A-Za-z0-9_-]/g, "_") || "quote"}.pdf`;

/** Countdown text for a pending quote; the server still decides when it has expired. */
export function expiryText(expiresAtUtc: string, now = Date.now()): string {
  const minutes = Math.floor((Date.parse(expiresAtUtc) - now) / 60000);
  if (!(minutes > 0)) return "Expired";
  if (minutes < 60) return `Expires in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Expires in ${hours} h ${minutes % 60} min`;
  return `Expires in ${Math.floor(hours / 24)} days`;
}
