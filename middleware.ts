import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_KEY    = "amt_admin_token";
const PUBLIC_PATHS = ["/login", "/eliminar-cuenta", "/aceptar-invitacion"];

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded  = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic     = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const token        = request.cookies.get(TOKEN_KEY)?.value;

  if (!isPublic && (!token || !isTokenValid(token))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.pdf$|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)"],
};
