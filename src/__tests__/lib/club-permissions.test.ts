import { describe, it, expect } from "vitest";
import {
  CLUB_AREAS, CLUB_STAFF_ROLES, REGISTRATION_PAYMENT_AREAS, areaForPath, canAccess,
  type ClubArea, type ClubStaffRole,
} from "@/lib/club-permissions";

const rw = (roles: ClubStaffRole[], area: ClubArea) =>
  [canAccess(roles, area, "read"), canAccess(roles, area, "write")];

describe("canAccess", () => {
  it("el propietario puede leer y escribir en todo", () => {
    for (const area of CLUB_AREAS) expect(rw(["OWNER"], area)).toEqual([true, true]);
  });

  it("el gestor lo puede todo salvo escribir el equipo", () => {
    for (const area of CLUB_AREAS.filter((a) => a !== "staff")) {
      expect(rw(["MANAGER"], area)).toEqual([true, true]);
    }
    expect(rw(["MANAGER"], "staff")).toEqual([true, false]);
  });

  it("torneos: escribe torneos y resultados, lee reservas y clientes, nada más", () => {
    const r: ClubStaffRole[] = ["TOURNAMENTS"];
    expect(rw(r, "tournaments")).toEqual([true, true]);
    expect(rw(r, "results")).toEqual([true, true]);
    expect(rw(r, "bookings")).toEqual([true, false]);
    expect(rw(r, "customers")).toEqual([true, false]);
    expect(rw(r, "club")).toEqual([true, false]);
    expect(rw(r, "cash")).toEqual([false, false]);
    expect(rw(r, "settings")).toEqual([false, false]);
    expect(rw(r, "staff")).toEqual([false, false]);
  });

  it("resultados: lee torneos y escribe resultados", () => {
    const r: ClubStaffRole[] = ["RESULTS"];
    expect(rw(r, "tournaments")).toEqual([true, false]);
    expect(rw(r, "results")).toEqual([true, true]);
    expect(rw(r, "bookings")).toEqual([false, false]);
  });

  it("recepción: escribe reservas, clientes, caja y escuela; lee torneos y ajustes", () => {
    const r: ClubStaffRole[] = ["RECEPTION"];
    expect(rw(r, "bookings")).toEqual([true, true]);
    expect(rw(r, "customers")).toEqual([true, true]);
    expect(rw(r, "cash")).toEqual([true, true]);
    expect(rw(r, "school")).toEqual([true, true]);
    expect(rw(r, "tournaments")).toEqual([true, false]);
    expect(rw(r, "settings")).toEqual([true, false]);
    expect(rw(r, "results")).toEqual([false, false]);
  });

  it("entrenador: lee reservas y escuela, nada más", () => {
    const r: ClubStaffRole[] = ["COACH"];
    expect(rw(r, "bookings")).toEqual([true, false]);
    expect(rw(r, "school")).toEqual([true, false]);
    for (const area of CLUB_AREAS.filter((a) => a !== "bookings" && a !== "school" && a !== "club")) {
      expect(rw(r, area)).toEqual([false, false]);
    }
  });

  it("escuela: torneos y resultados no la ven; propietario y gestor la escriben", () => {
    for (const role of ["TOURNAMENTS", "RESULTS"] as const) {
      expect(rw([role], "school")).toEqual([false, false]);
    }
    expect(rw(["OWNER"], "school")).toEqual([true, true]);
    expect(rw(["MANAGER"], "school")).toEqual([true, true]);
  });

  it("los roles se combinan: gana el nivel más alto de cada área", () => {
    const r: ClubStaffRole[] = ["COACH", "RECEPTION"];
    expect(rw(r, "bookings")).toEqual([true, true]);
    expect(rw(r, "cash")).toEqual([true, true]);
  });

  it("club: lo lee todo el equipo y solo lo escriben propietario y gestor", () => {
    for (const role of ["TOURNAMENTS", "RESULTS", "RECEPTION", "COACH"] as const) {
      expect(rw([role], "club")).toEqual([true, false]);
    }
    expect(rw(["OWNER"], "club")).toEqual([true, true]);
    expect(rw(["MANAGER"], "club")).toEqual([true, true]);
  });

  it("sin roles no hay acceso", () => {
    for (const area of CLUB_AREAS) expect(rw([], area)).toEqual([false, false]);
  });

  it("cobrar una inscripción: propietario, gestor, recepción y torneos; resultados y entrenador, no", () => {
    const canCollect = (role: ClubStaffRole) =>
      REGISTRATION_PAYMENT_AREAS.some((area) => canAccess([role], area, "write"));
    for (const role of ["OWNER", "MANAGER", "RECEPTION", "TOURNAMENTS"] as const) {
      expect(canCollect(role)).toBe(true);
    }
    for (const role of ["RESULTS", "COACH"] as const) {
      expect(canCollect(role)).toBe(false);
    }
  });

  it("todos los roles tienen etiqueta", () => {
    expect(CLUB_STAFF_ROLES).toHaveLength(6);
  });
});

describe("areaForPath", () => {
  it.each([
    ["/mi-club/equipo", "staff"],
    ["/historial", "staff"],
    ["/mi-club/clientes", "customers"],
    ["/mi-club/clientes/abc", "customers"],
    ["/mi-club/mensajes", "customers"],
    ["/torneos", "tournaments"],
    ["/torneos/t1/editar", "tournaments"],
    ["/ligas", "tournaments"],
    ["/ligas/nuevo", "tournaments"],
    ["/ligas/l1/editar", "tournaments"],
    ["/mi-club/torneos", "tournaments"],
    ["/resultados", "results"],
    ["/caja", "cash"],
    ["/mi-club/reservas/calendario", "bookings"],
    ["/mi-club/reservas/bookings/b1", "bookings"],
    ["/mi-club/reservas/precios", "settings"],
    ["/mi-club/escuela", "school"],
    ["/mi-club/escuela/grupos/g1", "school"],
    ["/mi-club/escuela/clases/s1", "school"],
    ["/mi-club", "settings"],
    // El back pide «tournaments» para leer y escribir patrocinadores
    ["/patrocinadores", "tournaments"],
    ["/patrocinadores/abc", "tournaments"],
    ["/inscripciones", "tournaments"],
    ["/dashboard", null],
    ["/perfil", null],
  ] as const)("%s → %s", (path, area) => {
    expect(areaForPath(path)).toBe(area);
  });
});
