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
export function operationView(operation: Pick<PaymentOperation, "status" | "refundRequired" | "errorCode">): OperationView {
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

export type PlanAction = "subscribe" | "upgrade" | "downgrade" | "current" | "unavailable";

/** One plan at a time: subscribing, upgrading (prorated now) or downgrading (at renewal). */
export function planAction(plan: PaymentPlan, account: Pick<PaymentAccount, "subscription"> | null | undefined): PlanAction {
  if (!plan.isAvailable || !plan.isEligible || !planPrice(plan)) return "unavailable";
  const current = activeSubscription(account?.subscription);
  if (!current) return "subscribe";
  if (current.planCode === plan.code) return "current";
  if (current.channel !== "stripe") return "unavailable";
  const from = PLAN_RANK[current.planCode as PlanCode] ?? 0;
  const to = PLAN_RANK[plan.code as PlanCode] ?? 0;
  return to > from ? "upgrade" : "downgrade";
}

/** A subscription that still grants or will grant benefits (not fully ended). */
export function activeSubscription(subscription: PaymentSubscription | null | undefined) {
  if (!subscription) return null;
  return ["active", "trialing", "past_due", "incomplete", "suspended"].includes(subscription.status) ? subscription : null;
}

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Active",
  past_due: "Payment failed",
  suspended: "Suspended",
  incomplete: "Waiting for payment",
  cancelled: "Ended",
  canceled: "Ended",
  expired: "Ended",
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

/** A short sentence about renewal, cancellation and pending downgrades. */
export function subscriptionSummary(subscription: PaymentSubscription, plans: readonly PaymentPlan[] = []): string {
  const name = (code?: string | null) => plans.find((plan) => plan.code === code)?.name ?? code ?? "";
  const until = subscription.paidUntilUtc ? new Date(subscription.paidUntilUtc).toLocaleDateString() : null;
  if (subscription.status === "past_due" || subscription.status === "suspended") {
    return "Your last renewal payment failed, so benefits are paused. Update your card; Stripe retries for up to 7 days.";
  }
  if (subscription.cancelAtPeriodEnd) return until ? `Renewal is off. Your access continues until ${until}.` : "Renewal is off.";
  if (subscription.pendingPlanCode) {
    return `Changes to ${name(subscription.pendingPlanCode)} on ${until ?? "your renewal date"}. You keep your current benefits until then.`;
  }
  return until ? `Renews on ${until}.` : "Active.";
}
