import { describe, it, expect } from "vitest";
import { collectedCents, refundableOf } from "@/lib/utils/booking-refund";
import type { Booking } from "@/types/bookings";

type Paid = Pick<Booking, "paymentMethod" | "paidAt" | "paidAmountCents" | "priceCents">;
const paid = (over: Partial<Paid> = {}): Paid => ({
  paymentMethod: "CASH_AT_VENUE",
  paidAt: "2026-11-10T09:30:00.000Z",
  paidAmountCents: 1800,
  priceCents: 2000,
  ...over,
});

describe("collectedCents", () => {
  it("cobrada: lo que se cobró, no el precio", () => {
    expect(collectedCents(paid())).toBe(1800);
  });

  it("cobrada sin importe apuntado (antigua): su precio", () => {
    expect(collectedCents(paid({ paidAmountCents: null }))).toBe(2000);
  });

  it.each([
    ["pendiente de pago", { paymentMethod: "PENDING" as const }],
    ["sin método (datos de cobro borrados)", { paymentMethod: null }],
    ["sin fecha de cobro", { paidAt: null }],
  ])("%s: no hay cobro", (_label, over) => {
    expect(collectedCents(paid(over))).toBeNull();
  });

  it("pagada con una sesión de bono: no movió dinero, 0", () => {
    expect(collectedCents(paid({ paymentMethod: "VOUCHER", paidAmountCents: null }))).toBe(0);
  });
});

describe("refundableOf", () => {
  it("cuenta y suma solo las cobradas en dinero", () => {
    const r = refundableOf([
      paid(),
      paid({ paidAmountCents: 1500 }),
      paid({ paymentMethod: "PENDING", paidAt: null }),
      paid({ paymentMethod: "VOUCHER", paidAmountCents: 0 }),
    ]);
    expect(r).toEqual({ count: 2, cents: 3300 });
  });

  it("sin ninguna cobrada, 0 y 0", () => {
    expect(refundableOf([paid({ paymentMethod: "PENDING", paidAt: null })])).toEqual({ count: 0, cents: 0 });
    expect(refundableOf([])).toEqual({ count: 0, cents: 0 });
  });
});
