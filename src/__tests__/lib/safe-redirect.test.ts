import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "../../../lib/utils/safe-redirect";

describe("safeRedirectPath", () => {
  it("una ruta del panel se respeta, con su query y su ancla", () => {
    expect(safeRedirectPath("/torneos")).toBe("/torneos");
    expect(safeRedirectPath("/torneos/abc/editar?tab=2#pagos")).toBe("/torneos/abc/editar?tab=2#pagos");
  });

  it("sin from, o vacío, al dashboard (o al fallback)", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath("")).toBe("/dashboard");
    expect(safeRedirectPath(null, "/inicio")).toBe("/inicio");
  });

  it.each([
    ["una web con esquema", "https://web-ajena.example"],
    ["sin esquema (//)", "//web-ajena.example/login"],
    ["con barra invertida (/\\)", "/\\web-ajena.example"],
    ["con tabulador en medio (el navegador lo quita)", "/\t/web-ajena.example"],
    ["javascript:", "javascript:alert(1)"],
    ["relativa sin barra", "web-ajena.example"],
    ["con /.. delante", "/..//web-ajena.example"],
    ["con /. delante", "/.//web-ajena.example"],
    ["con /.. codificado", "/%2e%2e//web-ajena.example"],
    ["con /.. tras una ruta del panel", "/torneos/..//web-ajena.example"],
  ])("otra web, %s: al dashboard", (_caso, from) => {
    expect(safeRedirectPath(from)).toBe("/dashboard");
  });

  it("una ruta del panel con segmentos de punto se normaliza y se respeta", () => {
    expect(safeRedirectPath("/torneos/../jugadores")).toBe("/jugadores");
  });
});
