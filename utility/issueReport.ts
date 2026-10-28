import type { CreateIssueReportRequest } from "@/interfaces/notification.interface";

/** The whole JSON body, UTF-8 encoded, must fit in this many bytes. */
export const ISSUE_REPORT_MAX_BYTES = 8192;

/** UTF-8 byte length without relying on TextEncoder. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

// Client-side redaction. The backend also screens, but that isn't a substitute.
const REDACTIONS: readonly [RegExp, string][] = [
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]"],
  [/Expo(nent)?PushToken\[[^\]]*\]/g, "[push token]"],
  [/\b(password|passwd|pwd|token|refresh[_-]?token|access[_-]?token|secret|api[_-]?key|cookie|authorization|code)\b(\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi, "$1$2[redacted]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  // Verification and completion codes are six digits.
  [/\b\d{6}\b/g, "[code]"],
];

export function redact(text: string): string {
  return REDACTIONS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

const clean = (value: string | null | undefined, max: number) => {
  const text = redact((value ?? "").trim());
  return text ? [...text].slice(0, max).join("") : null;
};

const size = (body: CreateIssueReportRequest) => utf8Length(JSON.stringify(body));

/** Shortens optional context, then the message, until the payload fits. */
function fit(body: CreateIssueReportRequest): CreateIssueReportRequest {
  const next = { ...body };
  while (size(next) > ISSUE_REPORT_MAX_BYTES && next.context) {
    const chars = [...next.context];
    next.context = chars.length > 20 ? chars.slice(0, Math.floor(chars.length * 0.8)).join("") : null;
  }
  while (size(next) > ISSUE_REPORT_MAX_BYTES && next.errorMessage.length > 20) {
    const chars = [...next.errorMessage];
    next.errorMessage = chars.slice(0, Math.floor(chars.length * 0.8)).join("");
  }
  return next;
}

/**
 * A concise, redacted report within the field limits and the 8192-byte total.
 * Never pass request/response dumps; send the failing API's trace ID instead.
 */
export function buildIssueReport(input: CreateIssueReportRequest): CreateIssueReportRequest {
  const attemptedAction = clean(input.attemptedAction, 150);
  const errorMessage = clean(input.errorMessage, 2000);
  if (!attemptedAction || !errorMessage) throw new Error("Describe what you were doing and what went wrong.");
  return fit({
    platform: input.platform,
    appVersion: clean(input.appVersion, 80) ?? "unknown",
    attemptedAction,
    errorMessage,
    deviceModel: clean(input.deviceModel, 150),
    context: clean(input.context, 4000),
    clientTraceId: input.clientTraceId?.trim() && /^[A-Za-z0-9:._-]{1,100}$/.test(input.clientTraceId.trim()) ? input.clientTraceId.trim() : null,
  });
}
