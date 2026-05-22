import { api, setToken, setRefreshToken, removeTokens, getRefreshToken } from "./api";

export interface AdminUser {
  id:    string;
  name:  string;
  email: string;
  role:  string;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

export async function login(email: string, password: string): Promise<AdminUser> {
  let res;
  try {
    res = await api.post("/auth/login", { email, password });
  } catch (err: any) {
    const status = err?.response?.status;
    const serverMsg = err?.response?.data?.message;
    if (status === 401) throw new Error("Email o contraseña incorrectos.");
    if (status === 403) throw new Error("No tienes permisos para acceder.");
    throw new Error(serverMsg ?? "Error al conectar con el servidor. Inténtalo de nuevo.");
  }
  const data = res.data as unknown as { token: string; refreshToken: string; user: AdminUser };

  setToken(data.token);
  if (data.refreshToken) setRefreshToken(data.refreshToken);

  // El role en el JWT es 'admin' (minúscula) para ADMIN, 'user' para PLAYER
  const payload = decodeJwtPayload(data.token);
  if (payload.role !== "admin") {
    removeTokens();
    throw new Error("No tienes permisos de administrador.");
  }

  return { ...data.user, role: payload.role as string };
}

export async function logout() {
  const refreshToken = getRefreshToken();
  // Intentar revocar el refresh token en el servidor (best-effort)
  if (refreshToken) {
    api.post("/auth/logout", { refreshToken }).catch((e) => {
      console.error("[auth] Error revocando refresh token:", e);
    });
  }
  removeTokens();
  window.location.href = "/login";
}
