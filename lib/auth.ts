import { api, setToken, removeToken } from "./api";

export interface AdminUser {
  id:    string;
  name:  string;
  email: string;
  role:  string;
}

function decodeJwt(token: string): { role?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AdminUser> {
  const res = await api.post<{ token: string; user: AdminUser }>("/auth/login", {
    email,
    password,
  });
  const { token, user } = res.data as unknown as { token: string; user: AdminUser };

  const payload = decodeJwt(token);
  if (payload?.role !== "admin") {
    throw new Error("No tienes permisos de administrador.");
  }

  setToken(token);
  return user;
}

export function logout() {
  removeToken();
  window.location.href = "/login";
}
