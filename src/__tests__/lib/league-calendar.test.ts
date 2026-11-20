import { describe, it, expect } from "vitest";
import { leagueCalendar, leagueMatchTitle } from "@/lib/utils/league-calendar";
import type { MatchResult } from "@/types";

const TZ = "Europe/Madrid";

function match(over: Partial<MatchResult> & { id: string }): MatchResult {
  return {
    tournament: "t1",
    categoryId: "c1",
    phase: "GROUPS",
    date: null,
    court: null,
    team1: ["Ana"],
    team2: ["Beto"],
    isResult: false,
    status: "SCHEDULED",
    group: "Grupo A",
    round: 1,
    ...over,
  };
}

describe("leagueCalendar", () => {
  it("agrupa por día en la zona de la liga, con cada día por hora y a la misma hora por pista", () => {
    const { days } = leagueCalendar(
      [
        match({ id: "tarde", date: "2026-11-20T18:00:00.000Z", court: "Pista 2" }),
        match({ id: "mañana-b", date: "2026-11-20T09:00:00.000Z", court: "Pista 2" }),
        match({ id: "mañana-a", date: "2026-11-20T09:00:00.000Z", court: "Pista 1" }),
        match({ id: "otro-dia", date: "2026-11-19T09:00:00.000Z", court: "Pista 1" }),
      ],
      TZ,
    );
    expect(days.map((d) => d.dayKey)).toEqual(["2026-11-19", "2026-11-20"]);
    expect(days[1].matches.map((m) => m.id)).toEqual(["mañana-a", "mañana-b", "tarde"]);
  });

  it("el día es el de la zona de la liga, no el UTC: las 23:30 UTC ya son el día siguiente en Madrid", () => {
    const { days } = leagueCalendar([match({ id: "noche", date: "2026-11-20T23:30:00.000Z", court: "Pista 1" })], TZ);
    expect(days.map((d) => d.dayKey)).toEqual(["2026-11-21"]);
    // En Canarias (UTC+0 en noviembre) sigue siendo el 20
    expect(leagueCalendar([match({ id: "noche", date: "2026-11-20T23:30:00.000Z" })], "Atlantic/Canary").days[0].dayKey).toBe("2026-11-20");
  });

  it("los partidos sin fecha van aparte, por categoría, grupo y jornada", () => {
    const { days, unscheduled } = leagueCalendar(
      [
        match({ id: "a2", round: 2 }),
        match({ id: "b1", group: "Grupo B", round: 1 }),
        match({ id: "a1", round: 1 }),
        match({ id: "fecha", date: "2026-11-20T09:00:00.000Z" }),
        match({ id: "otra-cat", categoryId: "c0", round: 3 }),
      ],
      TZ,
    );
    expect(days).toHaveLength(1);
    expect(unscheduled.map((m) => m.id)).toEqual(["otra-cat", "a1", "a2", "b1"]);
  });

  it("los del cuadro final van tras los de grupos y por fase", () => {
    const { unscheduled } = leagueCalendar(
      [
        match({ id: "final", phase: "FINAL", group: null, round: 1 }),
        match({ id: "sf", phase: "SF", group: null, round: 1 }),
        match({ id: "grupo", round: 5 }),
      ],
      TZ,
    );
    expect(unscheduled.map((m) => m.id)).toEqual(["grupo", "sf", "final"]);
  });

  it("un pase directo (bye) no se programa: no sale ni con fecha ni sin ella", () => {
    const bye = { isWalkover: true, team2: [], phase: "QF", group: null };
    const { days, unscheduled } = leagueCalendar(
      [match({ id: "bye", ...bye }), match({ id: "bye-fecha", ...bye, date: "2026-11-20T09:00:00.000Z" })],
      TZ,
    );
    expect(days).toEqual([]);
    expect(unscheduled).toEqual([]);
  });
});

describe("leagueMatchTitle", () => {
  it("jornada y grupo en los de grupos; la fase en el cuadro final", () => {
    expect(leagueMatchTitle({ phase: "GROUPS", round: 3, group: "Grupo A" })).toBe("Jornada 3 · Grupo A");
    expect(leagueMatchTitle({ phase: "GROUPS", round: null, group: null })).toBe("Jornada 1");
    expect(leagueMatchTitle({ phase: "SF", round: 1, group: null })).toBe("Semifinal");
  });
});
