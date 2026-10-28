/**
 * Tramos de las jornadas (P2-9, P2-10 y la rejilla): si un partido cabe, la
 * misma regla que el back, y el tramo nuevo que no pisa los que hay.
 */
import { describe, it, expect } from "vitest";
import {
  dayWindows,
  nextFreeBlock,
  outsideScheduleIssue,
  overlappingBlocks,
  phaseDuration,
  windowsForDay,
} from "@/lib/utils/schedule-windows";
import { categoryNumbersIssue } from "@/lib/utils/category-numbers";

const slots = (from: string, to: string) => {
  const out: string[] = [];
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  for (let t = fh * 60 + fm; t + 30 <= th * 60 + tm; t += 30) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
};

// Viernes con mañana y tarde; domingo de finales hasta las 14:00
const SCHEDULE = [
  { date: "2026-11-20T00:00:00.000Z", slots: [...slots("09:00", "13:00"), ...slots("16:00", "21:00")] },
  { date: "2026-11-22T00:00:00.000Z", slots: slots("10:00", "14:00") },
];

describe("dayWindows / windowsForDay", () => {
  it("junta los slots de 30 min en sus tramos", () => {
    expect(dayWindows(SCHEDULE[0].slots)).toEqual([
      { start: 9 * 60, end: 13 * 60 },
      { start: 16 * 60, end: 21 * 60 },
    ]);
  });

  it("el día sin jornada no tiene tramos; sin jornadas con fecha no hay con qué comparar", () => {
    expect(windowsForDay(SCHEDULE, "2026-11-21")).toEqual([]);
    expect(windowsForDay([{ date: null, slots: ["10:00"] }], "2026-11-20")).toBeNull();
    expect(windowsForDay(undefined, "2026-11-20")).toBeNull();
  });

  it("una jornada antigua guardada a la medianoche de España cuenta para su día", () => {
    expect(windowsForDay([{ date: "2026-11-19T23:00:00.000Z", slots: ["10:00"] }], "2026-11-20")).toEqual([
      { start: 600, end: 630 },
    ]);
  });
});

describe("outsideScheduleIssue", () => {
  it("dentro de un tramo, nada", () => {
    expect(outsideScheduleIssue(SCHEDULE, "2026-11-20", 19 * 60 + 30, 90)).toBeNull();
  });

  it("las 21:30 con 90 min en una jornada que acaba a las 21:00: fuera de los tramos", () => {
    expect(outsideScheduleIssue(SCHEDULE, "2026-11-20", 21 * 60 + 30, 90)).toBe(
      "Está fuera de los tramos de la jornada (09:00-13:00, 16:00-21:00).",
    );
  });

  it("una final que empieza a las 13:30 y dura 90 min acaba después del cierre", () => {
    expect(outsideScheduleIssue(SCHEDULE, "2026-11-22", 13 * 60 + 30, 90)).toBe(
      "Acabaría a las 15:00, después del cierre del tramo (14:00).",
    );
  });

  it("un día sin jornada", () => {
    expect(outsideScheduleIssue(SCHEDULE, "2026-11-21", 10 * 60, 60)).toBe("Ese día no hay jornada del torneo.");
  });

  it("sin jornadas con fecha no se avisa", () => {
    expect(outsideScheduleIssue([], "2026-11-21", 23 * 60, 60)).toBeNull();
  });
});

describe("phaseDuration", () => {
  it("la eliminatoria usa su duración; los grupos, la del torneo", () => {
    const t = { matchDuration: 60, elimMatchDuration: 90 };
    expect(phaseDuration(t, "GROUPS")).toBe(60);
    expect(phaseDuration(t, "FINAL")).toBe(90);
    expect(phaseDuration({ matchDuration: 75 }, "SF")).toBe(75);
    expect(phaseDuration(undefined, "QF")).toBe(60);
  });
});

describe("overlappingBlocks", () => {
  it("marca el tramo que pisa a otro, no el que solo lo toca", () => {
    expect(overlappingBlocks([{ start: "16:00", end: "21:00" }, { start: "16:00", end: "21:00" }])).toEqual([1]);
    expect(overlappingBlocks([{ start: "16:00", end: "21:00" }, { start: "09:00", end: "16:00" }])).toEqual([]);
    expect(overlappingBlocks([{ start: "10:00", end: "14:00" }, { start: "09:00", end: "11:00" }])).toEqual([0]);
  });
});

describe("nextFreeBlock", () => {
  it("con el tramo de tarde por defecto, propone el de mañana (antes repetía 16:00-21:00)", () => {
    expect(nextFreeBlock([{ start: "16:00", end: "21:00" }])).toEqual({ start: "09:00", end: "14:00" });
  });

  it("con la mañana ocupada, la tarde", () => {
    expect(nextFreeBlock([{ start: "09:00", end: "11:00" }])).toEqual({ start: "16:00", end: "21:00" });
  });

  it("con las dos ocupadas, hasta 2 h tras el último, sin pasar de las 23:30", () => {
    expect(nextFreeBlock([{ start: "09:00", end: "14:00" }, { start: "16:00", end: "21:00" }])).toEqual({
      start: "21:00",
      end: "23:00",
    });
    expect(nextFreeBlock([{ start: "08:00", end: "22:30" }])).toEqual({ start: "22:30", end: "23:30" });
  });

  it("sin hueco en el día, ninguno", () => {
    expect(nextFreeBlock([{ start: "08:00", end: "23:30" }])).toBeNull();
  });
});

describe("categoryNumbersIssue (P2-2, D8)", () => {
  it("plazas y precio enteros", () => {
    expect(categoryNumbersIssue({ totalSpots: 16, price: 25 })).toBeNull();
    expect(categoryNumbersIssue({ totalSpots: 16, price: 0 })).toBeNull();
  });

  it("un precio con céntimos dice qué campo falla", () => {
    expect(categoryNumbersIssue({ totalSpots: 16, price: 24.5 })).toBe("El precio va en euros, sin céntimos (0 si es gratis)");
    expect(categoryNumbersIssue({ totalSpots: 16, price: -1 })).toBe("El precio va en euros, sin céntimos (0 si es gratis)");
  });

  it("plazas no enteras o a 0", () => {
    expect(categoryNumbersIssue({ totalSpots: 8.5, price: 25 })).toBe("Las plazas son un número entero (mínimo 1)");
    expect(categoryNumbersIssue({ totalSpots: 0, price: 25 })).toBe("Las plazas son un número entero (mínimo 1)");
  });
});
