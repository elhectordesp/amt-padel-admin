import { describe, it, expect } from "vitest";
import {
  WEEKDAYS,
  leagueDaysIssue,
  leagueDaysPayload,
  leagueRoundDate,
  sortLeagueDays,
  weekdayLabel,
  type LeagueDayForm,
} from "@/lib/utils/league-days";

const day = (weekday: number, blocks = [{ start: "18:00", end: "21:00" }]): LeagueDayForm => ({
  weekday,
  blocks,
  maxUnavailableSlots: 0,
});

describe("días de juego de una liga", () => {
  it("los días de la semana van de 1 (lunes) a 7 (domingo)", () => {
    expect(WEEKDAYS.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekdayLabel(1)).toBe("Lunes");
    expect(weekdayLabel(7)).toBe("Domingo");
    expect(weekdayLabel(9)).toBe("");
  });

  it("se ordenan de lunes a domingo", () => {
    expect(sortLeagueDays([day(5), day(1), day(3)]).map((d) => d.weekday)).toEqual([1, 3, 5]);
  });

  describe("leagueDaysIssue", () => {
    it("sin ningún día no se puede seguir", () => {
      expect(leagueDaysIssue([])).toBe("Elige al menos un día de juego.");
    });

    it("con días y franjas válidos, nada que corregir", () => {
      expect(leagueDaysIssue([day(1), day(4, [{ start: "09:00", end: "11:00" }, { start: "18:00", end: "20:00" }])])).toBeNull();
    });

    it("un día sin franjas", () => {
      expect(leagueDaysIssue([day(2, [])])).toBe("El martes necesita al menos una franja horaria.");
    });

    it("una franja con la hora de fin antes o igual que la de inicio", () => {
      expect(leagueDaysIssue([day(3, [{ start: "20:00", end: "18:00" }])])).toBe(
        "El miércoles: en cada franja, la hora de inicio debe ser anterior a la de fin.",
      );
      expect(leagueDaysIssue([day(3, [{ start: "18:00", end: "18:00" }])])).toContain("miércoles");
    });

    it("una franja sin hora escrita", () => {
      expect(leagueDaysIssue([day(5, [{ start: "", end: "20:00" }])])).toBe(
        "El viernes: cada franja necesita su hora de inicio y de fin.",
      );
    });

    it("franjas solapadas del mismo día", () => {
      expect(
        leagueDaysIssue([day(6, [{ start: "10:00", end: "14:00" }, { start: "12:00", end: "16:00" }])]),
      ).toBe("El sábado tiene franjas que se solapan.");
    });
  });

  it("el payload al back: un día por día de la semana, ordenado y sin fecha", () => {
    const payload = leagueDaysPayload([day(4), day(1)]);
    expect(payload).toEqual([
      { weekday: 1, maxUnavailableSlots: 0, blocks: [{ start: "18:00", end: "21:00" }] },
      { weekday: 4, maxUnavailableSlots: 0, blocks: [{ start: "18:00", end: "21:00" }] },
    ]);
    expect(payload.every((d) => !("date" in d))).toBe(true);
  });

  describe("leagueRoundDate: inicio + 7 días por jornada", () => {
    it("la jornada 1 es la semana del inicio", () => {
      expect(leagueRoundDate("2026-12-07", 1)).toBe("2026-12-07");
    });

    it("cada jornada, una semana más (pasando de mes y de año)", () => {
      expect(leagueRoundDate("2026-12-07", 2)).toBe("2026-12-14");
      expect(leagueRoundDate("2026-12-07", 4)).toBe("2026-12-28");
      expect(leagueRoundDate("2026-12-07", 5)).toBe("2027-01-04");
    });

    it("sin que el cambio de hora lo mueva (octubre en España)", () => {
      expect(leagueRoundDate("2026-10-19", 2)).toBe("2026-10-26");
    });
  });
});
