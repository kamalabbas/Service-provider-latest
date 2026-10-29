import { getSessionGeneration, refreshAccessToken } from '@/services/authSession';
import { queryClient } from '@/services/queryClient';
import { selectIsAuthenticated, useAuthStore } from '@/stores/authStore';
import { useNotificationStore, type LiveConnectionStatus } from '@/stores/notificationStore';
import { useToastStore } from '@/stores/toastStore';
import { readAccessTokenClaims } from '@/utility/accessToken';
import { ALL_LIVE_ROOTS, affectedQueryKeys, normalizeLiveNotice, normalizePushNotice, SeenEvents, type LiveNotice } from '@/utility/liveEvents';
import { HttpTransportType, HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel, type ILogger } from '@microsoft/signalr';
import { AppState } from 'react-native';

// Guide 18: one hub connection per signed-in session. Delivery is targeted server-side
// from the JWT subject; the client never chooses whose messages to receive.

const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000];
const DEBOUNCE_MS = 400;
const REFRESH_MARGIN_MS = 60_000;

const hubUrl = () => process.env.EXPO_PUBLIC_SIGNALR_URL?.trim() || null;

let hub: HubConnection | null = null;
let hubKey: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let connecting: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const pendingRoots = new Set<string>();
const seen = new SeenEvents();

const setLive = (live: LiveConnectionStatus) => useNotificationStore.setState({ live });

/** The current session's key; null when signed out. A new sign-in or account switch changes it. */
function sessionKey() {
  const auth = useAuthStore.getState();
  return selectIsAuthenticated(auth) ? `${getSessionGeneration()}|${auth.user!.id}` : null;
}

const accountId = () => useAuthStore.getState().user?.id ?? null;

/** Always the current token, refreshed through the coordinated auth service near expiry. */
export async function getValidAccessToken(now = Date.now()): Promise<string> {
  let token = useAuthStore.getState().accessToken;
  const exp = token ? readAccessTokenClaims(token)?.exp : undefined;
  if (!token || (typeof exp === 'number' && exp * 1000 - now < REFRESH_MARGIN_MS)) token = await refreshAccessToken();
  if (!token) throw new Error('No signed-in session.');
  return token;
}

/** Debounced so a burst of events doesn't reload every list repeatedly. */
function queueRefetch(roots: readonly string[]) {
  roots.forEach((root) => pendingRoots.add(root));
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const id = accountId();
    const roots = [...pendingRoots];
    pendingRoots.clear();
    roots.forEach((root) => { void queryClient.invalidateQueries({ queryKey: [root, id] }); });
  }, DEBOUNCE_MS);
}

/** Refetch after connect, reconnect and resume: a missed event is never replayed. */
export const refetchLiveState = () => queueRefetch(ALL_LIVE_ROOTS);

/**
 * Shared by SignalR and foreground Expo pushes. Returns false for a duplicate event.
 * Only live (SignalR) notices show a toast; the OS already shows a push banner.
 */
export function handleLiveNotice(notice: LiveNotice, source: 'live' | 'push'): boolean {
  if (!sessionKey() || !seen.add(notice.eventId)) return false;
  queueRefetch(affectedQueryKeys(notice.type, accountId()).map(([root]) => root));
  if (source === 'live' && notice.title) {
    useToastStore.getState().showToast(notice.body ? `${notice.title}: ${notice.body}` : notice.title, 'info');
  }
  return true;
}

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function scheduleRetry(key: string) {
  clearRetry();
  setLive('retrying');
  const delay = RETRY_DELAYS[Math.min(retryAttempt, RETRY_DELAYS.length - 1)];
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (sessionKey() === key && AppState.currentState !== 'background') void connect();
  }, delay);
}

async function stop() {
  clearRetry();
  const old = hub;
  hub = null;
  hubKey = null;
  retryAttempt = 0;
  seen.clear();
  pendingRoots.clear();
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  setLive('off');
  if (old) {
    try { await old.stop(); } catch { /* Already stopped. */ }
  }
}

