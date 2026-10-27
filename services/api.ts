import { useAuthStore } from "@/stores/authStore";
import { AuthenticationOperation, clearSession, getSessionGeneration, isCurrentAuthenticationOperation, isRefreshBlocked, refreshAccessToken } from "@/services/authSession";
import { useToastStore } from "@/stores/toastStore";
import { ApiErrorAction, toAppError } from "@/services/apiError";
import { assertSafeJsonNumbers, normalizeApiOrigin, parseApiJson, serializeQuery } from '@/utility/apiTransport';
import { create, AxiosHeaders, AxiosRequestConfig, AxiosResponse, CanceledError, InternalAxiosRequestConfig, isAxiosError, isCancel } from "axios";

type SessionRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sessionGeneration?: number;
  _authenticationOperation?: AuthenticationOperation;
  _hadAccessToken?: boolean;
};

const staleAuthentication = (config?: SessionRequestConfig) => Boolean(
  config?._authenticationOperation && !isCurrentAuthenticationOperation(config._authenticationOperation)
);

type RequestPolicy = { action?: ApiErrorAction; refresh: boolean; silent?: boolean };
const protectedRequest: RequestPolicy = { refresh: true };
// Only the retained endpoints with established request purposes are listed.
// Other configured API calls keep their existing protected-request behavior.
const requestPolicies: Record<string, RequestPolicy> = {
  '/api/auth/register': { action: 'register', refresh: false },
  '/api/auth/verify-email': { action: 'verifyCode', refresh: false },
  '/api/auth/resend-verification': { action: 'sendCode', refresh: false },
  '/api/auth/request-password-recovery': { action: 'sendCode', refresh: false },
  '/api/auth/check-password-recovery-code': { action: 'verifyCode', refresh: false },
  '/api/auth/reset-password': { action: 'resetPassword', refresh: false },
  '/api/auth/mobile/sign-in': { action: 'signIn', refresh: false },
  '/api/auth/mobile/refresh': { refresh: false, silent: true },
  '/api/auth/mobile/sign-out': { refresh: false, silent: true },
  '/health/live': { refresh: false, silent: true },
  '/health/ready': { refresh: false, silent: true },
  "/auth/signin": { action: "signIn", refresh: false },
  "/auth/signup": { action: "register", refresh: false },
  "/auth/verifyemailotp": { action: "verifyCode", refresh: false },
  "/auth/sendemailotp": { action: "sendCode", refresh: false },
  "/auth/sendforgotpasswordotp": { action: "sendCode", refresh: false },
  "/auth/verifyforgotpasswordotp": { action: "verifyCode", refresh: false },
  "/auth/resetpassword": { action: "resetPassword", refresh: false },
  "/auth/refresh": { refresh: false, silent: true },
  "/auth/logout": { refresh: false, silent: true },
  "/auth/credentials/changeemail": { action: "changeEmail", refresh: true },
  "/auth/credentials/verifynewemail": { action: "verifyCode", refresh: true },
  "/auth/credentials/changepassword": { action: "changePassword", refresh: true },
  "/pushnotification/register": { refresh: true, silent: true },
};

const getRequestPolicy = (config?: AxiosRequestConfig): RequestPolicy => {
  let path = config?.url ?? "";
  if (/^https?:\/\//i.test(path)) {
    try { path = new URL(path).pathname; } catch { return protectedRequest; }
  }
  path = path.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
  return requestPolicies[path.startsWith("/") ? path : `/${path}`] ?? protectedRequest;
};

const handledErrors = new WeakSet<object>();
export function notifyApiError(error: unknown, context: { action?: ApiErrorAction; generation?: number; silent?: boolean } = {}) {
  // Both the interceptor and a mutation/catch may see the same failure. Silent
  // errors are also marked so a later callback cannot surface them again.
  if (error !== null && (typeof error === "object" || typeof error === "function")) {
    if (handledErrors.has(error)) return;
    handledErrors.add(error);
  }
  const config = isAxiosError(error) ? error.config as SessionRequestConfig | undefined : undefined;
  const generation = context.generation ?? config?._sessionGeneration;
  const policy = getRequestPolicy(config);
  const appError = toAppError(error, context.action ?? policy.action);
  if (appError.kind === "cancelled" || context.silent || policy.silent || staleAuthentication(config) ||
      (generation !== undefined && generation !== getSessionGeneration())) return;
  const messages = [appError.message, ...Object.values(appError.validationErrors ?? {}).flat()];
  if (appError.status === 500 && appError.traceId) messages.push(`Reference: ${appError.traceId}`);
  useToastStore.getState().showToast([...new Set(messages)].join('\n'), "error");
}

