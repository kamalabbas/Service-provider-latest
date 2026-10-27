/** Service Provider uses an HTTPS origin; endpoint paths already include /api. */
export function normalizeApiOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (value !== value.trim() || !value.startsWith('https://') || url.protocol !== 'https:' ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Configure an HTTPS API origin without a path, credentials, query, or fragment.');
  }
  return url.origin;
}

export function resolvePublicMediaUrl(path: string): string {
  const origin = normalizeApiOrigin(process.env.EXPO_PUBLIC_BASE_URL);
  if (!origin) throw new Error('The API origin is not configured.');
  if (!/^\/media\/(profiles|businesses)\/[^?#\\]+$/.test(path)) throw new Error('A public API picture path is required.');
  const url = new URL(path, origin);
  if (!/^\/media\/(profiles|businesses)\//.test(url.pathname)) throw new Error('A public API picture path is required.');
  return url.href;
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

export function serializeQuery(params: QueryParams | URLSearchParams): string {
  const result = new URLSearchParams();
  const append = (key: string, value: QueryValue) => {
    if (value == null) return;
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new TypeError('Query filters must be scalar values.');
    if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
      throw new RangeError('Query numbers must be finite and integers must be safe.');
    }
    result.append(key, String(value));
  };
  if (params instanceof URLSearchParams) params.forEach((value, key) => append(key, value));
  else Object.entries(params).forEach(([key, values]) => {
    if (Array.isArray(values)) values.forEach(value => append(key, value));
    else append(key, values as QueryValue);
  });
  return result.toString();
}

/** Until a lossless int64 wire contract is agreed, refuse rounded identifiers. */
export class UnsafeJsonNumberError extends Error {
  constructor() { super('The response contains a number outside the supported precision range.'); }
}

export function assertSafeJsonNumbers(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
    throw new UnsafeJsonNumberError();
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  Object.values(value).forEach(item => assertSafeJsonNumbers(item, seen));
}

export function parseApiJson(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) => {
    if (typeof value === 'number') assertSafeJsonNumbers(value);
    return value;
  });
}

export function pageParams(page = 1, pageSize = 20) {
  if (!Number.isInteger(page) || page < 1 || page > 1000 ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError('Page must be 1–1000 and page size must be 1–100.');
  }
  return { page, pageSize };
}
