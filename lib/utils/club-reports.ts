import type { Download, IncomeSource, ReportPeriod, SummarySeriesPoint } from "@/lib/services/club-reports";
import { addDaysToKey } from "@/lib/utils/time-zone";
import { formatCents } from "@/lib/utils/booking-price";

/** Cómo se dicen en el panel las cosas del resumen de cuentas (F8, C4). */

export const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "week",    label: "Semana" },
  { value: "month",   label: "Mes" },
  { value: "quarter", label: "Trimestre" },
  { value: "year",    label: "Año" },
];

export const INCOME_SOURCE_LABEL: Record<IncomeSource, string> = {
  BOOKINGS:        "Reservas",
  REGISTRATIONS:   "Inscripciones de torneos",
  VOUCHERS_COURT:  "Bonos de pista",
  VOUCHERS_CLASS:  "Bonos de clases",
  FEES_ACADEMY:    "Cuotas de la academia",
  FEES_TEAMS:      "Cuotas de equipos",
  PRIVATE_CLASSES: "Clases privadas",
  SHOP:            "Tienda",
  OTHER_DEBTS:     "Otras deudas cobradas",
  LEDGER:          "Ingresos apuntados a mano",
};

export const METHOD_LABEL: Record<string, string> = {
  CASH:           "Efectivo",
  CARD:           "Tarjeta",
  BIZUM:          "Bizum",
  TRANSFER:       "Transferencia",
  OTHER:          "Otro",
  VOUCHER:        "Con bono",
  CASH_AT_VENUE:  "Efectivo en el club",
  PAID_MANUAL:    "Marcado como pagado",
  MIXED:          "Varios métodos",
};

/** Un día del calendario, «AAAA-MM-DD». */
const MONTH_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Un día en el periodo `delta` periodos antes (negativo) o después del que contiene `date`. */
export function shiftPeriodDate(period: ReportPeriod, date: string, delta: number): string {
  if (period === "week") return addDaysToKey(date, 7 * delta);
  const m = MONTH_RE.exec(date);
  if (!m) return date;
  const months = period === "month" ? delta : period === "quarter" ? 3 * delta : 12 * delta;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1 + months, 1));
  return d.toISOString().slice(0, 10);
}

/** ¿El periodo siguiente al de `date` ya ha empezado `today`? Si no, la flecha «siguiente» se apaga. */
export function hasNextPeriod(period: ReportPeriod, date: string, today: string): boolean {
  const next = shiftPeriodDate(period, date, 1);
  if (period === "week") {
    // El lunes de la semana siguiente
    const m = MONTH_RE.exec(next);
    if (!m) return false;
    const weekday = (new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() + 6) % 7;
    return addDaysToKey(next, -weekday) <= today;
  }
  const first = next.slice(0, 8) + "01";
  // Trimestre y año: el primer día del periodo que contiene `next`
  const month = +next.slice(5, 7);
  const start =
    period === "month" ? first
    : period === "quarter" ? `${next.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`
    : `${next.slice(0, 4)}-01-01`;
  return start <= today;
}

/** «25,3 %»; «—» si no hay margen (sin ingresos). */
export function formatMargin(marginPct: number | null): string {
  if (marginPct === null) return "—";
  return `${(Math.round(marginPct * 1000) / 10).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** El texto que lee un lector de pantalla del gráfico de barras. */
export function seriesDescription(series: SummarySeriesPoint[]): string {
  return series
    .map((p) => `${p.label}: ingresos ${formatCents(p.incomeCents)}, gastos ${formatCents(p.expenseCents)}`)
    .join(". ");
}

/** Guarda un fichero descargado: lo ofrece al navegador como una descarga. */
export function saveDownload({ blob, fileName }: Download): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
