import { describe, it, expect } from "vitest";
import {
  AMT_PLAN_NOTES_MAX_LENGTH,
  amtPlanFormSchema,
  amtPlanFormValues,
  centsToEurosText,
  eurosTextToCents,
  feeText,
  overdueNotice,
  paidUntilText,
  percentTextToRate,
  planLabel,
  rateToPercentText,
  toAmtPlanPayload,
  type AmtPlanFormValues,
} from "../../../lib/utils/amt-plan";
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
    expect(feeText(plan({ bookingPlan: "CUSTOM", bookingMonthlyFeeCents: null, bookingCommissionRate: null }))).toBeNull();
  });
  it("acuerdo especial: enseña la cuota y/o la comisión si vienen", () => {
    expect(feeText(plan({ bookingPlan: "CUSTOM", bookingMonthlyFeeCents: 3000, bookingCommissionRate: null }))).toBe("30 €/mes");
    expect(feeText(plan({ bookingPlan: "CUSTOM", bookingMonthlyFeeCents: null, bookingCommissionRate: 0.05 }))).toBe("5 % de comisión");
    expect(feeText(plan({ bookingPlan: "CUSTOM", bookingMonthlyFeeCents: 3000, bookingCommissionRate: 0.05 }))).toBe("30 €/mes · 5 % de comisión");
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

describe("céntimos y euros", () => {
  it("de céntimos al campo y vuelta, sin ceros de más", () => {
    expect(centsToEurosText(4900)).toBe("49");
    expect(centsToEurosText(4950)).toBe("49,5");
    expect(centsToEurosText(4905)).toBe("49,05");
    expect(centsToEurosText(5)).toBe("0,05");
    expect(eurosTextToCents("49")).toBe(4900);
    expect(eurosTextToCents("49,5")).toBe(4950);
    expect(eurosTextToCents("49.50")).toBe(4950);
    expect(eurosTextToCents(" 0,05 ")).toBe(5);
  });
  it("lo que no es un importe con hasta 2 decimales, null", () => {
    for (const bad of ["", "abc", "49,555", "-5", "4 9", "49,", ",5", "1e3"]) {
      expect(eurosTextToCents(bad)).toBeNull();
    }
  });
  it("los importes con decimales traicioneros no se desvían (19,99 € = 1999 c)", () => {
    expect(eurosTextToCents("19,99")).toBe(1999);
    expect(eurosTextToCents("0,29")).toBe(29);
    expect(eurosTextToCents("1,15")).toBe(115);
  });
  it("ida y vuelta exactas de 0,01 € a 10.000 €", () => {
    for (let cents = 1; cents <= 1_000_000; cents++) {
      if (eurosTextToCents(centsToEurosText(cents)) !== cents) throw new Error(`falla en ${cents} céntimos`);
    }
  });
});

describe("porcentaje y tasa", () => {
  it("5,5 % es la tasa 0,055; 7 % es 0,07, sin ruido binario", () => {
    expect(percentTextToRate("5,5")).toBe(0.055);
    expect(percentTextToRate("7")).toBe(0.07);
    expect(percentTextToRate("0,01")).toBe(0.0001);
    expect(percentTextToRate("100")).toBe(1);
    expect(rateToPercentText(0.055)).toBe("5,5");
    expect(rateToPercentText(0.07)).toBe("7");
    expect(rateToPercentText(0.0001)).toBe("0,01");
    expect(rateToPercentText(1)).toBe("100");
  });
  it("lo que no es un porcentaje con hasta 2 decimales, null", () => {
    expect(percentTextToRate("5,555")).toBeNull();
    expect(percentTextToRate("cinco")).toBeNull();
  });
  it("ida y vuelta exactas en las 10.000 tasas posibles, y con 4 decimales como las guarda el back", () => {
    for (let bp = 1; bp <= 10_000; bp++) {
      const rate = percentTextToRate(rateToPercentText(bp / 10_000));
      // toFixed(4) es lo que el back manda a la columna Decimal(5,4)
      if (rate !== bp / 10_000 || (rate as number).toFixed(4) !== (bp / 10_000).toFixed(4)) {
        throw new Error(`falla en ${bp} puntos básicos`);
      }
    }
  });
});

describe("formulario del plan", () => {
  const values = (over: Partial<AmtPlanFormValues> = {}): AmtPlanFormValues => ({
    bookingPlan: "SUBSCRIPTION",
    fee: "49",
    commission: "",
    notes: "",
    ...over,
  });
  const errorsOf = (v: AmtPlanFormValues) => {
    const r = amtPlanFormSchema.safeParse(v);
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
  };

  it("lo guardado pasa al formulario con euros y porcentaje", () => {
    expect(
      amtPlanFormValues({ ...plan(), bookingPlan: "COMMISSION", bookingMonthlyFeeCents: null, bookingCommissionRate: 0.055, bookingBillingNotes: "piloto" }),
    ).toEqual({ bookingPlan: "COMMISSION", fee: "", commission: "5,5", notes: "piloto" });
    expect(amtPlanFormValues({ ...plan(), bookingBillingNotes: null })).toEqual({
      bookingPlan: "SUBSCRIPTION",
      fee: "49",
      commission: "",
      notes: "",
    });
  });

  it("suscripción: cuota obligatoria y mayor que 0", () => {
    expect(errorsOf(values())).toEqual({});
    expect(errorsOf(values({ fee: "" })).fee).toBe("La cuota mensual es obligatoria");
    expect(errorsOf(values({ fee: "0" })).fee).toBe("La cuota debe ser mayor que 0");
    expect(errorsOf(values({ fee: "abc" })).fee).toMatch(/importe en euros/);
    expect(errorsOf(values({ fee: "10000" }))).toEqual({});
    expect(errorsOf(values({ fee: "10000,01" })).fee).toMatch(/no puede pasar de 10000 €/);
  });

  it("comisión: obligatoria, mayor que 0 y hasta 100 %", () => {
    const c = (commission: string) => values({ bookingPlan: "COMMISSION", fee: "", commission });
    expect(errorsOf(c("5,5"))).toEqual({});
    expect(errorsOf(c("100"))).toEqual({});
    expect(errorsOf(c("")).commission).toBe("La comisión es obligatoria");
    expect(errorsOf(c("0")).commission).toBe("La comisión debe ser mayor que 0");
    expect(errorsOf(c("100,01")).commission).toMatch(/100 %/);
    expect(errorsOf(c("5,555")).commission).toMatch(/porcentaje/);
  });

  it("gratuito no pide nada; acuerdo especial, las dos opcionales pero válidas si vienen", () => {
    expect(errorsOf(values({ bookingPlan: "FREE", fee: "", commission: "" }))).toEqual({});
    expect(errorsOf(values({ bookingPlan: "CUSTOM", fee: "", commission: "" }))).toEqual({});
    expect(errorsOf(values({ bookingPlan: "CUSTOM", fee: "25", commission: "3" }))).toEqual({});
    expect(errorsOf(values({ bookingPlan: "CUSTOM", fee: "0", commission: "" })).fee).toBeDefined();
  });

  it("un campo que el plan no lleva no se valida aunque tenga texto (se descarta al enviar)", () => {
    expect(errorsOf(values({ bookingPlan: "COMMISSION", fee: "basura", commission: "5" }))).toEqual({});
    expect(errorsOf(values({ bookingPlan: "FREE", fee: "basura", commission: "basura" }))).toEqual({});
  });

  it("notas: hasta 1000 caracteres, sin contar los espacios de los lados", () => {
    expect(errorsOf(values({ notes: ` ${"a".repeat(AMT_PLAN_NOTES_MAX_LENGTH)} ` }))).toEqual({});
    expect(errorsOf(values({ notes: "a".repeat(AMT_PLAN_NOTES_MAX_LENGTH + 1) })).notes).toMatch(/1000/);
  });

  it("payload: cuota en céntimos, comisión como tasa y lo que no lleva el plan, a null", () => {
    expect(toAmtPlanPayload(values({ notes: "  piloto  " }))).toEqual({
      bookingPlan: "SUBSCRIPTION",
      bookingMonthlyFeeCents: 4900,
      bookingCommissionRate: null,
      bookingBillingNotes: "piloto",
    });
    // Venía de suscripción con 49 €: al pasar a comisión la cuota no se cuela
    expect(toAmtPlanPayload(values({ bookingPlan: "COMMISSION", fee: "49", commission: "5,5" }))).toEqual({
      bookingPlan: "COMMISSION",
      bookingMonthlyFeeCents: null,
      bookingCommissionRate: 0.055,
      bookingBillingNotes: null,
    });
    expect(toAmtPlanPayload(values({ bookingPlan: "FREE", fee: "49", commission: "5" }))).toEqual({
      bookingPlan: "FREE",
      bookingMonthlyFeeCents: null,
      bookingCommissionRate: null,
      bookingBillingNotes: null,
    });
    expect(toAmtPlanPayload(values({ bookingPlan: "CUSTOM", fee: "25,5", commission: "" }))).toMatchObject({
      bookingMonthlyFeeCents: 2550,
      bookingCommissionRate: null,
    });
  });
});
