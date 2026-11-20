import { describe, it, expect } from "vitest";
import {
  findGaps,
  perPlayerText,
  rowsToSlots,
  slotsToRows,
  type GridRow,
} from "../../../lib/utils/price-grid";
import type { CourtPriceSlot } from "../../../types/bookings";

let n = 0;
function slot(p: Partial<CourtPriceSlot>): CourtPriceSlot {
  n += 1;
  return {
    id: `s${n}`,
    courtId: "c1",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
    durationMinutes: 90,
    priceCents: 2000,
    label: null,
    ...p,
  };
}

/** Todos los días × duraciones de una franja. */
function band(label: string, start: string, end: string, days: number[], prices: Record<number, number>) {
  return days.flatMap((d) =>
    Object.entries(prices).map(([dur, cents]) =>
      slot({ label, startTime: start, endTime: end, dayOfWeek: d, durationMinutes: Number(dur), priceCents: cents }),
    ),
  );
}

const key = (s: { dayOfWeek: number; startTime: string; endTime: string; durationMinutes: number; priceCents: number; label?: string | null }) =>
  `${s.label ?? ""}|${s.dayOfWeek}|${s.startTime}|${s.endTime}|${s.durationMinutes}|${s.priceCents}`;

describe("slotsToRows / rowsToSlots", () => {
  it("agrupa días con los mismos precios en una fila y no pierde nada", () => {
    const input = [
      ...band("Valle", "09:00", "17:00", [1, 2, 3, 4, 5], { 60: 1500, 90: 2000 }),
      ...band("Valle", "09:00", "17:00", [6, 7], { 60: 1800, 90: 2400 }),
      ...band("Punta", "17:00", "23:00", [1, 2, 3, 4, 5, 6, 7], { 60: 2500, 90: 3200 }),
    ];
    const rows = slotsToRows(input);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.label === "Valle" && r.days.length === 5)?.prices).toEqual({ 60: "15", 90: "20" });

    const back = rowsToSlots(rows);
    expect(back.errors).toEqual([]);
    expect(back.slots.map(key).sort()).toEqual(input.map(key).sort());
  });

  it("un día con menos duraciones queda en su propia fila", () => {
    const input = [
      ...band("", "09:00", "23:00", [1, 2], { 60: 1500, 90: 2000 }),
      ...band("", "09:00", "23:00", [3], { 90: 2000 }),
    ];
    const rows = slotsToRows(input);
    expect(rows).toHaveLength(2);
    expect(rowsToSlots(rows).slots.map(key).sort()).toEqual(input.map(key).sort());
  });

  it("franjas con distinto nombre u horas no se mezclan; sin nombre no envía label", () => {
    const input = [slot({ label: null }), slot({ label: "Valle", dayOfWeek: 2 })];
    expect(slotsToRows(input)).toHaveLength(2);
    const out = rowsToSlots(slotsToRows(input)).slots;
    expect(out.find((s) => s.dayOfWeek === 1)).not.toHaveProperty("label");
    expect(out.find((s) => s.dayOfWeek === 2)?.label).toBe("Valle");
  });

  it("celda vacía = sin precio; precio inválido, horas al revés y sin días son errores", () => {
    const row = (p: Partial<GridRow>): GridRow => ({
      id: "r", label: "", startTime: "09:00", endTime: "17:00", days: [1], prices: { 60: "15" }, ...p,
    });
    expect(rowsToSlots([row({ prices: { 60: "15", 90: "" } })]).slots).toHaveLength(1);
    expect(rowsToSlots([row({ prices: { 60: "abc" } })]).errors.length).toBeGreaterThan(0);
    expect(rowsToSlots([row({ startTime: "18:00" })]).errors.length).toBeGreaterThan(0);
    expect(rowsToSlots([row({ days: [] })]).errors.length).toBeGreaterThan(0);
    expect(rowsToSlots([row({ prices: {} })]).errors.length).toBeGreaterThan(0);
  });

  it("acepta coma decimal", () => {
    const r: GridRow = { id: "r", label: "", startTime: "09:00", endTime: "10:00", days: [1], prices: { 60: "12,50" } };
    expect(rowsToSlots([r]).slots[0].priceCents).toBe(1250);
  });
});

describe("perPlayerText", () => {
  it("divide entre 4 en dobles y entre 2 en individual", () => {
    expect(perPlayerText("20", "DOUBLES")).toContain("5,00");
    expect(perPlayerText("20", undefined)).toContain("5,00");
    expect(perPlayerText("20", "SINGLES")).toContain("10,00");
    expect(perPlayerText("", "DOUBLES")).toBeNull();
    expect(perPlayerText("x", "DOUBLES")).toBeNull();
  });
});

describe("findGaps", () => {
  const all = [1, 2, 3, 4, 5, 6, 7];
  it("sin huecos cuando todo tiene precio", () => {
    const slots = rowsToSlots(slotsToRows(band("", "09:00", "23:00", all, { 60: 1500, 90: 2000 }))).slots;
    expect(findGaps(slots, [60, 90])).toEqual([]);
  });

  it("avisa de los días y duraciones sin ningún precio", () => {
    const slots = rowsToSlots(slotsToRows(band("", "09:00", "23:00", [1, 2, 3, 4, 5], { 60: 1500 }))).slots;
    const gaps = findGaps(slots, [60, 90]);
    expect(gaps.some((g) => g.startsWith("60 min") && g.includes("Fin de semana"))).toBe(true);
    expect(gaps.some((g) => g.startsWith("90 min") && g.includes("ningún día"))).toBe(true);
  });

  it("con horario: avisa del tramo sin precio y no cuenta los días cerrados", () => {
    const slots = rowsToSlots(slotsToRows(band("", "09:00", "21:00", [1], { 60: 1500 }))).slots;
    const hours = [
      { id: "h1", clubId: "x", dayOfWeek: 1, openTime: "08:00", closeTime: "23:00", active: true },
    ];
    const gaps = findGaps(slots, [60], hours);
    expect(gaps).toContain("Lun, 60 min: sin precio de 08:00-09:00 y 21:00-23:00.");
    expect(gaps.some((g) => g.includes("Mar"))).toBe(false);
  });
});
