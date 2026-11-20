import { describe, it, expect } from "vitest";
import {
  PAYMENT_METHOD_OPTIONS,
  centsToEurosInput,
  eurosToCents,
  methodLabel,
  playerShareCents,
} from "@/lib/utils/payment-methods";
import { bizumReceiverTotals, buildCashHtml, dayLabel, methodsWithTotals, movementMethodLabel } from "@/lib/utils/print-cash";
import type { CashOfDay } from "@/lib/services/cash";

describe("catálogo de métodos de cobro", () => {
  it("el club cobra con cinco métodos, siempre los mismos", () => {
    expect(PAYMENT_METHOD_OPTIONS.map((o) => o.label)).toEqual(["Efectivo", "Tarjeta", "Bizum", "Transferencia", "Otro"]);
  });

  it("cada valor, con su etiqueta; los antiguos de reservas, con la suya", () => {
    expect(methodLabel("CASH")).toBe("Efectivo");
    expect(methodLabel("ONLINE")).toBe("Online");
    expect(methodLabel("CASH_AT_VENUE")).toBe("En el club");
    expect(methodLabel("PAID_MANUAL")).toBe("Pagada");
    expect(methodLabel(null)).toBe("Sin método");
  });

  it("«Bono» solo se lee: una reserva pagada con una sesión de bono, no un método de cobro", () => {
    expect(methodLabel("VOUCHER")).toBe("Bono");
    expect(PAYMENT_METHOD_OPTIONS.map((o) => o.value)).not.toContain("VOUCHER");
  });
});

describe("importes", () => {
  it("de euros escritos a céntimos, con coma o punto", () => {
    expect(eurosToCents("12")).toBe(1200);
    expect(eurosToCents("12,5")).toBe(1250);
    expect(eurosToCents("12.50")).toBe(1250);
    expect(eurosToCents(" 0,05 ")).toBe(5);
  });

  it("lo que no es un importe, null", () => {
    expect(eurosToCents("")).toBeNull();
    expect(eurosToCents("abc")).toBeNull();
    expect(eurosToCents("-3")).toBeNull();
    expect(eurosToCents("1,234")).toBeNull();
  });

  it("de céntimos al campo de texto y la mitad del precio de la pareja", () => {
    expect(centsToEurosInput(1250)).toBe("12,50");
    expect(playerShareCents(30)).toBe(1500);
    expect(playerShareCents(15)).toBe(750);
  });
});

describe("cierre de caja para imprimir", () => {
  const cash: CashOfDay = {
    date: "2026-11-10",
    timezone: "Europe/Madrid",
    movements: [
      { source: "BOOKING", refId: "b1", at: "2026-11-10T09:30:00.000Z", concept: "Reserva <Pista 1>", person: "Ana", method: "CARD", amountCents: 1800 },
      { source: "REGISTRATION", refId: "r1", at: "2026-11-10T10:00:00.000Z", concept: "Inscripción Open", person: "Luis", method: "CASH_AT_VENUE", amountCents: 1000 },
    ],
    totalsByMethod: { CASH_AT_VENUE: 1000, CARD: 1800 },
    totalCents: 2800,
  };

  it("ordena los métodos: los del catálogo y luego los antiguos", () => {
    expect(methodsWithTotals(cash.totalsByMethod)).toEqual(["CARD", "CASH_AT_VENUE"]);
  });

  it("las reservas pagadas con bono (0 €) y la devolución de un bono (negativa) salen en su método", () => {
    const withVouchers: CashOfDay = {
      ...cash,
      movements: [
        { source: "VOUCHER", refId: "v1", at: "2026-11-10T09:00:00.000Z", concept: "Bono Bono 10", person: "Ana", method: "CARD", amountCents: 12000 },
        { source: "BOOKING", refId: "b1", at: "2026-11-10T09:30:00.000Z", concept: "Reserva Pista 1", person: "Ana", method: "VOUCHER", amountCents: 0 },
        { source: "VOUCHER", refId: "v2", at: "2026-11-10T11:00:00.000Z", concept: "Devolución del bono Bono 5", person: "Luis", method: "CARD", amountCents: -3000 },
      ],
      totalsByMethod: { CARD: 9000, VOUCHER: 0 },
      totalCents: 9000,
    };
    expect(methodsWithTotals(withVouchers.totalsByMethod)).toEqual(["CARD", "VOUCHER"]);
    const html = buildCashHtml(withVouchers, "Club Norte");
    expect(html).toContain("Bono");
    expect(html).toContain("Devolución del bono Bono 5");
    expect(html).toContain("-30,00");
  });

  it("el Bizum por receptor sale al imprimir, con «Club» primero y el móvil en cada movimiento", () => {
    const withBizum: CashOfDay = {
      ...cash,
      movements: [
        { source: "BOOKING_PART", refId: "p1", bookingId: "b1", at: "2026-11-10T09:30:00.000Z", concept: "Pista 1 · 10:30", person: "Ana", method: "BIZUM", amountCents: 500, bizumReceiver: "Marta" },
        { source: "BOOKING", refId: "b2", at: "2026-11-10T10:30:00.000Z", concept: "Reserva Pista 2", person: "Luis", method: "BIZUM", amountCents: 1800, bizumReceiver: "Club" },
      ],
      totalsByMethod: { BIZUM: 2300 },
      bizumByReceiver: { Marta: 500, Club: 1800 },
      totalCents: 2300,
    };
    expect(bizumReceiverTotals(withBizum)).toEqual([["Club", 1800], ["Marta", 500]]);
    expect(movementMethodLabel(withBizum.movements[0])).toBe("Bizum · Marta");
    const html = buildCashHtml(withBizum, "Club Norte");
    expect(html).toContain("Bizum por receptor");
    expect(html).toContain("Bizum · Marta");
    expect(html.indexOf("Club</td>")).toBeLessThan(html.indexOf("Marta</td>"));
  });

  it("sin desglose de Bizum (módulo apagado), el cierre impreso no lleva esa sección", () => {
    expect(bizumReceiverTotals(cash)).toEqual([]);
    expect(buildCashHtml(cash, "Club Norte")).not.toContain("Bizum por receptor");
    expect(movementMethodLabel({ method: "BIZUM" })).toBe("Bizum");
  });

  it("lleva el día, las horas del club, los totales y escapa lo que viene del back", () => {
    const html = buildCashHtml(cash, "Club Norte");
    expect(dayLabel(cash.date)).toBe("10/11/2026");
    expect(html).toContain("Caja del 10/11/2026");
    expect(html).toContain("10:30");
    expect(html).toContain("Reserva &lt;Pista 1&gt;");
    expect(html).toContain("Tarjeta");
    expect(html).toContain("En el club");
    expect(html).toContain("28,00");
  });
});
