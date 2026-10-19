import { useAuthStore } from "@/stores/authStore";
import { isRefreshBlocked, refreshAccessToken } from "@/services/authSession";
import { useToastStore } from "@/stores/toastStore";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// Create a configured Axios instance
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_BASE_URL,
  timeout: 60000,
});

let sessionExpiredToastShown = false;

// --- Request Interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // const token = useAuthStore.getState().accessToken;
    if (config.url?.includes("/Auth/Refresh")) {
      return config;
    }

    const token = useAuthStore.getState().accessToken;

    console.log("➡️ Request URL:", config.url);
    // console.log("➡️ Headers:", config.headers);
    console.log("➡️ Body:", config?.data?.data?.data);

    if (!config.headers || !(config.headers instanceof axios.AxiosHeaders)) {
      config.headers = new axios.AxiosHeaders(config.headers);
    }

    if (token) config.headers.set("Authorization", `Bearer ${token}`);
    else config.headers.delete?.("Authorization");

    return config;
  },
  (error) => Promise.reject(error),
);

// --- Response Interceptor
api.interceptors.response.use(
  (response) => {
    sessionExpiredToastShown = false;
    return response;
  },
  async (error) => {
    const err = error as AxiosError<any>;
    const originalRequest = err.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    console.log("⛔ RESPONSE ERROR:", err?.response);
    console.log("  URL:", originalRequest?.url);
    console.log("  STATUS:", err.response?.status);
    console.log("  DATA:", err.response?.data);

    const detail = err.response?.data?.detail;

    // new approach without lock, using a shared promise
    if (err.response?.status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url?.includes("/Auth/Refresh")) {
      if (isRefreshBlocked()) return Promise.reject(error);

      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();

        if (!newToken) throw new Error("Refresh failed");

        originalRequest.headers = originalRequest.headers || {};
        (originalRequest.headers as any)["Authorization"] = `Bearer ${newToken}`;

        return api(originalRequest);
      } catch (refreshErr) {
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
