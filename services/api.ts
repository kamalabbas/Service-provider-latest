import { useAuthStore } from "@/stores/authStore";
import { getSessionGeneration, isRefreshBlocked, refreshAccessToken } from "@/services/authSession";
import { useToastStore } from "@/stores/toastStore";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, CanceledError, InternalAxiosRequestConfig } from "axios";

type SessionRequestConfig = AxiosRequestConfig & { _retry?: boolean; _sessionGeneration?: number };

// Create a configured Axios instance
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BASE_URL,
  timeout: 60000,
});

let sessionExpiredToastShown = false;

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

    if (!config.headers || !(config.headers instanceof axios.AxiosHeaders)) {
      config.headers = new axios.AxiosHeaders(config.headers);
    }

    if (token) config.headers.set("Authorization", `Bearer ${token}`);
    else config.headers.delete?.("Authorization");

    return config;
  },
  (error) => { throw error; },
  // Keep the generation check and dispatch in the same turn, including retries.
  { synchronous: true },
);

// --- Response Interceptor
api.interceptors.response.use(
  (response) => {
    sessionExpiredToastShown = false;
    return response;
  },
  async (error) => {
    const err = error as AxiosError<any>;
    const originalRequest = err.config as SessionRequestConfig | undefined;
    const generation = originalRequest?._sessionGeneration;

    if (generation !== undefined && generation !== getSessionGeneration()) return Promise.reject(error);

    console.log("API request failed. HTTP status:", err.response?.status);

    const detail = err.response?.data?.detail;

    // new approach without lock, using a shared promise
    if (err.response?.status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url?.includes("/Auth/Refresh")) {
      if (isRefreshBlocked()) return Promise.reject(error);

      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        if (generation !== getSessionGeneration()) return Promise.reject(error);

        if (!newToken) throw new Error("Refresh failed");

        originalRequest.headers = originalRequest.headers || {};
        (originalRequest.headers as any)["Authorization"] = `Bearer ${newToken}`;

        return api(originalRequest);
      } catch (refreshErr) {
        if (generation !== getSessionGeneration()) return Promise.reject(error);

        if (!sessionExpiredToastShown) {
          useToastStore.getState().showToast("Session expired. Please log in again.", "error");
          sessionExpiredToastShown = true;
        }
        return Promise.reject(refreshErr);
      }
    }

    if (detail && err.response?.status !== 401) {
      useToastStore.getState().showToast(detail, "error");
    }

    if (err.response?.status !== 401) {
      sessionExpiredToastShown = false;
    }

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
