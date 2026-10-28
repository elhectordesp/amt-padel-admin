/**
 * Quién puede tener sesión en el panel, compartido por el middleware (al
 * pedir una página) y por el cliente de la API (al renovar la sesión). Sin
 * dependencias de navegador: el middleware corre en el edge.
 */

/** Roles del token que entran al panel: AMT ('admin') y clubes ('club'). */
const PANEL_ROLES = ["admin", "club"] as const;

/** Motivo de /login?motivo=…: la cuenta no tiene (o ya no tiene) acceso al panel. */
export const LOGIN_REASON_NO_ACCESS = "sin-acceso";

/** Lo que dice el formulario de login con ese motivo. */
export const NO_ACCESS_MESSAGE =
  "Esta cuenta no tiene acceso al panel. Entra con una cuenta de administrador.";

export function isPanelRole(role: unknown): boolean {
  return typeof role === "string" && (PANEL_ROLES as readonly string[]).includes(role);
}

/** El rol del token (sin verificar la firma: eso lo hace el back); null si no se lee. */
export function tokenRole(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const role = (JSON.parse(atob(padded)) as { role?: unknown }).role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}
