import { describe, it, expect } from "vitest";
import { feeText, overdueNotice, paidUntilText, planLabel } from "../../../lib/utils/amt-plan";
import type { ClubAmtPlan } from "@/types";

const plan = (over: Partial<ClubAmtPlan> = {}): ClubAmtPlan => ({
  bookingPlan: "SUBSCRIPTION",
  bookingMonthlyFeeCents: 4900,
  bookingCommissionRate: null,
  feePaidUntil: "2026-11-15",
  overdue: false,
  ...over,
});

describe("feeText", () => {
  it("cuota mensual en euros", () => {
    expect(feeText(plan())).toBe("49 €/mes");
    expect(feeText(plan({ bookingMonthlyFeeCents: 4950 }))).toBe("49,5 €/mes");
  });
  it("comisión en porcentaje", () => {
    expect(feeText(plan({ bookingPlan: "COMMISSION", bookingMonthlyFeeCents: null, bookingCommissionRate: 0.05 }))).toBe("5 % de comisión");
  });
  it("sin importe: null", () => {
    expect(feeText(plan({ bookingPlan: "FREE", bookingMonthlyFeeCents: null }))).toBeNull();
    expect(feeText(plan({ bookingPlan: "CUSTOM" }))).toBeNull();
  });
});

describe("overdueNotice", () => {
  it("al día o sin datos: sin aviso", () => {
    expect(overdueNotice(plan())).toBeNull();
    expect(overdueNotice(undefined)).toBeNull();
  });
  it("vencida: desde el día siguiente al último pagado", () => {
    expect(overdueNotice(plan({ overdue: true }))).toBe(
      "Cuota pendiente desde 16 de noviembre de 2026. Escríbenos a info@amtpadel.com",
    );
  });
  it("vencida sin fecha apuntada: sin «desde»", () => {
    expect(overdueNotice(plan({ overdue: true, feePaidUntil: null }))).toBe(
      "Cuota pendiente. Escríbenos a info@amtpadel.com",
    );
  });
});

describe("textos", () => {
  it("plan y fecha", () => {
    expect(planLabel("FREE")).toBe("Gratuito");
    expect(paidUntilText(null)).toBeNull();
    expect(paidUntilText("2026-12-31")).toBe("31 de diciembre de 2026");
  });
});
