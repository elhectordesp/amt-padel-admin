/**
 * Utilidades de gastos, ingresos y entrenadores (F8 fase 2): formas de pago,
 * rango de un mes, reducción de fotos y textos de error.
 */
import { describe, it, expect } from "vitest";
import {
  fitSize, isDayKey, isReceiptFile, minutesText, monthRange, owedText, paymentOptions, RECEIPT_MAX_SIDE,
} from "@/lib/utils/ledger";
import { accountsErrorText } from "@/lib/utils/booking-parts";

describe("paymentOptions", () => {
  it("«Pendiente» solo en gastos", () => {
    expect(paymentOptions("EXPENSE").map((o) => o.value)).toEqual(["CASH", "BANK", "CARD", "PARTNER", "PENDING", "UNKNOWN"]);
    expect(paymentOptions("INCOME").map((o) => o.value)).not.toContain("PENDING");
  });
  it("se puede quitar «Pendiente» también en un gasto (al pagarlo)", () => {
    expect(paymentOptions("EXPENSE", { allowPending: false }).map((o) => o.value)).not.toContain("PENDING");
  });
});

describe("monthRange", () => {
  it("el primer y el último día, con febrero bisiesto", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2026-02").to).toBe("2026-02-28");
    expect(monthRange("2028-02").to).toBe("2028-02-29");
  });
});

describe("fitSize", () => {
  it("no toca lo que ya cabe", () => {
    expect(fitSize(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
  it("reduce al lado mayor de 1.800 px conservando la proporción", () => {
    expect(RECEIPT_MAX_SIDE).toBe(1800);
    expect(fitSize(3600, 2400)).toEqual({ width: 1800, height: 1200 });
    expect(fitSize(2000, 4000)).toEqual({ width: 900, height: 1800 });
  });
});

describe("isReceiptFile", () => {
  it("admite fotos JPEG, PNG, WEBP y PDF", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"])
      expect(isReceiptFile({ type })).toBe(true);
    expect(isReceiptFile({ type: "image/gif" })).toBe(false);
    expect(isReceiptFile({ type: "text/plain" })).toBe(false);
  });
});

describe("textos", () => {
  it("minutos en horas", () => {
    expect(minutesText(45)).toBe("45 min");
    expect(minutesText(60)).toBe("1 h");
    expect(minutesText(150)).toBe("2 h 30 min");
  });
  it("lo que se debe y lo que queda a favor", () => {
    const f = (c: number) => `${c / 100} €`;
    expect(owedText(1500, f)).toBe("15 €");
    expect(owedText(-500, f)).toBe("5 € a su favor");
  });
  it("días reales", () => {
    expect(isDayKey("2026-11-23")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("23/11/2026")).toBe(false);
  });
});

describe("accountsErrorText con los códigos nuevos", () => {
  it("los dice en llano", () => {
    expect(accountsErrorText({ code: "LEDGER_ATTACHMENT_LIMIT", message: "x" })).toMatch(/10 justificantes/);
    expect(accountsErrorText({ code: "LEDGER_CATEGORY_INACTIVE", message: "x" })).toMatch(/desactivada/);
  });
  it("con LEDGER_INVALID enseña el motivo concreto del back", () => {
    expect(accountsErrorText({ code: "LEDGER_INVALID", message: "Solo un gasto puede estar pendiente de pago" })).toBe(
      "Solo un gasto puede estar pendiente de pago",
    );
  });
});
