import { describe, it, expect } from "vitest";
import { computeActiveHref } from "../../../components/admin/sidebar";

const NAV = [
  "/dashboard",
  "/torneos",
  "/inscripciones",
  "/resultados",
  "/patrocinadores",
  "/mi-club",
  "/mi-club/reservas",
];

describe("computeActiveHref", () => {
  it("devuelve null cuando ningún href matchea", () => {
    expect(computeActiveHref(NAV, "/ruta-inexistente")).toBeNull();
  });

  it("matchea por igualdad exacta", () => {
    expect(computeActiveHref(NAV, "/dashboard")).toBe("/dashboard");
  });

  it("matchea por prefijo cuando hay subruta", () => {
    expect(computeActiveHref(NAV, "/torneos/abc123")).toBe("/torneos");
  });

  it("elige el match MÁS LARGO entre múltiples coincidencias", () => {
    // /mi-club y /mi-club/reservas ambos matchean — gana el más específico
    expect(computeActiveHref(NAV, "/mi-club/reservas")).toBe("/mi-club/reservas");
    expect(computeActiveHref(NAV, "/mi-club/reservas/horarios")).toBe(
      "/mi-club/reservas",
    );
  });

  it("para ruta del padre puro, marca el padre", () => {
    expect(computeActiveHref(NAV, "/mi-club")).toBe("/mi-club");
  });

  it("no confunde un prefijo similar pero distinto", () => {
    // /mi-clubX no debe matchear /mi-club
    expect(computeActiveHref(NAV, "/mi-clubX")).toBeNull();
    expect(computeActiveHref(NAV, "/torneoso")).toBeNull();
  });

  it("array vacío devuelve null", () => {
    expect(computeActiveHref([], "/dashboard")).toBeNull();
  });
});
