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

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
};

/** A push request as delivered by expo-notifications (foreground, background tap or cold start). */
export interface PushRequestLike {
  identifier?: string;
  content: { title?: string | null; body?: string | null; data?: unknown };
  trigger?: unknown;
}

/**
 * The custom data of an Expo push. The backend sends { eventId, type, data: { ...ids } }, but
 * Android can deliver it as JSON strings, or only on the FCM trigger when the app was killed.
 */
function pushData(request: PushRequestLike): Record<string, unknown> | null {
  const candidates: unknown[] = [request.content.data];
  if (isRecord(request.trigger)) {
    const remote = request.trigger.remoteMessage;
    if (isRecord(remote) && isRecord(remote.data)) candidates.push(remote.data.body, remote.data);
    if (isRecord(request.trigger.payload)) candidates.push(request.trigger.payload.body, request.trigger.payload);
  }
  for (const candidate of candidates) {
    const data = parseJson(candidate);
    if (isRecord(data) && typeof data.type === "string") return data;
  }
  return null;
}

/** Normalizes a push to the same notice shape as SignalR. Pushes without an event type are ignored. */
export function normalizePushNotice(request: PushRequestLike): LiveNotice | null {
  const data = pushData(request);
  if (!data) return null;
  const nested = parseJson(data.data);
  // Older or flat payloads put the IDs next to the type instead of under data.
  const { eventId, type, data: _nested, ...flat } = data;
  return normalizeLiveNotice({
    eventId: typeof eventId === "string" && eventId ? eventId : `push:${request.identifier ?? ""}:${String(type)}`,
    type,
    title: request.content.title ?? "",
    body: request.content.body ?? "",
    data: isRecord(nested) ? nested : flat,
  });
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

export type LiveRoute = { pathname: string; params?: { id: string } };

/**
 * Where a push tap leads: the record when its ID is present, else that feature's list. The
 * ID is never authorization: the target screen fetches the record under the current
 * session's permissions. SuperAdmin-only records and unknown types get no link (for
 * example an issue-report status update for its reporter); the app just opens.
 */
export function routeForNotice(notice: Pick<LiveNotice, "type" | "data">, user: User | null | undefined, inSetup: boolean): LiveRoute | null {
  if (!user) return null;
  const feature = eventFeature(notice.type);
  const link = (key: string, pathname: string, list: string): LiveRoute => {
    const id = positiveId(notice.data[key]);
    return id ? { pathname, params: { id: String(id) } } : { pathname: list };
  };
  if (feature === "support") {
    const base = inSetup ? "/(setup)" : "/(dashboard)/(menu)";
    return link("ticketId", `${base}/support-ticket`, `${base}/support`);
  }
  // Everything else lives behind full access.
  if (inSetup) return null;
  switch (feature) {
    case "inspection": return link("inspectionId", "/(dashboard)/(inspections)/[id]", "/(dashboard)/(inspections)");
    case "quote": return link("quoteId", "/(dashboard)/(quotes)/[id]", "/(dashboard)/(quotes)");
    case "card-request": return link("cardRequestId", "/(dashboard)/(menu)/card-request", "/(dashboard)/(menu)/card-requests");
    case "card": return link("cardId", "/(dashboard)/(menu)/card", "/(dashboard)/(menu)/cards");
    case "price-item-request": return link("requestId", "/(dashboard)/(menu)/price-request", "/(dashboard)/(menu)/price-requests");
    case "announcement": return link("announcementId", "/(dashboard)/(menu)/announcement", "/(dashboard)/(menu)/announcements");
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
