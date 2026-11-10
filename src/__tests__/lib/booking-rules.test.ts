/**
 * Reglas de reserva del club (modo estricto y antelación con arrastre): el
 * ejemplo que ve el gestor y la validación antes de guardar.
 */
import { describe, it, expect } from "vitest";
import {
  advanceExample,
  formatMinutes,
  rulesError,
  type BookingRulesForm,
} from "@/lib/utils/booking-rules";

const off: BookingRulesForm = {
  strictModeEnabled: false,
  strictFrom: null,
  strictTo: null,
  advanceRuleEnabled: false,
  advanceRuleFrom: null,
  advanceRuleTo: null,
  advanceRuleMinutes: 120,
};

describe("formatMinutes", () => {
  it("horas y minutos legibles", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(90)).toBe("1 h 30 min");
  });
});

describe("advanceExample", () => {
  it("la hora límite para jugar a la primera hora de la franja", () => {
    expect(advanceExample("12:00", 120)).toContain("antes de las 10:00");
    expect(advanceExample("12:00", 120)).toContain("Con 2 h de antelación");
  });

  it("si la antelación cruza la medianoche lo dice", () => {
    expect(advanceExample("09:00", 720)).toContain("antes de las 21:00 del día anterior");
  });

  it("sin hora de inicio usa un ejemplo a mediodía", () => {
    expect(advanceExample(null, 60)).toContain("a las 12:00");
  });
});

describe("rulesError", () => {
  it("apagadas y sin horas, se puede guardar", () => {
    expect(rulesError(off)).toBeNull();
  });

  it("activar una regla exige sus dos horas", () => {
    expect(rulesError({ ...off, strictModeEnabled: true })).toMatch(/Reservas sin huecos/);
    expect(
      rulesError({ ...off, advanceRuleEnabled: true, advanceRuleFrom: "10:00" }),
    ).toMatch(/Antelación con arrastre/);
  });

  it("el inicio va antes que el fin", () => {
    expect(
      rulesError({ ...off, strictModeEnabled: true, strictFrom: "22:00", strictTo: "17:00" }),
    ).toMatch(/anterior/);
  });

  it("los minutos de 0 a 2880", () => {
    expect(rulesError({ ...off, advanceRuleMinutes: 3000 })).toMatch(/2880/);
    expect(rulesError({ ...off, advanceRuleMinutes: 2880 })).toBeNull();
  });

  it("activada y con una franja válida, se puede guardar", () => {
    expect(
      rulesError({ ...off, strictModeEnabled: true, strictFrom: "17:00", strictTo: "22:00" }),
    ).toBeNull();
  });
});
