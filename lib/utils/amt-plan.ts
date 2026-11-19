import { z } from "zod";
import type { ClubAmtPlan, ClubAmtPlanInternal, UpdateClubAmtPlanPayload } from "@/types";
import { addDaysToKey, formatDayKey } from "@/lib/utils/time-zone";

const PLAN_LABEL: Record<ClubAmtPlan["bookingPlan"], string> = {
  FREE: "Gratuito",
  SUBSCRIPTION: "Cuota mensual",
  COMMISSION: "Comisión por reserva",
  CUSTOM: "Acuerdo especial",
};

export const planLabel = (plan: ClubAmtPlan["bookingPlan"]): string => PLAN_LABEL[plan];

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

/**
 * Lo que paga el club: «49 €/mes», «5 % de comisión», las dos con «·» en un
 * acuerdo especial que lleve cuota y comisión, o null si no hay importe.
 */
export function feeText(plan: ClubAmtPlan): string | null {
  const parts: string[] = [];
  const hasFee = plan.bookingPlan === "SUBSCRIPTION" || plan.bookingPlan === "CUSTOM";
  const hasRate = plan.bookingPlan === "COMMISSION" || plan.bookingPlan === "CUSTOM";
  if (hasFee && plan.bookingMonthlyFeeCents != null) {
    const euros = plan.bookingMonthlyFeeCents / 100;
    parts.push(`${euros.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €/mes`);
  }
  if (hasRate && plan.bookingCommissionRate != null) {
    const pct = Math.round(plan.bookingCommissionRate * 10000) / 100;
    parts.push(`${pct.toLocaleString("es-ES", { maximumFractionDigits: 2 })} % de comisión`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** «15 de noviembre de 2026» para un día «YYYY-MM-DD». */
export const paidUntilText = (day: string | null): string | null =>
  day ? formatDayKey(day, DATE_FORMAT) : null;

/** El aviso de cuota vencida (null si no hay nada que avisar). Vence el día siguiente al pagado. */
export function overdueNotice(plan: ClubAmtPlan | undefined): string | null {
  if (!plan?.overdue) return null;
  const since = plan.feePaidUntil ? paidUntilText(addDaysToKey(plan.feePaidUntil, 1)) : null;
  return `Cuota pendiente${since ? ` desde ${since}` : ""}. Escríbenos a info@amtpadel.com`;
}

// ── Formulario «Plan de AMT» (solo AMT) ──────────────────────────────────────
// El back guarda la cuota en céntimos y la comisión como tasa de 0 a 1 con 4
// decimales; el formulario enseña euros y porcentaje. Los dos pasos se hacen
// con enteros (nunca con ×100 o ÷100 de decimales, que dan 7,000000000000001).

/** Las mismas cotas que el back (CLUB_AMT_PLAN_*): si cambian allí, aquí también. */
export const AMT_PLAN_NOTES_MAX_LENGTH = 1000;
export const AMT_PLAN_MAX_FEE_CENTS = 1_000_000;
/** 100 % = 10.000 puntos básicos (la tasa tiene 4 decimales). */
const MAX_BASIS_POINTS = 10_000;

type BookingPlan = ClubAmtPlan["bookingPlan"];

/** Planes con cuota mensual (obligatoria en SUBSCRIPTION, opcional en CUSTOM). */
export const planUsesFee = (plan: BookingPlan): boolean => plan === "SUBSCRIPTION" || plan === "CUSTOM";
/** Planes con comisión (obligatoria en COMMISSION, opcional en CUSTOM). */
export const planUsesCommission = (plan: BookingPlan): boolean => plan === "COMMISSION" || plan === "CUSTOM";

const TWO_DECIMALS = /^(\d+)(?:[.,](\d{1,2}))?$/;

/** «49,5» o «49.5» → 4950 (centésimas, en entero); null si no es un número con hasta 2 decimales. */
function parseHundredths(text: string): number | null {
  const m = TWO_DECIMALS.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** 4950 → «49,5»; 4900 → «49»; 4905 → «49,05». */
function formatHundredths(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  if (frac === 0) return String(whole);
  return `${whole},${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/** Céntimos → texto de euros para el campo (4950 → «49,5»). */
export const centsToEurosText = (cents: number): string => formatHundredths(cents);

/** Texto de euros → céntimos; null si no es un importe válido. */
export const eurosTextToCents = (text: string): number | null => parseHundredths(text);

/** Tasa de 0 a 1 → texto de porcentaje para el campo (0,055 → «5,5»). */
export const rateToPercentText = (rate: number): string => formatHundredths(Math.round(rate * MAX_BASIS_POINTS));

/** Texto de porcentaje → tasa de 0 a 1 (5,5 → 0,055); null si no es un porcentaje válido. */
export function percentTextToRate(text: string): number | null {
  const basisPoints = parseHundredths(text);
  return basisPoints === null ? null : basisPoints / MAX_BASIS_POINTS;
}

/** Lo que teclea AMT: importes y porcentaje como texto, tal cual los ve. */
export interface AmtPlanFormValues {
  bookingPlan: BookingPlan;
  fee: string;
  commission: string;
  notes: string;
}

/** Lo guardado, en los valores del formulario. */
export function amtPlanFormValues(plan: ClubAmtPlanInternal): AmtPlanFormValues {
  return {
    bookingPlan: plan.bookingPlan,
    fee: plan.bookingMonthlyFeeCents != null ? centsToEurosText(plan.bookingMonthlyFeeCents) : "",
    commission: plan.bookingCommissionRate != null ? rateToPercentText(plan.bookingCommissionRate) : "",
    notes: plan.bookingBillingNotes ?? "",
  };
}

/** Las reglas del back en el formulario: lo que no cuadra se ve antes de enviar. */
export const amtPlanFormSchema = z
  .object({
    bookingPlan: z.enum(["FREE", "SUBSCRIPTION", "COMMISSION", "CUSTOM"]),
    fee: z.string(),
    commission: z.string(),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    if (planUsesFee(v.bookingPlan)) {
      const text = v.fee.trim();
      if (text === "") {
        if (v.bookingPlan === "SUBSCRIPTION") {
          ctx.addIssue({ code: "custom", path: ["fee"], message: "La cuota mensual es obligatoria" });
        }
      } else {
        const cents = eurosTextToCents(text);
        if (cents === null) {
          ctx.addIssue({ code: "custom", path: ["fee"], message: "Escribe un importe en euros, con hasta 2 decimales" });
        } else if (cents <= 0) {
          ctx.addIssue({ code: "custom", path: ["fee"], message: "La cuota debe ser mayor que 0" });
        } else if (cents > AMT_PLAN_MAX_FEE_CENTS) {
          ctx.addIssue({ code: "custom", path: ["fee"], message: `La cuota no puede pasar de ${AMT_PLAN_MAX_FEE_CENTS / 100} €` });
        }
      }
    }
    if (planUsesCommission(v.bookingPlan)) {
      const text = v.commission.trim();
      if (text === "") {
        if (v.bookingPlan === "COMMISSION") {
          ctx.addIssue({ code: "custom", path: ["commission"], message: "La comisión es obligatoria" });
        }
      } else {
        const rate = percentTextToRate(text);
        if (rate === null) {
          ctx.addIssue({ code: "custom", path: ["commission"], message: "Escribe un porcentaje, con hasta 2 decimales" });
        } else if (rate <= 0) {
          ctx.addIssue({ code: "custom", path: ["commission"], message: "La comisión debe ser mayor que 0" });
        } else if (rate > 1) {
          ctx.addIssue({ code: "custom", path: ["commission"], message: "La comisión no puede pasar del 100 %" });
        }
      }
    }
    if (v.notes.trim().length > AMT_PLAN_NOTES_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", path: ["notes"], message: `Las notas no pueden pasar de ${AMT_PLAN_NOTES_MAX_LENGTH} caracteres` });
    }
  });

/**
 * Lo que se envía, de un formulario que ya pasó `amtPlanFormSchema`. Lo que el
 * plan no lleva va a null aunque el campo tenga algo (se cambió de plan): el
 * back rechaza una cuota en un plan por comisión, y una cuota vieja no debe
 * colarse.
 */
export function toAmtPlanPayload(v: AmtPlanFormValues): UpdateClubAmtPlanPayload {
  const fee = planUsesFee(v.bookingPlan) && v.fee.trim() !== "" ? eurosTextToCents(v.fee) : null;
  const rate = planUsesCommission(v.bookingPlan) && v.commission.trim() !== "" ? percentTextToRate(v.commission) : null;
  return {
    bookingPlan: v.bookingPlan,
    bookingMonthlyFeeCents: fee,
    bookingCommissionRate: rate,
    bookingBillingNotes: v.notes.trim() || null,
  };
}
