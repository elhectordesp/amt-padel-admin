import {
  api,
  ApiError,
  setToken,
  setRefreshToken,
  removeTokens,
  getRefreshToken,
  TOO_MANY_REQUESTS_MESSAGE,
} from "./api";

/** El admin de un club que AMT desactivó no entra hasta que AMT lo reactive. */
export const CLUB_DEACTIVATED_MESSAGE = "Tu club está desactivado. Contacta con AMT para reactivarlo.";

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
  } catch (err: unknown) {
    // /auth/login no pasa por el interceptor: llega el error de axios tal cual
    // ({ success, code, error } del back)
    const e = err as {
      response?: { status?: number; data?: { code?: string; error?: string; message?: string } };
    };
    const status = e?.response?.status;
    const serverMsg = e?.response?.data?.error ?? e?.response?.data?.message;
    if (e?.response?.data?.code === "CLUB_DEACTIVATED")
      throw new Error(CLUB_DEACTIVATED_MESSAGE);
    if (status === 401) throw new Error("Email o contraseña incorrectos.");
    if (status === 403) throw new Error("No tienes permisos para acceder.");
    if (status === 429) throw new Error(TOO_MANY_REQUESTS_MESSAGE);
    throw new Error(serverMsg ?? "Error al conectar con el servidor. Inténtalo de nuevo.");
  }
  const data = res.data as unknown as { token: string; refreshToken: string; user: AdminUser };

  setToken(data.token);
  if (data.refreshToken) setRefreshToken(data.refreshToken);

  // El role en el JWT es 'admin' (ADMIN/SUPERADMIN AMT), 'club' (admin de un
  // club concreto) o 'user' (PLAYER). Solo los dos primeros pueden entrar al
  // panel — al CLUB lo dejamos pasar y el backend ya filtra por su clubId.
  const payload = decodeJwtPayload(data.token);
  if (payload.role !== "admin" && payload.role !== "club") {
    removeTokens();
    throw new Error("No tienes permisos de administrador.");
  }

  return { ...data.user, role: payload.role as string };
}

/**
 * Acepta una invitación de admin de club. El token llega por email + lo
 * leemos del query string en /aceptar-invitacion. En éxito, el backend
 * devuelve token + refreshToken igual que login, y nos dejamos logueados.
 */
export async function acceptClubInvite(
  token: string,
  name: string,
  password: string,
): Promise<AdminUser> {
  let res;
  try {
    res = await api.post("/auth/accept-club-invite", { token, name, password });
  } catch (err: unknown) {
    // El interceptor de api.ts ya lo ha convertido en ApiError, con el código
    // y el texto del back (antes se buscaba en err.response y no estaba)
    const code = err instanceof ApiError ? err.code : undefined;
    if (code === "CLUB_INVITATION_INVALID")
      throw new Error("La invitación es inválida o ha caducado.");
    if (code === "CLUB_INVITATION_EMAIL_TAKEN")
      throw new Error("Ese email ya está registrado en la plataforma.");
    if (code === "CLUB_DEACTIVATED") throw new Error(CLUB_DEACTIVATED_MESSAGE);
    throw new Error(
      err instanceof ApiError && err.message ? err.message : "Error al aceptar la invitación.",
    );
  }
  const data = res.data as unknown as {
    token: string;
    refreshToken: string;
    user: AdminUser;
  };

  setToken(data.token);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  const payload = decodeJwtPayload(data.token);
  return { ...data.user, role: (payload.role as string) ?? "club" };
}

/**
 * El enlace ya se usó o caducó: hay que pedir otro. Lo mismo vale para un
 * jugador (la app) que para un admin o un club (el acceso al panel): los dos
 * tienen «¿Olvidaste tu contraseña?».
 */
export const RESET_LINK_EXPIRED_MESSAGE =
  "El enlace ha caducado o ya se ha usado. Pide uno nuevo desde la app o desde el acceso al panel con «¿Olvidaste tu contraseña?».";

/**
 * Lo mismo con el enlace de activar una cuenta creada por un admin o un club:
 * quien llega aquí puede no tener aún la app.
 */
export const ACTIVATE_LINK_EXPIRED_MESSAGE =
  "El enlace ha caducado o ya se ha usado. Pide uno nuevo desde la app o desde el acceso al panel con «¿Olvidaste tu contraseña?» o pide a quien te invitó que te reenvíe la invitación.";

/**
 * Pone la contraseña nueva con el token del enlace del email (restablecer o,
 * con `activate`, activar la cuenta): el mismo endpoint que usa la app. No
 * inicia sesión.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  { activate = false }: { activate?: boolean } = {},
): Promise<void> {
  try {
    await api.post("/auth/reset-password", { token, newPassword });
  } catch (err: unknown) {
    const code = err instanceof ApiError ? err.code : undefined;
    if (code === "RESET_LINK_INVALID" || code === "RESET_LINK_USED")
      throw new Error(activate ? ACTIVATE_LINK_EXPIRED_MESSAGE : RESET_LINK_EXPIRED_MESSAGE);
    throw new Error(
      err instanceof ApiError && err.message
        ? err.message
        : "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
    );
  }
}

export async function logout(onBeforeRedirect?: () => void) {
  const refreshToken = getRefreshToken();
  // Intentar revocar el refresh token en el servidor (best-effort)
  if (refreshToken) {
    api.post("/auth/logout", { refreshToken }).catch((e) => {
      console.error("[auth] Error revocando refresh token:", e);
    });
  }
  removeTokens();
  onBeforeRedirect?.();
  window.location.href = "/login";
}
