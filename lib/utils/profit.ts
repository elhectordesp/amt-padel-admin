import type { ProfitAvailable, ProfitMonth, ProfitPart } from "@/lib/services/profit";
import { formatCents } from "@/lib/utils/booking-price";
import { eurosToCents } from "@/lib/utils/payment-methods";
import { formatDayKey } from "@/lib/utils/time-zone";

/** Las partes de los socios activos suman 10.000 puntos básicos (100 %). */
export const SHARES_TOTAL_BPS = 10_000;

// ── Partes de los socios ─────────────────────────────────────────────────────

/** De puntos básicos al texto de un campo de porcentaje: 5000 → «50», 3333 → «33,33». */
export function bpsToPercentText(bps: number): string {
  const text = (bps / 100).toFixed(2).replace(/\.?0+$/, "");
  return text.replace(".", ",");
}

/** Del porcentaje escrito («33,33», «50», «12.5») a puntos básicos; null si no vale (0 a 100, hasta dos decimales). */
export function percentTextToBps(text: string): number | null {
  const clean = text.trim().replace(/\s/g, "").replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(clean)) return null;
  const bps = Math.round(Number(clean) * 100);
  return bps <= SHARES_TOTAL_BPS ? bps : null;
}

/** Por qué unas partes escritas no se pueden guardar; null si valen. */
export function sharesProblem(texts: string[]): string | null {
  const parsed = texts.map(percentTextToBps);
  if (parsed.some((v) => v === null)) return "Escribe un porcentaje válido en cada socio (de 0 a 100, por ejemplo 33,33)";
  const total = parsed.reduce<number>((t, v) => t + (v ?? 0), 0);
  if (total !== SHARES_TOTAL_BPS) return `Los porcentajes suman ${bpsToPercentText(total)} %: tienen que sumar 100 %`;
  return null;
}

/**
 * «A partes iguales» en puntos básicos: cada socio se lleva el cociente entero y los puntos que sobran
 * (mayor resto; con restos iguales, los primeros) van de uno en uno, así que siempre suman 10.000:
 * 3 socios → 3334, 3333, 3333.
 */
