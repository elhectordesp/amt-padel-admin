const PANEL_ORIGIN = "http://panel.invalid";

/**
 * A dónde volver tras iniciar sesión: solo a una ruta de este panel. Antes
 * `?from=https://web-ajena` llevaba a esa web después de entrar (redirección
 * abierta, útil para phishing). Se resuelve como lo haría el navegador
 * (`//web`, `/\web`, tabuladores o `javascript:` acaban en otro origen) y, si
 * no se queda en el panel, va a `fallback`.
 */
export function safeRedirectPath(
  from: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!from || !from.startsWith("/")) return fallback;
  try {
    const url = new URL(from, PANEL_ORIGIN);
    if (url.origin !== PANEL_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
