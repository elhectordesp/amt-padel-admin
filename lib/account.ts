import { api, ApiError, setToken, setRefreshToken } from "./api";

/**
 * La cuenta con la que se ha entrado al panel: su perfil, cambiar la
 * contraseña y pedir una nueva si se ha olvidado. Usa los mismos endpoints
 * que la app.
 */

/** Lo que se ve y se edita en «Mi perfil» (de GET /users/me). */
export interface MyProfile {
  id:        string;
  name:      string;
  firstName: string | null;
  lastName:  string | null;
  email:     string | null;
  phone:     string | null;
}

export interface MyProfileUpdate {
  firstName: string;
  lastName:  string;
  /** null lo borra. */
  phone:     string | null;
}

export const MY_PROFILE_QUERY_KEY = ["my-profile"] as const;

export function getMyProfile(): Promise<MyProfile> {
  return api.get<MyProfile>("/users/me").then((r) => r.data);
}

export function updateMyProfile(data: MyProfileUpdate): Promise<void> {
  return api.patch("/users/me", data).then(() => undefined);
}

/**
 * Pide el email con el enlace para elegir una contraseña nueva. El back
 * responde lo mismo exista o no la cuenta (no delata quién está registrado).
 */
export function requestPasswordReset(email: string): Promise<void> {
  return api.post("/auth/forgot-password", { email: email.trim() }).then(() => undefined);
}

/**
 * Cambia la contraseña sabiendo la actual. El back cierra al instante todas
 * las sesiones de la cuenta (las de otros navegadores y la app) y devuelve
 * una nueva para este navegador, que se guarda para no echar a quien la
 * acaba de cambiar.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data } = await api.patch<{ token: string; refreshToken: string }>(
    "/auth/change-password",
    { currentPassword, newPassword },
  );
  setToken(data.token);
  setRefreshToken(data.refreshToken);
}

export type ProfileField = "firstName" | "lastName" | "phone";

/**
 * El formulario del perfil al abrirlo. Los admins de club se crean solo con
 * `name` (al aceptar la invitación del club), sin nombre ni apellidos: se
 * parte `name` como en «Editar datos» de la ficha del jugador, para que no
 * vean el formulario vacío.
 */
export function initialProfileForm(profile: MyProfile): Record<ProfileField, string> {
  const phone = profile.phone ?? "";
  if (profile.firstName === null && profile.lastName === null) {
    const [firstName = "", ...rest] = profile.name.trim().split(/\s+/);
    return { firstName, lastName: rest.join(" "), phone };
  }
  return { firstName: profile.firstName ?? "", lastName: profile.lastName ?? "", phone };
}

/**
 * Lo que está mal en el formulario del perfil, por campo (vacío si nada). Los
 * apellidos son opcionales: quien solo tiene un nombre (p. ej. el de su club)
 * tiene que poder guardar su teléfono.
 */
export function profileProblems(form: Record<ProfileField, string>): Partial<Record<ProfileField, string>> {
  const problems: Partial<Record<ProfileField, string>> = {};
  if (!form.firstName.trim()) problems.firstName = "Escribe tu nombre.";
  else if (form.firstName.trim().length > 100) problems.firstName = "Como mucho 100 caracteres.";
  if (form.lastName.trim().length > 100) problems.lastName = "Como mucho 100 caracteres.";
  const phone = form.phone.trim();
  // Opcional; si se pone, un teléfono: dígitos, espacios, guiones, paréntesis y un + inicial
  if (phone && (!/^\+?[\d\s().-]{6,20}$/.test(phone) || (phone.match(/\d/g) ?? []).length < 6))
    problems.phone = "No parece un teléfono.";
  return problems;
}

/** Las reglas del back para una contraseña nueva: 8 caracteres, una mayúscula y un número. */
export const PASSWORD_RULES = "Mínimo 8 caracteres, con una mayúscula y un número.";

/** Qué le falta a una contraseña nueva; null si cumple. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Tiene que tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(password)) return "Tiene que tener al menos una mayúscula.";
  if (!/\d/.test(password)) return "Tiene que tener al menos un número.";
  return null;
}

/** El texto de un error de estas pantallas. */
export function accountErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
    if (err.code === "CURRENT_PASSWORD_WRONG") return "La contraseña actual no es correcta.";
    if (err.code === "NO_PASSWORD_CONFIGURED")
      return "Esta cuenta aún no tiene contraseña. Pide una con «¿Olvidaste la contraseña?» en la pantalla de entrada.";
    if (err.message) return err.message;
  }
  return fallback;
}
