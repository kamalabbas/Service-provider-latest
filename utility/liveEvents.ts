import type { User } from "@/interfaces/user.interface";

/** Guide 18: one notice from SignalR (notificationReceived) or an Expo push. */
export interface LiveNotice {
  eventId: string;
  type: string;
  /** Plain display text, never protocol constants. */
  title: string;
  body: string;
  data: Record<string, unknown>;
  occurredAtUtc: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number) => (typeof value === "string" ? [...value.trim()].slice(0, max).join("") : "");

/** Validates a SignalR payload; anything malformed is dropped. */
export function normalizeLiveNotice(raw: unknown): LiveNotice | null {
  if (!isRecord(raw)) return null;
  const eventId = text(raw.eventId, 100);
  const type = text(raw.type, 100);
  if (!eventId || !/^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/.test(type)) return null;
  return {
    eventId,
    type,
    title: text(raw.title, 200),
    body: text(raw.body, 500),
    data: isRecord(raw.data) ? raw.data : {},
    occurredAtUtc: typeof raw.occurredAtUtc === "string" ? raw.occurredAtUtc : null,
  };
}

/** Expo custom data wraps the domain IDs one level down: { eventId, type, data: { ... } }. */
export function normalizePushNotice(content: { title?: string | null; body?: string | null; data?: unknown }): LiveNotice | null {
  if (!isRecord(content.data)) return null;
  return normalizeLiveNotice({ ...content.data, title: content.title ?? "", body: content.body ?? "" });
}

/** The feature prefix, e.g. "card-request" for "card-request.accepted". */
export const eventFeature = (type: string) => type.slice(0, type.indexOf("."));

// Query-key roots per feature (the first element of each hooks/use*.ts `…Keys.all`).
// Unknown features refetch nothing.
const AFFECTED_ROOTS: Record<string, readonly string[]> = {
  inspection: ["inspections", "clients"],
  quote: ["quotes"],
  "card-request": ["card-requests", "cards"],
  card: ["cards", "card-requests"],
  support: ["support"],
  "price-item-request": ["provider-prices", "price-catalogue"],
  announcement: ["announcements"],
};

/** Query keys to refetch for a notice type, scoped to the signed-in account. */
export function affectedQueryKeys(type: string, accountId: string | null): (readonly [string, string | null])[] {
  return (AFFECTED_ROOTS[eventFeature(type)] ?? []).map((root) => [root, accountId] as const);
}

/** Every private root refetched after connect, reconnect and resume (a missed event is never replayed). */
export const ALL_LIVE_ROOTS: readonly string[] = [...new Set(Object.values(AFFECTED_ROOTS).flat())];

const positiveId = (value: unknown) => {
  const id = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
};

export type LiveRoute = { pathname: string; params: { id: string } };

/**
 * Where a push tap may lead. The ID is never authorization: the target screen fetches the
 * record under the current session's permissions. SuperAdmin-only records and unknown
 * types get no link (for example an issue-report status update for its reporter).
 */
export function routeForNotice(notice: Pick<LiveNotice, "type" | "data">, user: User | null | undefined, inSetup: boolean): LiveRoute | null {
  if (!user) return null;
  const feature = eventFeature(notice.type);
  const link = (key: string, pathname: string) => {
    const id = positiveId(notice.data[key]);
    return id ? { pathname, params: { id: String(id) } } : null;
  };
  if (feature === "support") return link("ticketId", inSetup ? "/(setup)/support-ticket" : "/(dashboard)/(menu)/support-ticket");
  // Everything else lives behind full access.
  if (inSetup) return null;
  switch (feature) {
    case "inspection": return link("inspectionId", "/(dashboard)/(inspections)/[id]");
    case "quote": return link("quoteId", "/(dashboard)/(quotes)/[id]");
    case "card-request": return link("cardRequestId", "/(dashboard)/(menu)/card-request");
    case "card": return link("cardId", "/(dashboard)/(menu)/card");
    case "price-item-request": return link("requestId", "/(dashboard)/(menu)/price-request");
    case "announcement": return link("announcementId", "/(dashboard)/(menu)/announcement");
    default: return null;
  }
}

/** Bounded per-account deduplication across SignalR and Expo. */
export class SeenEvents {
  private readonly ids = new Set<string>();
  constructor(private readonly limit = 200) {}

  /** true the first time an event ID is seen. */
  add(eventId: string) {
    if (this.ids.has(eventId)) return false;
    this.ids.add(eventId);
    if (this.ids.size > this.limit) this.ids.delete(this.ids.values().next().value!);
    return true;
  }

  clear() {
    this.ids.clear();
  }
}
