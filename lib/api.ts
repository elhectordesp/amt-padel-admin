import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

const TOKEN_KEY         = "amt_admin_token";
const REFRESH_TOKEN_KEY = "amt_admin_refresh";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is not defined. Add it to your .env.local file.');

export const api = axios.create({
  baseURL: apiUrl,
  timeout: 10_000,
});

// ── Token helpers ──────────────────────────────────────────────────────────
const SECURE_COOKIE = process.env.NODE_ENV === "production";

export function setToken(token: string) {
  Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: "strict", secure: SECURE_COOKIE });
}

export function setRefreshToken(token: string) {
  Cookies.set(REFRESH_TOKEN_KEY, token, { expires: 7, sameSite: "strict", secure: SECURE_COOKIE });
}

export function removeTokens() {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
}

export function getToken() {
  return Cookies.get(TOKEN_KEY) ?? null;
}

export function getRefreshToken() {
  return Cookies.get(REFRESH_TOKEN_KEY) ?? null;
}

// ── Request interceptor: adjunta el token a cada petición ─────────────────
api.interceptors.request.use((config) => {
  const token = Cookies.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Refresh token logic ────────────────────────────────────────────────────
let isRefreshing = false;
type QueueItem = { resolve: (token: string) => void; reject: (err: unknown) => void };
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

function forceLogout() {
  removeTokens();
  try {
    window.location.href = "/login";
  } catch {
    // Fallback si window no está disponible (SSR edge case)
    if (typeof window !== "undefined") window.location.replace("/login");
  }
}

// ── Response interceptor: unwrap + refresh silencioso en 401 ──────────────
api.interceptors.response.use(
  (res) => (res.data?.data !== undefined ? { ...res, data: res.data.data ?? null } : res),
  async (err) => {
    const original = err.config as AxiosRequestConfig & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry) {
      const refreshToken = getRefreshToken();

      // Sin refresh token → logout inmediato
      if (!refreshToken) {
        forceLogout();
        return Promise.reject(err);
      }

      // Si ya hay un refresh en curso, encolar y esperar
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
              resolve(api(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${apiUrl}/auth/refresh`,
          { refreshToken },
        );
        // La respuesta está envuelta en { success, data: { token, refreshToken } }
        const tokens = data?.data ?? data;
        setToken(tokens.token);
        setRefreshToken(tokens.refreshToken);

        processQueue(null, tokens.token);
        original.headers = { ...original.headers, Authorization: `Bearer ${tokens.token}` };
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        forceLogout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const message =
      err.response?.data?.message ??
      err.response?.data?.error ??
      "Error de conexión";
    return Promise.reject(new Error(Array.isArray(message) ? message[0] : message));
  },
);

// Alias mantenido para compatibilidad con código antiguo
export function removeToken() {
  removeTokens();
}
