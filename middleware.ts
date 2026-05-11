import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const TOKEN_KEY    = "amt_admin_token";

function decodeJwt(token: string): { role?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token   = request.cookies.get(TOKEN_KEY)?.value;
  const payload = token ? decodeJwt(token) : null;
  const isAdmin = payload?.role === "admin";
  const expired = payload?.exp ? payload.exp * 1000 < Date.now() : true;

  if (!token || !isAdmin || expired) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
