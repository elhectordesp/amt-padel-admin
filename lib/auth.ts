import { api, setToken, setRefreshToken, removeTokens, getRefreshToken } from "./api";

export interface AdminUser {
  id:    string;
  name:  string;
  email: string;
  role:  string;
}

export async function login(email: string, password: string): Promise<AdminUser> {
  const res = await api.post("/auth/login", { email, password });
  const { token, refreshToken } = res.data as unknown as {
    token: string;
    refreshToken: string;
    user: AdminUser;
  };

  // Guardar el token antes de verificar el rol para que el interceptor lo adjunte
  setToken(token);
  if (refreshToken) setRefreshToken(refreshToken);

  // Verificar el rol en el servidor, no decodificando el JWT en el cliente
  // (un JWT local puede estar manipulado o desactualizado)
  // El interceptor de axios ya desenvuelve res.data.data → recibimos AdminUser directamente
  const me = await api.get("/users/me") as unknown as AdminUser;
  if (me?.role !== "admin" && me?.role !== "ADMIN") {
    removeTokens();
    throw new Error("No tienes permisos de administrador.");
  }

  return me;
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
