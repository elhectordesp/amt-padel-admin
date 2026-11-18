import { describe, it, expect } from "vitest";
import { leagueFinalBlocker, leagueFinalState, maxQualifiersPerGroup } from "@/lib/utils/league-final";

type M = Parameters<typeof leagueFinalState>[0][number];

const m = (over: Partial<M> = {}): M => ({
  categoryId: "c1",
  phase: "GROUPS",
  status: "SCHEDULED",
  isResult: false,
  isWalkover: false,
  team1: ["Ana"],
  team2: ["Beto"],
  ...over,
});
const done = (over: Partial<M> = {}) => m({ status: "FINISHED", isResult: true, ...over });

describe("leagueFinalState", () => {
  it("cuenta los partidos de grupos sin resultado de la categoría (programados y en juego)", () => {
    const state = leagueFinalState(
      [m(), m({ status: "ONGOING" }), done(), m({ categoryId: "c2" })],
      "c1",
    );
    expect(state).toMatchObject({ pendingGroups: 2, hasGroups: true, hasFinal: false, playedFinal: 0 });
  });

  it("un partido cancelado no cuenta como pendiente", () => {
    expect(leagueFinalState([done(), m({ status: "CANCELLED" })], "c1").pendingGroups).toBe(0);
  });

  it("el cuadro final: lo que no es de grupos; un bye terminado no cuenta como jugado", () => {
    const bye = done({ phase: "QF", isWalkover: true, team2: [] });
    const state = leagueFinalState(
      [done(), bye, m({ phase: "QF" }), done({ phase: "SF" })],
      "c1",
    );
    expect(state).toMatchObject({ hasFinal: true, playedFinal: 1, pendingGroups: 0 });
  });

  it("sin partidos de grupos no hay grupos sorteados", () => {
    expect(leagueFinalState([m({ categoryId: "c2" })], "c1").hasGroups).toBe(false);
  });
});

describe("leagueFinalBlocker", () => {
  const base = { pendingGroups: 0, hasGroups: true, hasFinal: false, playedFinal: 0 };

  it("sin nada que lo impida, null", () => {
    expect(leagueFinalBlocker(base)).toBeNull();
    // Rehacerlo mientras nadie lo haya jugado
    expect(leagueFinalBlocker({ ...base, hasFinal: true })).toBeNull();
  });

  it("dice cuántos partidos de grupos quedan, en singular y plural", () => {
    expect(leagueFinalBlocker({ ...base, pendingGroups: 1 })).toBe("Queda 1 partido de grupos sin resultado.");
    expect(leagueFinalBlocker({ ...base, pendingGroups: 4 })).toBe("Quedan 4 partidos de grupos sin resultado.");
  });

  it("sin grupos, o con el cuadro final ya jugado, tampoco", () => {
    expect(leagueFinalBlocker({ ...base, hasGroups: false })).toMatch(/Sortea primero/);
    expect(leagueFinalBlocker({ ...base, hasFinal: true, playedFinal: 2 })).toMatch(/partidos jugados/);
  });
});

describe("maxQualifiersPerGroup", () => {
  it("de 1 a 4 y como mucho las parejas del grupo más pequeño", () => {
    expect(maxQualifiersPerGroup([5, 4, 6])).toBe(4);
    expect(maxQualifiersPerGroup([5, 3])).toBe(3);
    expect(maxQualifiersPerGroup([2])).toBe(2);
    expect(maxQualifiersPerGroup([])).toBe(1);
  });
});
