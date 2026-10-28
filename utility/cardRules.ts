import type { Card, CardStatus } from "@/interfaces/card.interface";
import type { CardReplacementReason } from "@/interfaces/cardRequest.interface";
import type { User } from "@/interfaces/user.interface";
import { BUSINESS_USER_TYPES, can } from "@/utility/access";

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
    ? !!userTypeCode && BUSINESS_USER_TYPES.includes(userTypeCode) && can(user, ["employees.manage", "card-requests.manage"])
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
    receive: owner && card.status === "dispatched" && can(user, ["cards.manage"]),
    replacementReasons: reasons,
  };
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
