import { describe, it, expect } from "vitest";
import { availabilityChanged, availabilityDays } from "../../../lib/utils/registration-availability";

const tournamentDays = [
  { dayId: "d1", label: "Sábado", date: "2026-07-04", allSlots: ["10:00", "11:00"] },
  { dayId: "d2", label: "Domingo", date: null, allSlots: ["10:00"] },
];
const given = (dayId: string, unavailable: string[] = []) => ({
  dayId, label: dayId, date: null, allSlots: ["10:00", "11:00"],
  fullAvailability: unavailable.length === 0, unavailableSlots: unavailable,
});

describe("availabilityDays", () => {
  it("todas las jornadas del torneo; las no dadas, disponibles todo el día y marcadas como no dadas", () => {
    const days = availabilityDays({ days: [given("d2", ["10:00"])], tournamentDays });
    expect(days.map((d) => [d.dayId, d.given, d.fullAvailability, [...d.unavailableSlots]])).toEqual([
      ["d1", false, true, []],
      ["d2", true, false, ["10:00"]],
    ]);
  });

  it("sin tournamentDays (un back anterior): solo las dadas, como antes", () => {
    expect(availabilityDays({ days: [given("d1")] }).map((d) => d.dayId)).toEqual(["d1"]);
  });
});

describe("availabilityChanged", () => {
  it("sin tocar nada, con todo dado: sin cambios, aunque el orden de las listas no coincida", () => {
    const baseline = availabilityDays({ days: [given("d2"), given("d1", ["11:00"])], tournamentDays });
    const edited = [...baseline].reverse();
    expect(availabilityChanged(edited, baseline)).toBe(false);
  });

  it("una jornada no dada cuenta como cambio (guardar la mete)", () => {
    const baseline = availabilityDays({ days: [given("d2")], tournamentDays });
    expect(availabilityChanged(baseline, baseline)).toBe(true);
  });

  it("cambiar una franja: cambio", () => {
    const baseline = availabilityDays({ days: [given("d1", ["10:00"]), given("d2")], tournamentDays });
    const edited = baseline.map((d) => (d.dayId === "d1" ? { ...d, unavailableSlots: new Set(["11:00"]) } : d));
    expect(availabilityChanged(edited, baseline)).toBe(true);
  });
});