// Create a configured Axios instance
const api = create({
  baseURL: normalizeApiOrigin(process.env.EXPO_PUBLIC_BASE_URL),
  timeout: 60000,
  headers: { Accept: 'application/json, application/problem+json' },
  paramsSerializer: { serialize: serializeQuery },
  transformResponse: [function (data, headers) {
    if (this.responseType && this.responseType !== 'json') return data;
    if (typeof data !== 'string') {
      assertSafeJsonNumbers(data);
      return data;
    }
    const contentType = String(headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (contentType && contentType !== 'application/json' && !contentType.endsWith('+json')) return data;
    try { return parseApiJson(data); } catch (error) {
      if (error instanceof SyntaxError && this.responseType !== 'json') return data;
      throw error;
    }
  }],
});

// --- Request Interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const sessionConfig = config as InternalAxiosRequestConfig & SessionRequestConfig;
    const generation = getSessionGeneration();
    if (staleAuthentication(sessionConfig)) {
      const cancelled = new CanceledError("Authentication operation was superseded.");
      cancelled.config = config;
      throw cancelled;
    }
    if (sessionConfig._sessionGeneration === undefined) {
      sessionConfig._sessionGeneration = generation;
    } else if (sessionConfig._sessionGeneration !== generation) {
      throw new CanceledError("Session changed before request dispatch.");
    }

    if (config.url?.includes("/Auth/Refresh")) {
      return config;
    }

    const sameOrigin = api.defaults.baseURL && new URL(config.url ?? '', config.baseURL ?? api.defaults.baseURL).origin === api.defaults.baseURL;
    const token = sameOrigin ? useAuthStore.getState().accessToken : null;
    sessionConfig._hadAccessToken = Boolean(token);
    if (!(typeof FormData !== 'undefined' && config.data instanceof FormData)) assertSafeJsonNumbers(config.data);

    if (!config.headers || !(config.headers instanceof AxiosHeaders)) {
      config.headers = new AxiosHeaders(config.headers);
    }

    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
      config.headers.set('Cache-Control', 'no-store');
    }
    // Logout uses its captured header after memory has already been cleared.
    // This exception cannot authorize other endpoints or bypass generation checks.
    else if (!sameOrigin || !(config.url === "/Auth/Logout" && isRefreshBlocked())) config.headers.delete?.("Authorization");

    return config;
  },
  (error) => { throw error; },
  // Keep the generation check and dispatch in the same turn, including retries.
  { synchronous: true },
);

// --- Response Interceptor
api.interceptors.response.use(
  (response) => {
    if (staleAuthentication(response.config as SessionRequestConfig)) {
      const cancelled = new CanceledError("Authentication operation was superseded.");
      cancelled.config = response.config;
      throw cancelled;
    }
    return response;
  },
  async (error: unknown) => {
    const err = isAxiosError(error) ? error : undefined;
    const originalRequest = err?.config as SessionRequestConfig | undefined;
    const generation = originalRequest?._sessionGeneration;
    const policy = getRequestPolicy(originalRequest);

    if (isCancel(error) || err?.code === "ERR_CANCELED" || staleAuthentication(originalRequest) ||
        (generation !== undefined && generation !== getSessionGeneration())) {
      notifyApiError(error, { silent: true });
      return Promise.reject(error);
    }

    if (err?.response?.status === 401 && originalRequest && policy.refresh && originalRequest._hadAccessToken) {
      if (originalRequest._retry) {
        notifyApiError(error);
        await clearSession();
        return Promise.reject(error);
      }
      if (isRefreshBlocked()) {
        notifyApiError(error, { silent: true });
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        if (generation !== getSessionGeneration()) {
          notifyApiError(error, { silent: true });
          return Promise.reject(error);
        }

        if (!newToken) throw new Error("Refresh failed");

        originalRequest.headers = new AxiosHeaders(originalRequest.headers);
        originalRequest.headers.set("Authorization", `Bearer ${newToken}`);

        return api(originalRequest);
      } catch (refreshErr) {
        if (generation !== getSessionGeneration()) {
          notifyApiError(error, { silent: true });
          return Promise.reject(error);
        }
        notifyApiError(refreshErr, { action: policy.action, generation, silent: policy.silent });
        return Promise.reject(refreshErr);
      }
    }

    notifyApiError(error);
    return Promise.reject(error);
  },
);

// Helpers return the complete HTTP body, preserving envelope metadata and null data.
// TResponse is the full body type: use ApiResponse<Payload> for typed business data,
// or an explicit legacy/raw response type. No runtime envelope validation is applied.
// GET request
export const getData = async <TResponse = unknown>(url: string, config?: AxiosRequestConfig): Promise<TResponse> => {
  const response: AxiosResponse<TResponse> = await api.get(url, config);
  return response.data;
};

// POST request
export const postData = async <TRequest, TResponse = unknown>(url: string, data: TRequest, config?: AxiosRequestConfig): Promise<TResponse> => {
  const response: AxiosResponse<TResponse> = await api.post(url, data, config);
  return response.data;
};

// PUT request
export const putData = async <TRequest, TResponse = unknown>(url: string, data: TRequest, config?: AxiosRequestConfig): Promise<TResponse> => {
  const response: AxiosResponse<TResponse> = await api.put(url, data, config);
  return response.data;
};

// DELETE request
export const deleteData = async <TResponse = unknown>(url: string, config?: AxiosRequestConfig): Promise<TResponse> => {
  const response: AxiosResponse<TResponse> = await api.delete(url, config);
  return response.data;
};

export default api;
