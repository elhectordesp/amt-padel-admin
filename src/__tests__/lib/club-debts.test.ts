/**
 * La píldora del plazo de una deuda: «Día n de N», «Último día» (resaltada) y
 * «Largo plazo».
 */
import { describe, it, expect } from "vitest";
import { debtPill } from "@/lib/utils/club-debts";

describe("debtPill", () => {
  it("«Día n de N» con el plazo del club", () => {
    expect(debtPill({ dayNumber: 5, expiryDays: 10, lastDay: false, longTerm: false })).toEqual({
      label: "Día 5 de 10",
      urgent: false,
    });
  });

  it("el último día se resalta", () => {
    expect(debtPill({ dayNumber: 10, expiryDays: 10, lastDay: true, longTerm: false })).toEqual({
      label: "Último día",
      urgent: true,
    });
  });

  it("sin plazo en el club, solo el día", () => {
    expect(debtPill({ dayNumber: 3, expiryDays: null, lastDay: false, longTerm: false }).label).toBe("Día 3");
  });

  it("de largo plazo no cuenta días ni se resalta, aunque llegue como último día", () => {
    expect(debtPill({ dayNumber: 40, expiryDays: 10, lastDay: true, longTerm: true })).toEqual({
      label: "Largo plazo",
      urgent: false,
    });
  });
});
