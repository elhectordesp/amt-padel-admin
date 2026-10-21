import { describe, it, expect } from "vitest";
import {
  activeAndUpcomingTournaments,
  isActiveTournamentStatus,
} from "../../../lib/utils/dashboard-tournaments";

const t = (id: string, status: string, startDate: string) => ({ id, status, startDate });
/** «Hoy» en estos tests: 21 de octubre de 2026, por la mañana (hora local). */
const NOW = new Date(2026, 9, 21, 10, 0);
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe("activeAndUpcomingTournaments", () => {
  it("el torneo en curso sale aunque haya muchos borradores (el caso de la QA)", () => {
    const list = [
      t("b1", "DRAFT", "2026-11-01"),
      t("b2", "DRAFT", "2026-11-02"),
      t("b3", "DRAFT", "2026-11-03"),
      t("b4", "DRAFT", "2026-11-04"),
      t("b5", "DRAFT", "2026-11-05"),
      t("abierto", "OPEN", "2026-12-01"),
      t("en-curso", "ONGOING", "2026-10-20"),
    ];

    expect(ids(activeAndUpcomingTournaments(list, 5, NOW))).toEqual(["en-curso", "abierto"]);
  });

  it("primero los en curso y luego los próximos, cada grupo del más cercano al más lejano", () => {
    const list = [
      t("abierto-dic", "OPEN", "2026-12-10"),
      t("programado-nov", "SCHEDULED", "2026-11-05"),
      t("en-curso-2", "ONGOING", "2026-10-21"),
      t("sorteo-nov", "DRAW", "2026-11-20"),
      t("en-curso-1", "ONGOING", "2026-10-18"),
    ];

    expect(ids(activeAndUpcomingTournaments(list, 5, NOW))).toEqual([
      "en-curso-1",
      "en-curso-2",
      "programado-nov",
      "sorteo-nov",
      "abierto-dic",
    ]);
  });

  it("los «próximos» que ya empezaron y siguen sin pasar a en curso no tapan a los de verdad (el de hoy sí sale)", () => {
    const list = [
      t("abierto-pasado", "OPEN", "2026-10-01T00:00:00.000Z"),
      t("programado-ayer", "SCHEDULED", "2026-10-20T00:00:00.000Z"),
      t("programado-hoy", "SCHEDULED", "2026-10-21T00:00:00.000Z"),
      t("abierto-nov", "OPEN", "2026-11-01T00:00:00.000Z"),
      t("en-curso-antiguo", "ONGOING", "2026-09-01T00:00:00.000Z"),
    ];

    expect(ids(activeAndUpcomingTournaments(list, 5, NOW))).toEqual([
      "en-curso-antiguo",
      "programado-hoy",
      "abierto-nov",
    ]);
  });

  it("sin borradores, finalizados ni cancelados", () => {
    const list = [
      t("borrador", "DRAFT", "2026-11-01"),
      t("finalizado", "FINISHED", "2026-09-01"),
      t("cancelado", "CANCELLED", "2026-11-01"),
      t("abierto", "OPEN", "2026-11-01"),
    ];

    expect(ids(activeAndUpcomingTournaments(list, 5, NOW))).toEqual(["abierto"]);
  });

  it("se queda con los 5 primeros (o los que se pidan) y acepta el estado en minúsculas", () => {
    const list = Array.from({ length: 7 }, (_, i) => t(`t${i}`, "open", `2026-11-0${i + 1}`));

    expect(ids(activeAndUpcomingTournaments(list, 5, NOW))).toEqual(["t0", "t1", "t2", "t3", "t4"]);
    expect(activeAndUpcomingTournaments(list, 2, NOW)).toHaveLength(2);
  });

  it("no cambia la lista que recibe", () => {
    const list = [t("b", "OPEN", "2026-12-01"), t("a", "ONGOING", "2026-10-01")];

    activeAndUpcomingTournaments(list, 5, NOW);

    expect(ids(list)).toEqual(["b", "a"]);
  });
});

describe("isActiveTournamentStatus", () => {
  it("en curso, abierto, sorteo y programado, en mayúsculas o minúsculas", () => {
    for (const s of ["ONGOING", "OPEN", "DRAW", "SCHEDULED", "ongoing"])
      expect(isActiveTournamentStatus(s)).toBe(true);
    for (const s of ["DRAFT", "FINISHED", "CANCELLED", "", null, undefined])
      expect(isActiveTournamentStatus(s)).toBe(false);
  });
});
