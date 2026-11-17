import { describe, it, expect } from "vitest";
import { leagueRounds, type StandingsGroupLike } from "@/lib/utils/league-rounds";

const match = (id: string, group: string | null, round: number | null, userIds: string[], phase = "GROUPS") => ({
  id,
  phase,
  group,
  round,
  players: userIds.map((userId) => ({ userId })),
});

const row = (userId: string, name: string, partnerId: string | null = null) => ({ userId, partnerId, name });

describe("leagueRounds", () => {
  it("agrupa por grupo y por jornada, en orden", () => {
    const result = leagueRounds([
      match("a3", "Grupo A", 3, ["u1", "u4"]),
      match("b1", "Grupo B", 1, ["u5", "u6"]),
      match("a1", "Grupo A", 1, ["u1", "u2"]),
      match("a2", "Grupo A", 2, ["u1", "u3"]),
    ]);
    expect(result.map((g) => g.name)).toEqual(["Grupo A", "Grupo B"]);
    expect(result[0].rounds.map((r) => r.round)).toEqual([1, 2, 3]);
    expect(result[0].rounds.map((r) => r.matches.map((m) => m.id))).toEqual([["a1"], ["a2"], ["a3"]]);
    expect(result[1].rounds).toHaveLength(1);
  });

  it("varios partidos en la misma jornada van juntos", () => {
    const [grupo] = leagueRounds([
      match("m1", "Grupo A", 1, ["u1", "u2"]),
      match("m2", "Grupo A", 1, ["u3", "u4"]),
      match("m3", "Grupo A", 2, ["u1", "u3"]),
    ]);
    expect(grupo.rounds[0].matches.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("solo cuentan los partidos de grupos con grupo; la eliminatoria y los sueltos no", () => {
    const result = leagueRounds([
      match("g", "Grupo A", 1, ["u1", "u2"]),
      match("f", null, 1, ["u1", "u3"], "FINAL"),
      match("sin-grupo", null, 1, ["u1", "u3"]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].rounds[0].matches.map((m) => m.id)).toEqual(["g"]);
  });

  it("un partido sin número de jornada (antiguo) cuenta como la 1", () => {
    const [grupo] = leagueRounds([match("viejo", "Grupo A", null, ["u1", "u2"])]);
    expect(grupo.rounds.map((r) => r.round)).toEqual([1]);
  });

  describe("quién descansa", () => {
    const standings: StandingsGroupLike[] = [
      { id: "g1", label: "Grupo A", rows: [row("u1", "Ana"), row("u2", "Beto"), row("u3", "Carla")] },
    ];

    it("con tres parejas, la que no juega cada jornada", () => {
      const [grupo] = leagueRounds(
        [
          match("m1", "Grupo A", 1, ["u1", "u2"]),
          match("m2", "Grupo A", 2, ["u1", "u3"]),
          match("m3", "Grupo A", 3, ["u2", "u3"]),
        ],
        standings,
      );
      expect(grupo.rounds.map((r) => r.resting)).toEqual([["Carla"], ["Beto"], ["Ana"]]);
    });

    it("una pareja juega si juega cualquiera de sus dos jugadores", () => {
      const parejas: StandingsGroupLike[] = [
        {
          id: "g1",
          label: "Grupo A",
          rows: [row("u1", "Ana / Beto", "u2"), row("u3", "Carla / Dani", "u4"), row("u5", "Eva / Fer", "u6")],
        },
      ];
      const [grupo] = leagueRounds([match("m1", "Grupo A", 1, ["u1", "u2", "u3", "u4"])], parejas);
      expect(grupo.rounds[0].resting).toEqual(["Eva / Fer"]);
    });

    it("con un número par de parejas, nadie descansa", () => {
      const par: StandingsGroupLike[] = [
        { id: "g1", label: "Grupo A", rows: [row("u1", "Ana"), row("u2", "Beto"), row("u3", "Carla"), row("u4", "Dani")] },
      ];
      const [grupo] = leagueRounds(
        [match("m1", "Grupo A", 1, ["u1", "u2"]), match("m2", "Grupo A", 1, ["u3", "u4"])],
        par,
      );
      expect(grupo.rounds[0].resting).toEqual([]);
    });

    it("sin la clasificación cargada, solo salen los partidos", () => {
      const [grupo] = leagueRounds([match("m1", "Grupo A", 1, ["u1", "u2"])]);
      expect(grupo.rounds[0].resting).toEqual([]);
    });
  });
});
