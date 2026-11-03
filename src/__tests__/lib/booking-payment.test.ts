/**
 * El pago de una reserva en su detalle. A los 6 años del cobro el back borra
 * sus datos de cobro (RGPD) y el método llega vacío (null): no consta.
 */
import { describe, it, expect } from "vitest";
import { paymentAction, paymentMethodLabel } from "@/lib/utils/booking-payment";

describe("paymentMethodLabel", () => {
  it("cada método, con su nombre", () => {
    expect(paymentMethodLabel("PENDING")).toBe("Pendiente");
    expect(paymentMethodLabel("CASH_AT_VENUE")).toBe("Efectivo en pista");
    expect(paymentMethodLabel("ONLINE")).toBe("Online");
    expect(paymentMethodLabel("PAID_MANUAL")).toBe("Cobrado manualmente");
  });

  it("sin método, que no consta (antes salía «()»)", () => {
    expect(paymentMethodLabel(null)).toBe("sin datos de cobro");
  });
});

describe("paymentAction", () => {
  it("pendiente: marcarla pagada", () => {
    expect(paymentAction("PENDING")).toBe("markPaid");
  });

  it("con un cobro: marcarla como no pagada", () => {
    for (const method of ["CASH_AT_VENUE", "ONLINE", "PAID_MANUAL"] as const) {
      expect(paymentAction(method)).toBe("markUnpaid");
    }
  });

  it("sin método, nada: ni «Marcar como no pagada» ni volver a crear lo que se borró", () => {
    expect(paymentAction(null)).toBeNull();
  });
});
