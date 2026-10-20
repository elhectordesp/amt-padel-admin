import { describe, it, expect } from "vitest";
import { isMatchFinished } from "../../../lib/utils/match-status";

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
