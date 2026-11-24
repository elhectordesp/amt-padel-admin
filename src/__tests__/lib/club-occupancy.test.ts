import { describe, it, expect } from "vitest";
import { formatMinutes, formatPct, presetRange, rangeDays, rangeError } from "@/lib/utils/club-occupancy";

describe("presetRange", () => {
  it("el último mes son 30 días contando hoy", () => {
    expect(presetRange("MONTH", "2026-11-30")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });
  it("el último trimestre son 90 días contando hoy", () => {
    const r = presetRange("QUARTER", "2026-11-30");
    expect(r.to).toBe("2026-11-30");
    expect(rangeDays(r.from, r.to)).toBe(90);
  });
});

describe("rangeError", () => {
  it("pide las dos fechas, el orden y el máximo de 366 días", () => {
    expect(rangeError("", "2026-01-01")).toBe("Elige las dos fechas");
    expect(rangeError("2026-02-01", "2026-01-01")).toMatch(/anterior/);
    expect(rangeError("2026-01-01", "2027-01-02")).toMatch(/366/);
    expect(rangeError("2026-01-01", "2027-01-01")).toBeNull();
  });
});

describe("formatos", () => {
  it("porcentaje con coma y horas", () => {
    expect(formatPct(42.5)).toBe("42,5 %");
    expect(formatPct(0)).toBe("0 %");
    expect(formatMinutes(750)).toBe("12 h 30 min");
    expect(formatMinutes(720)).toBe("12 h");
    expect(formatMinutes(45)).toBe("45 min");
  });
});
