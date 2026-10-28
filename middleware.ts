import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOGIN_REASON_NO_ACCESS, isPanelRole } from "./lib/session";

const TOKEN_KEY = "amt_admin_token";
const REFRESH_TOKEN_KEY = "amt_admin_refresh";
// Rutas públicas (sin login): login/gestión de cuenta (también /restablecer, la
// del enlace del email de la contraseña) + visor de torneo (modo espectador y
// Widget TV), que usan solo endpoints públicos sin datos sensibles. También el
// ranking público y el perfil público de un jugador: se hicieron para
// compartirse fuera del panel (tienen su imagen OG) y solo leen endpoints
// públicos, pero sin sesión mandaban al login. «/ranking» no abre «/rankings»
// (la página del admin): ver isUnder.
const PUBLIC_PATHS = [
  "/login",
  "/eliminar-cuenta",
  "/privacidad",
  "/ayuda",
  "/aceptar-invitacion",
  "/restablecer",
  "/torneo",
  "/ranking",
  "/player",
];

// Páginas del admin a las que un user CLUB NO debe entrar — operaciones
// globales del circuito (estadísticas globales, finanzas, config, etc).
// Sidebar ya las oculta para CLUB; esto cierra la puerta también a la URL
// directa, redirigiendo a /dashboard en lugar de mostrar una página llena
// de botones que dan 403.
//
// Prefijos: cualquier path bajo estos prefijos queda bloqueado.
const CLUB_BLOCKED_PREFIXES = [
  "/jugadores",
  "/clubes",
  "/estadisticas",
  "/finanzas",
  "/configuracion",
  "/soporte",
  "/rankings",
];

interface JwtPayload {
  exp?: number;
  role?: string;
}

function decodePayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

function isExpValid(payload: JwtPayload | null): boolean {
  return (
    !!payload &&
    typeof payload.exp === "number" &&
    payload.exp > Math.floor(Date.now() / 1000)
  );
}

/**
 * Si `pathname` es la ruta `base` o cuelga de ella. Con startsWith pelado,
 * "/torneo" (el visor público) dejaba pasar sin sesión "/torneos" y
 * "/torneos/:id" (páginas del admin).
 */
function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => isUnder(pathname, p));
  const token = request.cookies.get(TOKEN_KEY)?.value;
  const payload = token ? decodePayload(token) : null;

  // Auth gate (igual que antes): cualquier path no-público sin token válido
  // se redirige a /login.
  if (!isPublic && !isExpValid(payload)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Token vigente de quien no entra al panel: un jugador, o un admin al que
  // le quitaron el rol y renovó la sesión. Antes solo se miraba la caducidad
  // y se pintaba el panel entero con todo a 0 (P2-16). Fuera, sin sus cookies.
  if (!isPublic && !isPanelRole(payload?.role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("motivo", LOGIN_REASON_NO_ACCESS);
    const res = NextResponse.redirect(url);
    res.cookies.delete(TOKEN_KEY);
    res.cookies.delete(REFRESH_TOKEN_KEY);
    return res;
  }

  // Role gate: si el user es CLUB y la ruta cae en un prefijo bloqueado,
  // lo mandamos a su dashboard. Backend ya devuelve 403 en esos endpoints
  // — esto evita el ruido visual de páginas con botones rotos.
  if (
    !isPublic &&
    payload?.role === "club" &&
    CLUB_BLOCKED_PREFIXES.some((p) => isUnder(pathname, p))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|monitoring|.*\\.pdf$|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
