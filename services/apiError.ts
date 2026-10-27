import { AxiosHeaders, type AxiosResponse, isAxiosError, isCancel } from "axios";
import { UnsafeJsonNumberError } from '@/utility/apiTransport';

export type ApiErrorAction = "signIn" | "register" | "verifyCode" | "sendCode" | "resetPassword" | "changeEmail" | "changePassword";

// Display-only projection. Never attach request configuration or log this data:
// approved validation messages can contain user-entered private information.
export interface AppError {
  kind: "network" | "timeout" | "http" | "cancelled" | "unknown";
  message: string;
  status?: number;
  code?: string;
  traceId?: string;
  validationErrors?: Record<string, string[]>;
  retryAfterSeconds?: number;
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : undefined;
const header = (response: Pick<AxiosResponse, 'headers'>, name: string): unknown =>
  response.headers instanceof AxiosHeaders ? response.headers.get(name) :
    Object.entries(response.headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];

export function getTraceId(response: Pick<AxiosResponse<unknown>, 'headers' | 'data'>): string | undefined {
  const values = [text(header(response, 'x-trace-id')), record(response.data) ? text(response.data.traceId) : undefined];
  return values.find(value => value && /^[A-Za-z0-9:._-]{1,200}$/.test(value));
}

function readProblem(response: AxiosResponse<unknown>): Record<string, unknown> | undefined {
  const contentType = header(response, 'content-type');
  if (typeof contentType !== 'string' || contentType.split(';')[0].trim().toLowerCase() !== 'application/problem+json') return;
  return record(response.data) ? response.data : undefined;
}

const actionMessages: Record<ApiErrorAction, string> = {
  signIn: "Unable to sign in. Check your details and try again.",
  register: "Unable to register. Check your details and try again.",
  verifyCode: "Unable to verify the code. Check it and try again.",
  sendCode: "Unable to request a code. Check your details and try again.",
  resetPassword: "Unable to reset your password. Please try again.",
  changeEmail: "Unable to change your email. Check your details and try again.",
  changePassword: "Unable to change your password. Check your details and try again.",
};

export function toAppError(error: unknown, action?: ApiErrorAction): AppError {
  if (error instanceof UnsafeJsonNumberError) return { kind: 'unknown', message: error.message };
  if (isCancel(error) || (isAxiosError(error) && error.code === "ERR_CANCELED")) {
    return { kind: "cancelled", message: "Request cancelled." };
  }

  const fallback = action ? actionMessages[action] : "Unable to complete the request. Please try again.";
  if (!isAxiosError(error)) return { kind: "unknown", message: fallback };

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return { kind: "timeout", message: "The request timed out. Please try again." };
  }

  if (error.response) {
    const status = error.response.status;
    let message = fallback;
    if (status === 403) message = "You don't have permission to complete this request.";
    else if (status === 404) message = "The requested record is unavailable.";
    else if (status === 413) message = "The selected file is too large.";
    else if (status === 429) message = "Too many requests. Please wait and try again.";
    else if (status >= 500) message = "The service is temporarily unavailable. Please try again later.";
    else if (!action && status === 401) message = "Unable to authorize this request. Please try again.";
    else if (!action && (status === 400 || status === 422)) message = "Please check the information you entered and try again.";
    const problem = readProblem(error.response);
    const problemCode = text(problem?.code);
    const code = problemCode && /^[A-Z][A-Z0-9_]{0,63}$/.test(problemCode) ? problemCode : undefined;
    const traceId = getTraceId(error.response);
    const result: AppError = { kind: 'http', status, message };
    if (code) result.code = code;
    if (traceId) result.traceId = traceId;
    if (status === 400 && code === 'VALIDATION_FAILED') {
      result.message = text(problem?.detail) ?? message;
      if (record(problem?.errors)) {
        const entries = Object.entries(problem.errors)
          .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(item => typeof item === 'string'));
        result.validationErrors = Object.fromEntries(entries);
      }
    }
    if (status === 503 && code === 'EMAIL_DELIVERY_FAILED') {
      result.message = 'Email delivery is temporarily unavailable. Your account may already exist; try resending verification or retry recovery later.';
    }
    if (status === 429) {
      const retryAfter = header(error.response, 'retry-after');
      if (typeof retryAfter === 'string') {
        const seconds = /^\d+$/.test(retryAfter) ? Number(retryAfter) : Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000);
        if (Number.isFinite(seconds) && seconds >= 0) result.retryAfterSeconds = seconds;
      }
    }
    return result;
  }

  if (error.code === "ERR_NETWORK" || error.request) {
    return { kind: "network", message: "Unable to connect. Check your connection and try again." };
  }
  return { kind: "unknown", message: fallback };
}

/** Map only known controls. Unrecognized model paths/Identity codes stay visible. */
export function mapApiValidation<TField extends string>(error: unknown, fields: readonly TField[], aliases: Readonly<Record<string, TField>> = {}) {
  const info = toAppError(error);
  const fieldErrors = Object.create(null) as Partial<Record<TField, string>>;
  const summary: string[] = [];
  const normalize = (key: string) => key.replace(/\[(\d+)\]/g, '.$1').toLowerCase();
  const known = new Map(fields.map(field => [normalize(field), field]));
  Object.entries(aliases).forEach(([alias, field]) => {
    if (fields.includes(field)) known.set(normalize(alias), field);
  });
  Object.entries(info.validationErrors ?? {}).forEach(([key, messages]) => {
    const field = known.get(normalize(key));
    if (field) fieldErrors[field] = [...new Set([fieldErrors[field], ...messages].filter(Boolean))].join('\n');
    else summary.push(...messages);
  });
  return { fieldErrors, summary: [...new Set(summary)], message: info.message, traceId: info.traceId };
}
