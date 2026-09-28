import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";

import { getStoredCurrency, getStoredLanguage } from "../context/localePrefs";
import { UNKNOWN_API_ERROR, type ApiError } from "./types";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    _retried?: boolean;
  }
}

export const http = axios.create({ baseURL: API_BASE_URL });

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  config.headers.set("Accept-Language", getStoredLanguage());
  config.headers.set("X-Currency", getStoredCurrency());
  return config;
});

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiError).code === "string" &&
    typeof (value as ApiError).message === "string"
  );
}

export function normalizeApiError(error: unknown): ApiError {
  // Check this BEFORE isApiError: a raw AxiosError already has string
  // `.code` (e.g. "ERR_BAD_REQUEST") and `.message` fields of its own, so
  // isApiError's duck-typing matches it too — checking axios.isAxiosError
  // first (a reliable `isAxiosError` marker, not shape-based) makes sure a
  // real backend payload is always unwrapped instead of being shadowed by
  // axios's generic "Request failed with status code NNN" message.
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: ApiError }>;
    const payload = axiosError.response?.data?.error;
    if (payload) {
      return { ...payload, status: axiosError.response?.status };
    }
    return {
      code: axiosError.code ?? "network_error",
      message: axiosError.message,
      status: axiosError.response?.status,
    };
  }
  // The refresh call itself goes through this same interceptor chain, so by
  // the time its failure reaches refreshAccessToken()'s catch it has
  // already been normalized once (into a plain object, not an AxiosError)
  // — don't flatten it into UNKNOWN_API_ERROR.
  if (isApiError(error)) {
    return error;
  }
  return { ...UNKNOWN_API_ERROR };
}

// Single-flight refresh: concurrent 401s share one in-flight refresh call
// instead of each firing their own (simplejwt rotates refresh tokens, so a
// second concurrent refresh would invalidate the first's result anyway).
let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return Promise.reject(new Error("No refresh token available"));
  }

  // Goes through `http` (not a bare axios instance) — the response
  // interceptor's isRefreshCall check below prevents this from recursing
  // into itself, and reusing `http` keeps the Accept-Language/X-Currency
  // request headers consistent.
  refreshPromise = http
    .post<{ access: string; refresh: string }>("/auth/token/refresh/", { refresh: refreshToken })
    .then(({ data }) => {
      setTokens({ access: data.access, refresh: data.refresh });
      return data.access;
    })
    .catch((error) => {
      clearTokens();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    const isRefreshCall = config?.url?.includes("/auth/token/refresh/");

    if (error.response?.status === 401 && config && !config._retried && !isRefreshCall) {
      config._retried = true;
      try {
        const accessToken = await refreshAccessToken();
        config.headers.set("Authorization", `Bearer ${accessToken}`);
        return http.request(config as AxiosRequestConfig);
      } catch (refreshError) {
        return Promise.reject(normalizeApiError(refreshError));
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);
