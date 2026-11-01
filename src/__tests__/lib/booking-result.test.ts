/**
 * Resultado de una reserva en el panel (R2-7): cuándo lo puede tocar el
 * club, cómo se enseña y qué se manda.
 */
import { describe, it, expect } from "vitest";
import {
  clubCanEditResult,
  formatScore,
  parseScoreDraft,
  scoreDraftFrom,
  teamNames,
  EMPTY_SCORE,
} from "@/lib/utils/booking-result";
import type { BookingResult } from "@/types/bookings";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const RESULT: BookingResult = {
  set1Home: 6, set1Away: 4, set2Home: 3, set2Away: 6, set3Home: 10, set3Away: 8,
  winnerTeam: 1, enteredByUserId: "u1", enteredAt: "", finalizedAt: null, processedLspaAt: null,
};

describe("clubCanEditResult", () => {
  const deadline = "2026-11-20T12:00:00.000Z";
  it("con el partido empezado o jugado y antes del plazo de 30 días", () => {
    for (const status of ["IN_PROGRESS", "COMPLETED", "WITHOUT_RESULT"] as const) {
      expect(clubCanEditResult({ status, resultAdminDeadlineAt: deadline }, NOW)).toBe(true);
    }
  });
  it("no antes de empezar, ni cancelada, ni pasado el plazo, ni con un back sin plazo", () => {
    expect(clubCanEditResult({ status: "CONFIRMED", resultAdminDeadlineAt: deadline }, NOW)).toBe(false);
    expect(clubCanEditResult({ status: "CANCELLED", resultAdminDeadlineAt: null }, NOW)).toBe(false);
    expect(clubCanEditResult({ status: "COMPLETED", resultAdminDeadlineAt: "2026-10-28T11:59:00.000Z" }, NOW)).toBe(false);
    expect(clubCanEditResult({ status: "COMPLETED" }, NOW)).toBe(false);
  });
});

describe("formatScore y teamNames", () => {
  it("el marcador con el equipo 1 delante, sin tercer set si no lo hubo", () => {
    expect(formatScore(RESULT)).toBe("6-4 · 3-6 · 10-8");
    expect(formatScore({ ...RESULT, set2Home: 6, set2Away: 2, set3Home: null, set3Away: null })).toBe("6-4 · 6-2");
  });
  it("los jugadores de cada equipo", () => {
    const participants = [
      { team: 1, user: { name: "Ana" } },
      { team: 2, user: { name: "Luis" } },
      { team: 1, user: { name: "Bea" } },
      { team: null, guestName: "Juan" },
    ] as never;
    expect(teamNames({ participants }, 1)).toEqual(["Ana", "Bea"]);
    expect(teamNames({ participants }, 2)).toEqual(["Luis"]);
    expect(teamNames({}, 1)).toEqual([]);
  });
});

describe("parseScoreDraft", () => {
  it("dos sets o tres, en números", () => {
    expect(parseScoreDraft({ ...EMPTY_SCORE, set1Home: "6", set1Away: "4", set2Home: "6", set2Away: "3" }))
      .toEqual({ payload: { set1Home: 6, set1Away: 4, set2Home: 6, set2Away: 3 } });
    expect(parseScoreDraft(scoreDraftFrom(RESULT))).toEqual({
      payload: { set1Home: 6, set1Away: 4, set2Home: 3, set2Away: 6, set3Home: 10, set3Away: 8 },
    });
  });
  it("falta un set, un tercer set a medias o algo que no es un número", () => {
    expect(parseScoreDraft({ ...EMPTY_SCORE, set1Home: "6", set1Away: "4" })).toHaveProperty("error");
    expect(parseScoreDraft({ ...scoreDraftFrom(RESULT), set3Away: "" })).toHaveProperty("error");
    expect(parseScoreDraft({ ...scoreDraftFrom(RESULT), set1Home: "6.5" })).toHaveProperty("error");
  });
});
