import { isTrustedPaymentUrl } from '@/utility/paymentRules';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

// Guide 21: shared Checkout plumbing. Card details are entered only on Stripe's hosted page,
// opened in the system browser (Safari View Controller / Custom Tabs), which the app can't read.

/** Opens a Stripe-hosted page. Anything that isn't an https Stripe address is refused. */
export async function openPaymentPage(url: string | null | undefined): Promise<void> {
  if (!isTrustedPaymentUrl(url)) throw new Error("This payment link isn't a secure Stripe page, so it wasn't opened.");
  await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'done', showInRecents: true, createTask: false });
}

const PENDING_KEY = 'payment_pending_operations';
const SUBMIT_KEY = 'payment_pending_submit';
const MAX_PENDING = 10;

/** An operation still being processed, kept across restarts so it can be resumed. */
export interface PendingOperation {
  operationId: string;
  kind: string;
  label: string;
  userId: string;
  startedAtUtc: string;
}

/** A submission whose outcome is unknown (network failure): its request ID must be reused. */
export interface PendingSubmit {
  requestId: string;
  kind: string;
  /** A stable fingerprint of the input; the same request ID with different input is invalid. */
  inputKey: string;
  userId: string;
}

async function read<T>(key: string): Promise<T[]> {
  try {
    const value = JSON.parse((await SecureStore.getItemAsync(key)) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function write<T>(key: string, items: T[]) {
  try { await SecureStore.setItemAsync(key, JSON.stringify(items.slice(-MAX_PENDING))); } catch { /* Best effort. */ }
}

export const listPendingOperations = async (userId: string) =>
  (await read<PendingOperation>(PENDING_KEY)).filter((item) => item.userId === userId);

export async function rememberOperation(item: PendingOperation) {
  const items = (await read<PendingOperation>(PENDING_KEY)).filter((existing) => existing.operationId !== item.operationId);
  await write(PENDING_KEY, [...items, item]);
}

export async function forgetOperation(operationId: string) {
  await write(PENDING_KEY, (await read<PendingOperation>(PENDING_KEY)).filter((item) => item.operationId !== operationId));
}

/** The request ID to send: the unresolved one for identical input, else a new one. */
export async function requestIdFor(kind: string, inputKey: string, userId: string, create: () => string): Promise<string> {
  const saved = (await read<PendingSubmit>(SUBMIT_KEY)).find((item) => item.kind === kind && item.userId === userId);
  if (saved && saved.inputKey === inputKey) return saved.requestId;
  const requestId = create();
  await write(SUBMIT_KEY, [...(await read<PendingSubmit>(SUBMIT_KEY)).filter((item) => !(item.kind === kind && item.userId === userId)), { requestId, kind, inputKey, userId }]);
  return requestId;
}

/** Once the server has answered (operation or a definite rejection), the request ID is spent. */
export async function clearSubmit(kind: string, userId: string) {
  await write(SUBMIT_KEY, (await read<PendingSubmit>(SUBMIT_KEY)).filter((item) => !(item.kind === kind && item.userId === userId)));
}

