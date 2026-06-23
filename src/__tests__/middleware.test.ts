/**
 * Tests del middleware de Next.js. Cubre:
 *  - Auth gate: rutas no-públicas sin token válido → redirect a /login.
 *  - Role gate: CLUB user que pide path bloqueado → redirect a /dashboard.
 *  - Passthrough: ADMIN, rutas públicas, paths permitidos para CLUB.
 *
 * Mockeamos next/server para evitar el runtime real de Next.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((url: URL) => ({ type: "redirect", url }));
const nextMock = vi.fn(() => ({ type: "next" }));

vi.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: URL) => redirectMock(url),
    next: () => nextMock(),
  },
}));

import { middleware } from "../../middleware";

// JWT payload helper: codifica payload base64url y produce token "header.payload.sig"
function makeToken(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `header.${body}.sig`;
}

function makeRequest(pathname: string, token?: string) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    nextUrl: {
      pathname,
      clone: () => new URL(url.toString()),
    },
    cookies: {
      get: (k: string) =>
        token && k === "amt_admin_token" ? { value: token } : undefined,
    },
  } as any;
}

const futureExp = Math.floor(Date.now() / 1000) + 3600;

describe("middleware — auth gate", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    nextMock.mockClear();
  });

  it("rutas públicas pasan sin token", () => {
    middleware(makeRequest("/login"));
    expect(nextMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("ruta protegida sin token → redirige a /login", () => {
    middleware(makeRequest("/dashboard"));
    expect(redirectMock).toHaveBeenCalled();
    const url = redirectMock.mock.calls[0][0];
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("from")).toBe("/dashboard");
  });

  it("ruta protegida con token expirado → redirige a /login", () => {
    const token = makeToken({ exp: 1, role: "admin" });
    middleware(makeRequest("/dashboard", token));
    expect(redirectMock).toHaveBeenCalled();
    expect(redirectMock.mock.calls[0][0].pathname).toBe("/login");
  });

  it("ruta protegida con token válido ADMIN → pasa", () => {
    const token = makeToken({ exp: futureExp, role: "admin" });
    middleware(makeRequest("/dashboard", token));
    expect(nextMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("middleware — role gate (CLUB)", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    nextMock.mockClear();
  });

  const clubToken = makeToken({
    exp: futureExp,
    role: "club",
    clubId: "club-1",
  });

  it("CLUB en /dashboard → pasa", () => {
    middleware(makeRequest("/dashboard", clubToken));
    expect(nextMock).toHaveBeenCalled();
  });

  it("CLUB en /torneos → pasa", () => {
    middleware(makeRequest("/torneos", clubToken));
    expect(nextMock).toHaveBeenCalled();
  });

  it("CLUB en /torneos/abc/editar → pasa (sub-path permitido)", () => {
    middleware(makeRequest("/torneos/abc/editar", clubToken));
    expect(nextMock).toHaveBeenCalled();
  });

  it("CLUB en /mi-club → pasa", () => {
    middleware(makeRequest("/mi-club", clubToken));
    expect(nextMock).toHaveBeenCalled();
  });

  it("CLUB en /jugadores → redirige a /dashboard", () => {
    middleware(makeRequest("/jugadores", clubToken));
    expect(redirectMock).toHaveBeenCalled();
    expect(redirectMock.mock.calls[0][0].pathname).toBe("/dashboard");
  });

  it("CLUB en /jugadores/xyz (sub-path) → redirige a /dashboard", () => {
    middleware(makeRequest("/jugadores/xyz", clubToken));
    expect(redirectMock).toHaveBeenCalled();
    expect(redirectMock.mock.calls[0][0].pathname).toBe("/dashboard");
  });

  it("CLUB en /clubes → redirige a /dashboard", () => {
    middleware(makeRequest("/clubes", clubToken));
    expect(redirectMock).toHaveBeenCalled();
  });

  it("CLUB en /finanzas → redirige a /dashboard", () => {
    middleware(makeRequest("/finanzas", clubToken));
    expect(redirectMock).toHaveBeenCalled();
  });

  it("CLUB en /estadisticas → redirige a /dashboard", () => {
    middleware(makeRequest("/estadisticas", clubToken));
    expect(redirectMock).toHaveBeenCalled();
  });

  it("CLUB en /configuracion → redirige a /dashboard", () => {
    middleware(makeRequest("/configuracion", clubToken));
    expect(redirectMock).toHaveBeenCalled();
  });

  it("CLUB en /soporte → redirige a /dashboard", () => {
    middleware(makeRequest("/soporte", clubToken));
    expect(redirectMock).toHaveBeenCalled();
  });
});

describe("middleware — ADMIN passthrough (no role gating)", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    nextMock.mockClear();
  });

  const adminToken = makeToken({ exp: futureExp, role: "admin" });

  it("ADMIN en /jugadores → pasa (no es club)", () => {
    middleware(makeRequest("/jugadores", adminToken));
    expect(nextMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("ADMIN en /finanzas → pasa", () => {
    middleware(makeRequest("/finanzas", adminToken));
    expect(nextMock).toHaveBeenCalled();
  });
});
