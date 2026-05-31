import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_KEY    = "amt_admin_token";
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic     = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const token        = request.cookies.get(TOKEN_KEY)?.value;

  if (!token && !isPublic) {
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
