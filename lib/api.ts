import axios from "axios";
import Cookies from "js-cookie";

const TOKEN_KEY = "amt_admin_token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://192.168.18.19:3000/api",
  timeout: 10_000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = Cookies.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap { success, data } and handle 401
api.interceptors.response.use(
  (res) => (res.data?.data !== undefined ? { ...res, data: res.data.data } : res),
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove(TOKEN_KEY);
      window.location.href = "/login";
    }
    const message =
      err.response?.data?.message ??
      err.response?.data?.error ??
      "Error de conexión";
    return Promise.reject(new Error(Array.isArray(message) ? message[0] : message));
  },
);

export function setToken(token: string) {
  Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: "strict" });
}

export function removeToken() {
  Cookies.remove(TOKEN_KEY);
}

export function getToken() {
  return Cookies.get(TOKEN_KEY) ?? null;
}
