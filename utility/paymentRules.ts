import type { PaymentAccount, PaymentOperation, PaymentPlan, PaymentSubscription, PlanCode } from "@/interfaces/payment.interface";

/** Integer cents to "$5.00" (AUD); zero and refunds display too. */
export function formatMinor(amountMinor: number | null | undefined, currency = "AUD", locale?: string): string {
  if (amountMinor == null || !Number.isSafeInteger(amountMinor)) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() || "AUD" }).format(amountMinor / 100);
}

// Card details are only typed on Stripe's own pages. Anything else is refused, so a tampered
// response can't send someone to a look-alike payment page.
const STRIPE_HOSTS = ["checkout.stripe.com", "invoice.stripe.com", "pay.stripe.com", "billing.stripe.com"];

export function isTrustedPaymentUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && STRIPE_HOSTS.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Receipts are Stripe-hosted too (any https *.stripe.com page). */
export function isTrustedReceiptUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.toLowerCase().endsWith(".stripe.com");
  } catch {
    return false;
  }
}

export const SETTLED_STATUSES = ["succeeded", "failed", "review_required"];

/** queued/processing/requires_action keep polling; the rest are final. */
export const isOperationSettled = (operation: Pick<PaymentOperation, "status"> | null | undefined) =>
  !!operation && SETTLED_STATUSES.includes(operation.status);

export interface OperationView {
  title: string;
  text: string;
  tone: "info" | "success" | "warning" | "danger";
}

/** What to tell the member about an operation, in plain language. */
export function operationView(operation: Pick<PaymentOperation, "status" | "refundRequired" | "errorCode"> & Partial<Pick<PaymentOperation, "amountMinor" | "accessEndsAtUtc" | "refundStatus">>): OperationView {
  // Guide 23: annual access says until when; a cheap upgrade completes at once for free.
  if (operation.status === "succeeded" && !operation.refundRequired && operation.accessEndsAtUtc) {
    const until = new Date(operation.accessEndsAtUtc).toLocaleDateString();
    return operation.amountMinor === 0
      ? { title: "Upgraded for free", text: `The difference was too small to charge. Your access runs until ${until}.`, tone: "success" }
      : { title: "All done", text: `Your payment was confirmed. Your access runs until ${until}.`, tone: "success" };
  }
  if (operation.status === "succeeded" && operation.refundRequired && operation.refundStatus === "succeeded") {
    return { title: "Payment refunded", text: "We couldn't activate this purchase, so the full amount was refunded.", tone: "warning" };
  }
  switch (operation.status) {
    case "queued":
    case "processing":
      return { title: "Processing payment", text: "This usually takes a few seconds. You can leave this screen; we'll keep checking.", tone: "info" };
    case "requires_action":
      return { title: "Finish on Stripe", text: "Complete the payment on Stripe's secure page. Come back here when you're done.", tone: "info" };
    case "succeeded":
      return operation.refundRequired
        ? { title: "Payment refunded", text: "Your payment went through, but we couldn't complete the request, so the full amount is being refunded automatically.", tone: "warning" }
        : { title: "All done", text: "Your payment was confirmed.", tone: "success" };
    case "review_required":
      return { title: "Under review", text: "Our team needs to check this payment. You don't need to pay again; we'll update you.", tone: "warning" };
    default:
      return { title: "Payment didn't go through", text: operation.errorCode ? `Nothing was charged for this attempt (${operation.errorCode}).` : "Nothing was charged for this attempt. You can try again.", tone: "danger" };
  }
}

/** The Stripe price shown for a plan; only published prices can be bought. */
export function planPrice(plan: Pick<PaymentPlan, "prices">, channel = "stripe") {
  return plan.prices.find((price) => price.channel === channel && price.isPublished) ?? null;
}

export const PLAN_RANK: Record<PlanCode, number> = { price_list: 1, provider: 2 };

