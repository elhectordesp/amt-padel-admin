import { describe, it, expect } from "vitest";
import {
  CLUB_AREAS, CLUB_STAFF_ROLES, areaForPath, canAccess,
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

  it("recepción: escribe reservas, clientes y caja; lee torneos y ajustes", () => {
    const r: ClubStaffRole[] = ["RECEPTION"];
    expect(rw(r, "bookings")).toEqual([true, true]);
    expect(rw(r, "customers")).toEqual([true, true]);
    expect(rw(r, "cash")).toEqual([true, true]);
    expect(rw(r, "tournaments")).toEqual([true, false]);
    expect(rw(r, "settings")).toEqual([true, false]);
    expect(rw(r, "results")).toEqual([false, false]);
  });

  it("entrenador: solo lee reservas", () => {
    const r: ClubStaffRole[] = ["COACH"];
    expect(rw(r, "bookings")).toEqual([true, false]);
    for (const area of CLUB_AREAS.filter((a) => a !== "bookings")) {
      expect(rw(r, area)).toEqual([false, false]);
    }
  });

  it("los roles se combinan: gana el nivel más alto de cada área", () => {
    const r: ClubStaffRole[] = ["COACH", "RECEPTION"];
    expect(rw(r, "bookings")).toEqual([true, true]);
    expect(rw(r, "cash")).toEqual([true, true]);
  });

  it("sin roles no hay acceso", () => {
    for (const area of CLUB_AREAS) expect(rw([], area)).toEqual([false, false]);
  });

  it("todos los roles tienen etiqueta", () => {
    expect(CLUB_STAFF_ROLES).toHaveLength(6);
  });
});

describe("areaForPath", () => {
  it.each([
    ["/mi-club/equipo", "staff"],
    ["/mi-club/clientes", "customers"],
    ["/mi-club/clientes/abc", "customers"],
    ["/torneos", "tournaments"],
    ["/torneos/t1/editar", "tournaments"],
    ["/mi-club/torneos", "tournaments"],
    ["/resultados", "results"],
    ["/caja", "cash"],
    ["/mi-club/reservas/calendario", "bookings"],
    ["/mi-club/reservas/bookings/b1", "bookings"],
    ["/mi-club/reservas/precios", "settings"],
    ["/mi-club", "settings"],
    ["/patrocinadores", "settings"],
    ["/dashboard", null],
    ["/perfil", null],
  ] as const)("%s → %s", (path, area) => {
    expect(areaForPath(path)).toBe(area);
  });
});
