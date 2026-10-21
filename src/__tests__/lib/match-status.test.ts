import { describe, it, expect } from "vitest";
import { isByeMatch, isMatchFinished } from "../../../lib/utils/match-status";

describe("isByeMatch", () => {
  it("W.O. con una sola pareja: es un bye", () => {
    expect(isByeMatch({ isWalkover: true, team1: ["Ana"], team2: [] })).toBe(true);
    expect(isByeMatch({ isWalkover: true, team1: [], team2: ["Bea"] })).toBe(true);
  });

  it("W.O. con las dos parejas, o un partido por definir: no", () => {
    expect(isByeMatch({ isWalkover: true, team1: ["Ana"], team2: ["Bea"] })).toBe(false);
    expect(isByeMatch({ isWalkover: false, team1: [], team2: [] })).toBe(false);
    expect(isByeMatch({ team1: ["Ana"], team2: [] })).toBe(false);
  });
});

describe("isMatchFinished", () => {
  it("con resultado (isResult): finalizado", () => {
    expect(isMatchFinished({ isResult: true, status: "SCHEDULED" })).toBe(true);
  });

  it("con el estado del back en mayúsculas (FINISHED): finalizado (antes se comparaba con 'finished')", () => {
    expect(isMatchFinished({ isResult: false, status: "FINISHED" })).toBe(true);
    expect(isMatchFinished({ isResult: false, status: "finished" })).toBe(true);
  });

  it("programado o en juego: pendiente", () => {
    expect(isMatchFinished({ isResult: false, status: "SCHEDULED" })).toBe(false);
    expect(isMatchFinished({ isResult: false, status: "ONGOING" })).toBe(false);
  });
});