/**
 * Guide 23 annual terms (one-off payments, no automatic renewal):
 * - subscribe: no current term; buy a year.
 * - renew: the same plan, in the final 30 days (or after expiry), extending from the expiry.
 * - upgrade: Price list → Provider for the rest of the term (prorated; may be free).
 * - next_year: a lower plan bought during renewal, starting when the current term ends.
 * - current / prepaid / unavailable: nothing to buy.
 */
export type PlanAction = "subscribe" | "renew" | "upgrade" | "next_year" | "current" | "prepaid" | "unavailable";

export function planAction(plan: PaymentPlan, account: Pick<PaymentAccount, "subscription"> | null | undefined): PlanAction {
  if (!plan.isAvailable || !plan.isEligible || !planPrice(plan)) return "unavailable";
  const current = activeSubscription(account?.subscription);
  if (!current) return "subscribe";
  if (current.channel !== "stripe") return "unavailable";
  // One following term can be prepaid; once it is, nothing more can be bought ahead.
  if (current.upcomingPlanCode) return current.upcomingPlanCode === plan.code ? "prepaid" : "unavailable";
  if (current.planCode === plan.code) return current.canRenew ? "renew" : "current";
  const higher = (PLAN_RANK[plan.code as PlanCode] ?? 0) > (PLAN_RANK[current.planCode as PlanCode] ?? 0);
  if (higher) return current.canUpgrade ? "upgrade" : "unavailable";
  return current.canRenew ? "next_year" : "unavailable";
}

/** A term that grants (or held, while suspended) benefits now. */
export function activeSubscription(subscription: PaymentSubscription | null | undefined) {
  if (!subscription) return null;
  return ["active", "suspended", "past_due"].includes(subscription.status) ? subscription : null;
}

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  suspended: "Suspended",
  past_due: "Suspended",
  expired: "Expired",
  refunded: "Refunded",
  cancelled: "Ended",
  canceled: "Ended",
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  processing: "Refund in progress",
  succeeded: "Refunded",
  failed: "Refund needs review",
  review_required: "Refund needs review",
  rejected: "Refund declined",
  withdrawn: "Refund withdrawn",
};

/** Funding sources on card requests and inspections. */
export const FUNDING_LABELS: Record<string, string> = {
  paid: "Paid",
  allowance: "Free card credit",
  admin_waiver: "Free (arranged by our team)",
  legacy: "Before payments",
  complimentary: "Free inspection credit",
};

/** A short sentence about the paid term, renewal and any prepaid next term. */
export function subscriptionSummary(subscription: PaymentSubscription, plans: readonly PaymentPlan[] = []): string {
  const name = (code?: string | null) => plans.find((plan) => plan.code === code)?.name ?? code ?? "";
  const date = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : null);
  const until = date(subscription.paidUntilUtc);
  if (subscription.status === "suspended" || subscription.status === "past_due") {
    return "Your benefits are paused while a payment issue is reviewed. Contact support if you need help.";
  }
  if (subscription.status === "expired") return "Your access has ended. Buy a new year to get it back.";
  const parts = [until ? `Paid until ${until}. It doesn't renew automatically.` : "Active."];
  if (subscription.upcomingPlanCode) {
    parts.push(`Next year is paid: ${name(subscription.upcomingPlanCode)} from ${date(subscription.upcomingStartsAtUtc) ?? until ?? "your expiry"} to ${date(subscription.upcomingPaidUntilUtc) ?? "a year later"}.`);
  } else if (subscription.canRenew) {
    parts.push("You can renew now; the new year starts when this one ends.");
  }
  return parts.join(" ");
}

/** A reminder when renewal is open and nothing is prepaid yet; null otherwise. */
export function renewalReminder(account: Pick<PaymentAccount, "subscription"> | null | undefined): string | null {
  const term = activeSubscription(account?.subscription);
  if (!term || !term.canRenew || term.upcomingPlanCode || term.channel !== "stripe") return null;
  const until = term.paidUntilUtc ? new Date(term.paidUntilUtc).toLocaleDateString() : "soon";
  return `Your plan ends on ${until}. Renew now to keep your benefits.`;
}
