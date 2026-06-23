import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_KEY = "amt_admin_token";
const PUBLIC_PATHS = ["/login", "/eliminar-cuenta", "/aceptar-invitacion"];

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
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

  // Role gate: si el user es CLUB y la ruta cae en un prefijo bloqueado,
  // lo mandamos a su dashboard. Backend ya devuelve 403 en esos endpoints
  // — esto evita el ruido visual de páginas con botones rotos.
  if (
    !isPublic &&
    payload?.role === "club" &&
    CLUB_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))
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
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.pdf$|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
