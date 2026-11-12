import type { Card, CardStatus } from "@/interfaces/card.interface";
import type { CardReplacementReason } from "@/interfaces/cardRequest.interface";
import type { User } from "@/interfaces/user.interface";
import { PROVIDER_USER_TYPES, can } from "@/utility/access";

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  issued: "Issued",
  dispatched: "On its way",
  delivery_failed: "Delivery failed",
  received: "Received",
  expired: "Expired",
  voided: "Cancelled",
  replaced: "Replaced",
};

export const REPLACEMENT_LABELS: Record<CardReplacementReason, string> = {
  expired: "Expiring or expired",
  damaged: "Damaged",
  lost: "Lost or stolen",
};

const DAY = 24 * 60 * 60 * 1000;
const RENEWAL_WINDOW = 30 * DAY;

/** Usable only when received, flagged valid, not invalidated and not past expiry. */
export const isCardUsable = (card: Pick<Card, "isValid" | "receivedAtUtc" | "invalidatedAtUtc" | "expiresAtUtc">, now = Date.now()) =>
  card.isValid && !!card.receivedAtUtc && !card.invalidatedAtUtc && Date.parse(card.expiresAtUtc) > now;

const isOwner = (card: Pick<Card, "ownerUserId">, user?: User | null) => !!user?.id && String(card.ownerUserId) === user.id;

/** Employee cards also need employees.manage and a provider type; employees never sign in. */
const canRequestReplacementFor = (card: Pick<Card, "subjectType">, user: User | null | undefined, userTypeCode?: string | null) =>
  card.subjectType === "employee"
    ? !!userTypeCode && PROVIDER_USER_TYPES.includes(userTypeCode) && can(user, ["employees.manage", "card-requests.manage"])
    : can(user, ["card-requests.manage"]);

export interface CardActions {
  /** Confirm actual arrival; never automatic. */
  receive: boolean;
  /** Replacement reasons the app offers; the server decides. Empty when none apply. */
  replacementReasons: CardReplacementReason[];
}

export function cardActions(card: Card, user: User | null | undefined, userTypeCode?: string | null, now = Date.now()): CardActions {
  const owner = isOwner(card, user);
  const reasons: CardReplacementReason[] = [];
  // Replacement needs a previously received card that hasn't already been superseded.
  if (owner && card.receivedAtUtc && card.status !== "replaced" && canRequestReplacementFor(card, user, userTypeCode)) {
    if (now >= Date.parse(card.expiresAtUtc) - RENEWAL_WINDOW) reasons.push("expired");
    if (isCardUsable(card, now)) reasons.push("damaged");
    reasons.push("lost");
  }
  return {
    // Offered once the card exists (issued or sent): admins don't always record dispatch
    // separately, and the server still decides whether receipt is allowed.
    receive: owner && RECEIVABLE.includes(card.status) && can(user, ["cards.manage"]),
    replacementReasons: reasons,
  };
}

const RECEIVABLE: readonly CardStatus[] = ["issued", "dispatched"];

/** Why "I've received it" isn't offered, when the card could otherwise be received. */
export function receiveBlockedReason(card: Card, user: User | null | undefined): string | null {
  if (!RECEIVABLE.includes(card.status)) return null;
  if (!isOwner(card, user)) return null;
  if (!can(user, ["cards.manage"])) return "Your account doesn't have permission to confirm card receipt. Contact support.";
  return null;
}

export type CardStep = "issued" | "sent" | "received" | "active";

/** The fulfilment tracker: which steps are done and the date of each. */
export function cardSteps(card: Card, now = Date.now()): { step: CardStep; label: string; done: boolean; at?: string | null }[] {
  return [
    { step: "issued", label: "Card made", done: true, at: card.issuedAtUtc },
    { step: "sent", label: "Sent to you", done: !!card.dispatchedAtUtc || !!card.receivedAtUtc, at: card.dispatchedAtUtc },
    { step: "received", label: "Received", done: !!card.receivedAtUtc, at: card.receivedAtUtc },
    { step: "active", label: "Ready to use", done: isCardUsable(card, now) },
  ];
}

/** A plain-language headline and explanation for the card's current situation. */
export function cardSummary(card: Card, now = Date.now()): { title: string; text: string; tone: "info" | "success" | "warning" | "danger" | "neutral" } {
  const expiry = new Date(card.expiresAtUtc).toLocaleDateString();
  if (isCardUsable(card, now)) return { title: "Your card is active", text: `It's valid until ${expiry}.`, tone: "success" };
  if (card.status === "replaced") return { title: "Replaced", text: "A newer card replaced this one. It's kept here as history.", tone: "neutral" };
  if (card.invalidatedAtUtc || card.status === "voided") {
    return { title: "No longer valid", text: card.invalidationReason ?? "This card was cancelled.", tone: "danger" };
  }
  if (Date.parse(card.expiresAtUtc) <= now) return { title: "Expired", text: `It expired on ${expiry}. Request a replacement to get a new card.`, tone: "danger" };
  switch (card.status) {
    case "issued": return { title: "Your card has been made", text: "It will be sent to your delivery address. Once you have it in your hands, confirm below.", tone: "info" };
    case "dispatched": return { title: "Your card is on its way", text: "Once it arrives, confirm below to activate it.", tone: "info" };
    case "delivery_failed": return { title: "Delivery failed", text: "An administrator will resend or reissue your card. You don't need to do anything yet.", tone: "warning" };
    default: return { title: CARD_STATUS_LABELS[card.status] ?? card.status, text: "", tone: "neutral" };
  }
}

/** One line for the card face: validity first, then fulfilment. */
export function cardValidityText(card: Card, now = Date.now()): string {
  if (isCardUsable(card, now)) return "Valid";
  if (card.invalidatedAtUtc || card.status === "voided" || card.status === "replaced") return "No longer valid";
  if (Date.parse(card.expiresAtUtc) <= now) return "Expired";
  if (!card.receivedAtUtc) return "Not yet received";
  return "Not valid";
}

/** What each replacement reason does, shown before the member confirms. */
export const REPLACEMENT_EFFECTS: Record<CardReplacementReason, string> = {
  expired: "Your current card stays as it is until it expires. The new card needs approval.",
  damaged: "Your current card stays valid until the new one is received or it expires. The new card needs approval.",
  lost: "Your current card is cancelled straight away, even if the new request is later rejected or cancelled. The new card needs approval.",
};
