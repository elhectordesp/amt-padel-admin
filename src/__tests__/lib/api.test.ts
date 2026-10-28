import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

vi.mock("js-cookie", () => ({
  default: { get: vi.fn(() => "refresh-token"), set: vi.fn(), remove: vi.fn() },
}));

import { api } from "../../../lib/api";

/** Un JWT con ese rol (sin firma: el panel no la comprueba). */
function tokenWithRole(role: string): string {
  const body = Buffer.from(JSON.stringify({ role })).toString("base64").replace(/=+$/g, "");
  return `h.${body}.s`;
}

/** Respuesta de error del back para cualquier petición. */
function backAnswers(status: number, data: unknown) {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const response = { status, data, headers: {}, config, statusText: "" } as AxiosResponse;
    throw new AxiosError("error", String(status), config, null, response);
  };
}

describe("api: club desactivado a mitad de sesión", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation });
  });

  it("con 401 CLUB_DEACTIVATED manda a /login con el motivo, sin intentar renovar la sesión", async () => {
    backAnswers(401, { success: false, code: "CLUB_DEACTIVATED", error: "Tu club está desactivado." });

    await expect(api.get("/admin/tournaments")).rejects.toBeDefined();

    expect(window.location.href).toBe("/login?motivo=club-desactivado");
  });

  // P2-17: el back de antes mandaba "ThrottlerException: Too Many Requests"
  it.each([
    [{ success: false, error: "ThrottlerException: Too Many Requests" }],
    [{ success: false, code: "TOO_MANY_REQUESTS", error: "Demasiados intentos." }],
  ])("un 429 (%j) llega con un texto claro y el código TOO_MANY_REQUESTS", async (data) => {
    backAnswers(429, data);

    await expect(api.get("/admin/tournaments")).rejects.toMatchObject({
      message: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
      status: 429,
      code: "TOO_MANY_REQUESTS",
    });
    expect(window.location.href).toBe("");
  });

  it("otro error no saca de la sesión: llega como ApiError con su código", async () => {
    backAnswers(409, { success: false, code: "CLUB_NOT_CONFIGURED", error: "Este club aún está por configurar" });

    await expect(api.delete("/admin/clubs/c1")).rejects.toMatchObject({
      message: "Este club aún está por configurar",
      status: 409,
      code: "CLUB_NOT_CONFIGURED",
    });
    expect(window.location.href).toBe("");
  });
});

describe("api: un admin al que le quitan el rol renueva como jugador (P2-16)", () => {
  const originalLocation = window.location;
  const originalAdapter = axios.defaults.adapter;

  beforeEach(() => {
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true });
    vi.mocked(Cookies.set).mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation });
    axios.defaults.adapter = originalAdapter;
  });

  it("si la sesión renovada no es de admin ni de club: fuera, a /login?motivo=sin-acceso", async () => {
    backAnswers(401, { success: false, error: "Sesión caducada" });
    // /auth/refresh va por axios (no por api): devuelve un token de jugador
    axios.defaults.adapter = async (config: InternalAxiosRequestConfig) => ({
      status: 200, statusText: "OK", headers: {}, config,
      data: { success: true, data: { token: tokenWithRole("user"), refreshToken: "r2" } },
    } as AxiosResponse);

    await expect(api.get("/admin/stats/finance")).rejects.toMatchObject({ status: 403 });

    expect(window.location.href).toBe("/login?motivo=sin-acceso");
    // No se guarda el token de jugador
    expect(Cookies.set).not.toHaveBeenCalled();
  });
});
