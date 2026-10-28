/**
 * Precios de reservas escritos en euros (R1-8): se leen tal cual se teclean
 * y se pasan a céntimos al guardar.
 */
import { describe, it, expect } from "vitest";
import { centsToEurosText, eurosToCents } from "@/lib/utils/booking-price";

describe("eurosToCents", () => {
  it("euros enteros, con punto o con coma", () => {
    expect(eurosToCents("25")).toBe(2500);
    expect(eurosToCents(" 12.5 ")).toBe(1250);
    expect(eurosToCents("12,50")).toBe(1250);
    expect(eurosToCents("0")).toBe(0);
    expect(eurosToCents("19.99")).toBe(1999);
  });

  it("lo que no es un precio: null (vacío, negativo, tres decimales, texto)", () => {
    for (const bad of ["", "  ", "-5", "1.005", "abc", "2.", "1e3"]) {
      expect(eurosToCents(bad)).toBeNull();
    }
  });
});

describe("centsToEurosText", () => {
  it("el precio guardado, sin ceros de relleno que estorben al teclear", () => {
    expect(centsToEurosText(2500)).toBe("25");
    expect(centsToEurosText(1250)).toBe("12.5");
    expect(centsToEurosText(1999)).toBe("19.99");
  });
});
