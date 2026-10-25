import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

const TOKEN_KEY         = "amt_admin_token";
const REFRESH_TOKEN_KEY = "amt_admin_refresh";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export const api = axios.create({
  baseURL: apiUrl,
  timeout: 10_000,
});

/**
 * Con lo que se rechazan las peticiones que fallan: el mensaje del back y,
 * si los hay, el estado HTTP y su código de error (`code`), para distinguir
 * un error concreto sin comparar textos.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

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

/** Motivo con el que se manda a /login (?motivo=…): el formulario lo explica. */
export const LOGIN_REASON_CLUB_DEACTIVATED = "club-desactivado";

/** El back corta la sesión del admin de un club que AMT desactivó. */
function isClubDeactivated(err: unknown): boolean {
  return (err as { response?: { data?: { code?: string } } })?.response?.data?.code === "CLUB_DEACTIVATED";
}

function forceLogout(reason?: string) {
  removeTokens();
  const target = reason ? `/login?motivo=${reason}` : "/login";
  try {
    window.location.href = target;
  } catch {
    // Fallback si window no está disponible (SSR edge case)
    if (typeof window !== "undefined") window.location.replace(target);
  }
}

// ── Response interceptor: unwrap + refresh silencioso en 401 ──────────────
api.interceptors.response.use(
  (res) => (res.data?.data !== undefined ? { ...res, data: res.data.data ?? null } : res),
  async (err) => {
    const original = err.config as AxiosRequestConfig & { _retry?: boolean };

    // No interceptar 401 en rutas de autenticación — dejar pasar el error original
    const isAuthRoute = original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh');
    if (isAuthRoute) return Promise.reject(err);

    // AMT ha desactivado su club: tampoco tendrá sesión nueva, fuera ya
    if (err.response?.status === 401 && isClubDeactivated(err)) {
      forceLogout(LOGIN_REASON_CLUB_DEACTIVATED);
      return Promise.reject(err);
    }

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
        forceLogout(isClubDeactivated(refreshErr) ? LOGIN_REASON_CLUB_DEACTIVATED : undefined);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const message =
      err.response?.data?.message ??
      err.response?.data?.error ??
      "Error de conexión";
    const code = err.response?.data?.code;
    return Promise.reject(
      new ApiError(
        Array.isArray(message) ? message[0] : message,
        err.response?.status,
        typeof code === "string" ? code : undefined,
      ),
    );
  },
);

// Alias mantenido para compatibilidad con código antiguo
export function removeToken() {
  removeTokens();
}