/**
 * direct: WebSockets without the negotiate step. Negotiation hands out a connection ID
 * that only one server instance knows; behind a load balancer without sticky sessions
 * the WebSocket then lands elsewhere ("The connection could not be found on the server").
 * negotiated: the standard handshake with transport fallback, for hosts that block a
 * direct WebSocket. A failed start switches to the other mode for the next attempt.
 */
export type HubMode = 'direct' | 'negotiated';
let mode: HubMode = 'direct';

const isDev = () => typeof __DEV__ !== 'undefined' && __DEV__;

// Library logs stay out of the red error overlay and out of release builds.
const logger: ILogger = {
  log(level, message) {
    if (isDev() && level >= LogLevel.Warning) console.warn(`[live updates] ${message}`);
  },
};

function build(url: string, key: string) {
  const accessTokenFactory = () => getValidAccessToken();
  const connection = new HubConnectionBuilder()
    .withUrl(url, mode === 'direct'
      ? { accessTokenFactory, skipNegotiation: true, transport: HttpTransportType.WebSockets }
      : { accessTokenFactory })
    .withAutomaticReconnect([0, 2000, 5000, 15000])
    .configureLogging(logger)
    .build();
  // Handlers are registered before start and ignore events from a replaced connection.
  const current = () => hub === connection && sessionKey() === key;
  connection.on('notificationReceived', (raw: unknown) => {
    if (!current()) return;
    const notice = normalizeLiveNotice(raw);
    if (notice) handleLiveNotice(notice, 'live');
  });
  connection.onreconnecting(() => { if (current()) setLive('reconnecting'); });
  connection.onreconnected(() => {
    if (!current()) return;
    setLive('live');
    refetchLiveState();
  });
  connection.onclose(() => {
    // Automatic reconnect gave up, or the token expired: start again with a fresh token.
    if (current()) scheduleRetry(key);
  });
  return connection;
}

let again = false;

/** Serialized: one attempt at a time, always for the current session. */
function connect(): Promise<void> {
  if (connecting) {
    // The session may have changed meanwhile; run once more afterwards.
    again = true;
    return connecting;
  }
  connecting = attempt().finally(() => {
    connecting = null;
    if (again) {
      again = false;
      void connect();
    }
  });
  return connecting;
}

async function attempt() {
  const url = hubUrl();
  const key = sessionKey();
  if (hubKey !== key) await stop();
  if (!url || !key) return;
  if (hub && hub.state !== HubConnectionState.Disconnected) return;
  hub = hub ?? build(url, key);
  hubKey = key;
  const connection = hub;
  setLive('connecting');
  try {
    await connection.start();
    if (hub !== connection || sessionKey() !== key) return;
    clearRetry();
    retryAttempt = 0;
    setLive('live');
    refetchLiveState();
  } catch {
    if (hub !== connection || sessionKey() !== key) return;
    // Try the other connection mode next time; the transport is fixed per connection.
    mode = mode === 'direct' ? 'negotiated' : 'direct';
    hub = null;
    scheduleRetry(key);
  }
}

/** The mode the next connection will use (for diagnostics and tests). */
export const getHubMode = () => mode;

/** Root lifecycle: connect while signed in (setup included, for support); stop on sign-out or switch. */
export function startLiveNotifications(): () => void {
  // Foreground Expo pushes share the dispatcher and deduplication, live hub or not.
  const unsubscribePush = useNotificationStore.subscribe((state, previous) => {
    if (!state.notification || state.notification === previous.notification) return;
    const notice = normalizePushNotice(state.notification.request);
    if (notice) handleLiveNotice(notice, 'push');
  });
  if (!hubUrl()) return unsubscribePush;
  void connect();
  const unsubscribe = useAuthStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id || Boolean(state.accessToken) !== Boolean(previous.accessToken)) void connect();
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active' || !sessionKey()) return;
    refetchLiveState();
    if (!hub || hub.state === HubConnectionState.Disconnected) {
      retryAttempt = 0;
      void connect();
    }
  });
  return () => {
    unsubscribePush();
    unsubscribe();
    appState.remove();
    void stop();
  };
}
