import {
  api,
  ApiError,
  setToken,
  setRefreshToken,
  removeTokens,
  getRefreshToken,
  TOO_MANY_REQUESTS_MESSAGE,
} from "./api";
import type { ClubMembership } from "./club-permissions";

/** El admin de un club que AMT desactivó no entra hasta que AMT lo reactive. */
export const CLUB_DEACTIVATED_MESSAGE = "Tu club está desactivado. Contacta con AMT para reactivarlo.";

export interface AdminUser {
  id:    string;
  name:  string;
  email: string;
  role:  string;
  /** Los clubes en los que trabaja (equipo) y con cuál está trabajando ahora. */
  clubs?:        ClubMembership[];
  activeClubId?: string | null;
  /** Entró como jugador con varios clubes: falta elegir con cuál (/elegir-club). */
  needsClubChoice?: boolean;
}

export const NO_ADMIN_PERMISSIONS_MESSAGE = "No tienes permisos de administrador.";
export const INVITATION_WRONG_ACCOUNT_MESSAGE =
  "Esta invitación es para otro email: entra con esa cuenta.";

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

/**
 * `keepPlayerSession`: quien va a aceptar una invitación al equipo puede no
 * tener aún ningún club; su sesión de jugador se conserva tal cual.
 */
export async function login(
  email: string,
  password: string,
  { keepPlayerSession = false }: { keepPlayerSession?: boolean } = {},
): Promise<AdminUser> {
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

  // El role en el JWT es 'admin' (ADMIN/SUPERADMIN AMT), 'club' (equipo de un
  // club, con ese club activo) o 'user' (jugador). Un jugador entra al panel
  // solo si es del equipo de algún club: con uno, entra en él; con varios,
  // elige (/elegir-club); sin ninguno, no tiene acceso.
  const payload = decodeJwtPayload(data.token);
  if (payload.role === "user") {
    if (keepPlayerSession) return { ...data.user, role: "user" };
    const clubs = data.user.clubs ?? [];
    if (clubs.length === 0) {
      removeTokens();
      throw new Error(NO_ADMIN_PERMISSIONS_MESSAGE);
    }
    if (clubs.length > 1) return { ...data.user, role: "user", needsClubChoice: true };
    return activateClub(clubs[0].clubId);
  }
  if (payload.role !== "admin" && payload.role !== "club") {
    removeTokens();
    throw new Error(NO_ADMIN_PERMISSIONS_MESSAGE);
  }

  return { ...data.user, role: payload.role as string };
}

/**
 * Pasa a trabajar con ese club (o con ninguno, `null`): el back devuelve la
 * sesión nueva y se guarda como en el login.
 */
export async function activateClub(clubId: string | null): Promise<AdminUser> {
  let res;
  try {
    res = await api.post("/auth/active-club", { clubId, refreshToken: getRefreshToken() });
  } catch (err: unknown) {
    const code = err instanceof ApiError ? err.code : undefined;
    if (code === "CLUB_DEACTIVATED") throw new Error(CLUB_DEACTIVATED_MESSAGE);
    if (code === "CLUB_STAFF_NOT_MEMBER")
      throw new Error("Ya no formas parte del equipo de ese club.");
    throw new Error(
      err instanceof ApiError && err.message ? err.message : "No se pudo cambiar de club. Inténtalo de nuevo.",
    );
  }
  const data = res.data as unknown as { token: string; refreshToken: string; user: AdminUser };
  setToken(data.token);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  const payload = decodeJwtPayload(data.token);
  return { ...data.user, role: (payload.role as string) ?? "club" };
}

/**
 * Acepta una invitación al equipo de un club (hay que tener sesión). El back
 * devuelve la sesión ya con ese club activo y se guarda.
 */
export async function acceptStaffInvitation(
  token: string,
): Promise<{ clubId: string; clubName: string }> {
  let res;
  try {
    res = await api.post("/auth/club-staff-invitations/accept", { token });
  } catch (err: unknown) {
    const code = err instanceof ApiError ? err.code : undefined;
    if (code === "CLUB_INVITATION_WRONG_ACCOUNT") throw new Error(INVITATION_WRONG_ACCOUNT_MESSAGE);
    if (code === "CLUB_INVITATION_INVALID")
      throw new Error("La invitación es inválida o ha caducado. Pide que te la reenvíen.");
    if (code === "CLUB_DEACTIVATED") throw new Error(CLUB_DEACTIVATED_MESSAGE);
    throw new Error(
      err instanceof ApiError && err.message ? err.message : "Error al aceptar la invitación.",
    );
  }
  const data = res.data as unknown as {
    token: string; refreshToken: string; clubId: string; clubName: string;
  };
  setToken(data.token);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  return { clubId: data.clubId, clubName: data.clubName };
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
