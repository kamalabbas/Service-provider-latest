/** IDs remain numbers; membership/card numbers and JWT subjects are separate types. */
export function requireDatabaseId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError('A positive, safe integer database ID is required.');
  return value;
}

export function requireCoordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError('Latitude or longitude is outside its valid range.');
  }
  return { latitude, longitude };
}

/** Monetary calculations use integer cents; JSON API amounts remain AUD dollars. */
export function audToCents(amount: string | number): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount));
  if (!match) throw new RangeError('An AUD amount must be positive with at most two decimal places.');
  const cents = Number(match[1] + (match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new RangeError('The AUD amount is outside its supported range.');
  return cents;
}

export function centsToAud(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new RangeError('A positive, safe integer cent amount is required.');
  const amount = cents / 100;
  // Refuse values whose dollar representation cannot round-trip without loss.
  if (audToCents(amount) !== cents) throw new RangeError('The AUD amount cannot be serialized precisely.');
  return amount;
}

export function formatAud(amount: string | number, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'AUD' }).format(centsToAud(audToCents(amount)));
}

export function toUtcTimestamp(value: Date | string): string {
  if (typeof value === 'string') {
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!parts) throw new RangeError('A timestamp must include seconds and an explicit UTC offset.');
    const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) {
      throw new RangeError('The timestamp is invalid.');
    }
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('The timestamp is invalid.');
  return date.toISOString();
}

export function formatLocalTimestamp(value: string, locale?: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(toUtcTimestamp(value)));
}
