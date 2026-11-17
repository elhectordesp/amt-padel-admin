import type { ClubAmtPlan } from "@/types";
import { addDaysToKey, formatDayKey } from "@/lib/utils/time-zone";

const PLAN_LABEL: Record<ClubAmtPlan["bookingPlan"], string> = {
  FREE: "Gratuito",
  SUBSCRIPTION: "Cuota mensual",
  COMMISSION: "Comisión por reserva",
  CUSTOM: "Acuerdo especial",
};

export const planLabel = (plan: ClubAmtPlan["bookingPlan"]): string => PLAN_LABEL[plan];

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

/** Lo que paga el club: «49 €/mes», «5 % de comisión» o null si no hay importe. */
export function feeText(plan: ClubAmtPlan): string | null {
  if (plan.bookingPlan === "SUBSCRIPTION" && plan.bookingMonthlyFeeCents != null) {
    const euros = plan.bookingMonthlyFeeCents / 100;
    return `${euros.toLocaleString("es-ES", { maximumFractionDigits: 2 })} €/mes`;
  }
  if (plan.bookingPlan === "COMMISSION" && plan.bookingCommissionRate != null) {
    const pct = Math.round(plan.bookingCommissionRate * 10000) / 100;
    return `${pct.toLocaleString("es-ES", { maximumFractionDigits: 2 })} % de comisión`;
  }
  return null;
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
