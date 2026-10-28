/**
 * El enlace de los emails de restablecer la contraseña y de activar la
 * cuenta, que llega a /restablecer. El back pone el token detrás de "#"
 * (#token=…&mode=activate): el navegador no lo manda al servidor y no queda
 * en sus registros. Los enlaces con "?token=…" también valen.
 */
export interface AccountLink {
  token: string;
  /** Activar una cuenta creada por un admin o un club (no restablecer). */
  activate: boolean;
}

export function readAccountLink(hash: string, search: string): AccountLink | null {
  for (const raw of [hash.replace(/^#/, ""), search.replace(/^\?/, "")]) {
    const params = new URLSearchParams(raw);
    const token = params.get("token")?.trim();
    if (token) return { token, activate: params.get("mode") === "activate" };
  }
  return null;
}

/** El mismo enlace en la app (amtpadel://reset-password), que lo lee de la query. */
export function appResetUrl({ token, activate }: AccountLink): string {
  const params = new URLSearchParams({ token });
  if (activate) params.set("mode", "activate");
  return `amtpadel://reset-password?${params.toString()}`;
}

/** Móvil o tableta, donde puede estar la app (iPadOS se presenta como Mac). */
export function isMobileDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
