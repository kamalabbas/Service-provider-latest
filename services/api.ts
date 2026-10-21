import { useAuthStore } from "@/stores/authStore";
import { getSessionGeneration, isRefreshBlocked, refreshAccessToken } from "@/services/authSession";
import { useToastStore } from "@/stores/toastStore";
import { ApiErrorAction, toAppError } from "@/services/apiError";
import axios, { AxiosHeaders, AxiosRequestConfig, AxiosResponse, CanceledError, InternalAxiosRequestConfig, isAxiosError, isCancel } from "axios";

type SessionRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean; _sessionGeneration?: number };

type RequestPolicy = { action?: ApiErrorAction; refresh: boolean; silent?: boolean };
const protectedRequest: RequestPolicy = { refresh: true };
// Only the retained endpoints with established request purposes are listed.
// Other configured API calls keep their existing protected-request behavior.
const requestPolicies: Record<string, RequestPolicy> = {
  "/auth/signin": { action: "signIn", refresh: false },
  "/auth/signup": { action: "register", refresh: false },
  "/auth/verifyemailotp": { action: "verifyCode", refresh: false },
  "/auth/sendemailotp": { action: "sendCode", refresh: false },
  "/auth/sendforgotpasswordotp": { action: "sendCode", refresh: false },
  "/auth/verifyforgotpasswordotp": { action: "verifyCode", refresh: false },
  "/auth/resetpassword": { action: "resetPassword", refresh: false },
  "/auth/refresh": { refresh: false, silent: true },
  "/auth/logout": { refresh: false, silent: true },
  "/auth/checkappversion": { refresh: false, silent: true },
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
  if (appError.kind === "cancelled" || context.silent || policy.silent ||
      (generation !== undefined && generation !== getSessionGeneration())) return;
  useToastStore.getState().showToast(appError.message, "error");
}

// Create a configured Axios instance
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BASE_URL,
  timeout: 60000,
});

// --- Request Interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const sessionConfig = config as InternalAxiosRequestConfig & SessionRequestConfig;
    const generation = getSessionGeneration();
    if (sessionConfig._sessionGeneration === undefined) {
      sessionConfig._sessionGeneration = generation;
    } else if (sessionConfig._sessionGeneration !== generation) {
      throw new CanceledError("Session changed before request dispatch.");
    }

    if (config.url?.includes("/Auth/Refresh")) {
      return config;
    }

    const token = useAuthStore.getState().accessToken;

    if (!config.headers || !(config.headers instanceof AxiosHeaders)) {
      config.headers = new AxiosHeaders(config.headers);
    }

    if (token) config.headers.set("Authorization", `Bearer ${token}`);
    // Logout uses its captured header after memory has already been cleared.
    // This exception cannot authorize other endpoints or bypass generation checks.
    else if (!(config.url === "/Auth/Logout" && isRefreshBlocked())) config.headers.delete?.("Authorization");

    return config;
  },
  (error) => { throw error; },
  // Keep the generation check and dispatch in the same turn, including retries.
  { synchronous: true },
);

// --- Response Interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const err = isAxiosError(error) ? error : undefined;
    const originalRequest = err?.config as SessionRequestConfig | undefined;
    const generation = originalRequest?._sessionGeneration;
    const policy = getRequestPolicy(originalRequest);

    if (isCancel(error) || err?.code === "ERR_CANCELED" || (generation !== undefined && generation !== getSessionGeneration())) {
      notifyApiError(error, { silent: true });
      return Promise.reject(error);
    }

    if (err?.response?.status === 401 && originalRequest && !originalRequest._retry && policy.refresh) {
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

// GET request
export const getData = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response: AxiosResponse<T> = await api.get(url, config);
  return response.data;
};

// POST request
export const postData = async <T, U>(url: string, data: T, config?: AxiosRequestConfig): Promise<U> => {
  const response: AxiosResponse<U> = await api.post(url, data, config);
  return response.data;
};

// PUT request
export const putData = async <T, U>(url: string, data: T, config?: AxiosRequestConfig): Promise<U> => {
  const response: AxiosResponse<U> = await api.put(url, data, config);
  return response.data;
};

// DELETE request
export const deleteData = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  const response: AxiosResponse<T> = await api.delete(url, config);
  return response.data;
};

export default api;