export function equalShares(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(SHARES_TOTAL_BPS / count);
  const extra = SHARES_TOTAL_BPS - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

// ── Meses y años ─────────────────────────────────────────────────────────────

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthKey = (text: string): boolean => MONTH_KEY.test(text);

/** «2026-12» → «2027-01». */
export function nextMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Desde qué mes se propone un juego nuevo de partes: el siguiente al último con repartos, o el actual. */
export const defaultSharesMonth = (lockedUntil: string | null, currentMonth: string): string =>
  lockedUntil ? nextMonth(lockedUntil) : currentMonth;

/** Por qué un mes de inicio de partes no vale; null si vale. */
export function sharesMonthProblem(fromMonth: string, lockedUntil: string | null): string | null {
  if (!isMonthKey(fromMonth)) return "Elige el mes desde el que valen las partes";
  if (lockedUntil !== null && fromMonth <= lockedUntil)
    return `Ya hay repartos hasta ${monthLabel(lockedUntil)}: las partes solo pueden empezar después`;
  return null;
}

/** «2026-11» → «noviembre de 2026». */
export function monthLabel(period: string): string {
  return formatDayKey(`${period}-01`, { month: "long", year: "numeric" });
}

/** Los años que se pueden mirar: del de inicio de la tesorería al actual, del más reciente al más antiguo. */
export function profitYears(startDate: string, today: string): string[] {
  const first = Number(startDate.slice(0, 4));
  const last = Number(today.slice(0, 4));
  const years: string[] = [];
  for (let y = last; y >= first; y--) years.push(String(y));
  return years;
}

// ── Lo que queda por repartir ────────────────────────────────────────────────

export const monthPending = (m: ProfitMonth): number => m.parts.reduce((t, p) => t + p.pendingCents, 0);
export const monthSuggested = (m: ProfitMonth): number => m.parts.reduce((t, p) => t + p.suggestedCents, 0);

/** Se puede repartir un mes acabado con algo pendiente. */
export const canShare = (m: ProfitMonth): boolean => m.ended && monthPending(m) > 0;

/** Los socios que salen en la tabla: los de los meses, sin repetir y en el orden en que llegan. */
export function monthPartners(months: ProfitMonth[]): { partnerId: string; name: string; active: boolean }[] {
  const seen = new Map<string, { name: string; active: boolean }>();
  for (const m of months) for (const p of m.parts) if (!seen.has(p.partnerId)) seen.set(p.partnerId, { name: p.name, active: p.active });
  return [...seen].map(([partnerId, who]) => ({ partnerId, ...who }));
}

/** El nombre de un socio con «de baja» si ya no está activo. */
export const partnerLabel = (p: { name: string; active: boolean }): string => (p.active ? p.name : `${p.name} (de baja)`);

/** Los importes sugeridos de un mes como texto de campo, por socio (vacío si no hay nada que sugerir). */
export function suggestedTexts(parts: ProfitPart[]): Record<string, string> {
  return Object.fromEntries(
    parts.map((p) => [p.partnerId, p.suggestedCents > 0 ? (p.suggestedCents / 100).toFixed(2).replace(".", ",") : ""]),
  );
}

export interface ShareLines {
  lines:      { partnerId: string; amountCents: number }[];
  totalCents: number;
  /** Por socio: lo que falla en lo que ha escrito. */
  errors:     Record<string, string>;
  /** Lo que falla en el conjunto; null si no falla nada. */
  problem:    string | null;
}

/** Los importes escritos de un reparto: cada uno ≤ lo pendiente de su socio y la suma ≤ el disponible. */
export function buildShareLines(parts: ProfitPart[], texts: Record<string, string>, availableCents: number): ShareLines {
  const lines: ShareLines["lines"] = [];
  const errors: Record<string, string> = {};
  for (const p of parts) {
    const text = (texts[p.partnerId] ?? "").trim();
    if (text === "") continue;
    const cents = eurosToCents(text);
    if (cents === null) errors[p.partnerId] = "Escribe un importe válido (por ejemplo 120,00)";
    else if (cents > p.pendingCents) errors[p.partnerId] = `No puede pasar de lo pendiente (${formatCents(p.pendingCents)})`;
    else if (cents > 0) lines.push({ partnerId: p.partnerId, amountCents: cents });
  }
  const totalCents = lines.reduce((t, l) => t + l.amountCents, 0);
  let problem: string | null = null;
  if (Object.keys(errors).length === 0) {
    if (lines.length === 0) problem = "Escribe el importe de al menos un socio";
    else if (totalCents > availableCents) problem = `Solo hay ${formatCents(Math.max(0, availableCents))} disponibles para repartir`;
  }
  return { lines, totalCents, errors, problem };
}

// ── Disponible ───────────────────────────────────────────────────────────────

export interface AvailableRow {
  key:    string;
  label:  string;
  /** Con su signo: lo que suma o resta al disponible. */
  cents:  number;
  hint?:  string;
}

/** De dónde sale cada suma y cada resta del dinero disponible, en el orden en que el back las aplica. */
export function availableRows(a: ProfitAvailable): AvailableRow[] {
  return [
    { key: "cash",  label: "Caja", cents: a.cashCents },
    { key: "bank",  label: "Banco", cents: a.bankCents },
    { key: "held",  label: "Lo que guardan los socios", cents: a.heldCents },
    { key: "accts", label: "Cuentas de los socios con el club", cents: a.partnerAccountsCents,
      hint: "Si el club les debe dinero, resta; si ellos tienen dinero del club, suma." },
    { key: "coach", label: "Debido a entrenadores", cents: -a.coachesOwedCents },
    { key: "unpaid", label: "Gastos sin pagar", cents: -a.unpaidExpensesCents },
    { key: "fund",  label: "Fondo (no se reparte)", cents: -a.fundCents },
    { key: "reserve", label: "Colchón", cents: -a.reserveCents, hint: "Lo que el club quiere tener siempre. Se cambia en Ajustes." },
  ];
}
