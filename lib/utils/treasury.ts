import type {
  MoneyPlace, PlaceInput, PlaceRef, StatementRow, StatementSource,
} from "@/lib/services/treasury";
import { formatCents } from "@/lib/utils/booking-price";
import { addDaysToKey } from "@/lib/utils/time-zone";

/** Tope de un importe de tesorería (como en el back): 100.000 €. */
export const TREASURY_MAX_CENTS = 10_000_000;
/** Un extracto cubre como mucho 93 días. */
export const STATEMENT_MAX_DAYS = 93;
/** Cuántas filas enseñan de entrada las listas de traspasos y cuadres. */
export const LIST_PREVIEW = 8;
export const NOTE_MAX = 200;

// ── Lugares ──────────────────────────────────────────────────────────────────

/** Una clave para elegir un lugar en un desplegable: «CASH» o «PARTNER_HELD:id». */
export function placeKey(ref: { place: MoneyPlace; partnerId?: string | null }): string {
  return ref.partnerId ? `${ref.place}:${ref.partnerId}` : ref.place;
}

export function parsePlaceKey(key: string): PlaceInput {
  const [place, partnerId] = key.split(":");
  return partnerId ? { place: place as MoneyPlace, partnerId } : { place: place as MoneyPlace };
}

export const isPartnerPlace = (place: MoneyPlace): boolean => place === "PARTNER_HELD" || place === "PARTNER_ACCOUNT";

/** El banco y la cuenta de un socio pueden cuadrar en negativo; la caja y lo guardado, no. */
export const allowsNegativeCount = (place: MoneyPlace): boolean => place === "BANK" || place === "PARTNER_ACCOUNT";

/** Los lugares en los que se puede apuntar algo nuevo: los de los socios dados de baja se quedan fuera. */
export function writablePlaces<T extends PlaceRef>(places: T[], activePartners: ReadonlySet<string>): T[] {
  return places.filter((p) => p.partnerId === null || activePartners.has(p.partnerId));
}

// ── Frases ───────────────────────────────────────────────────────────────────

/** La cuenta de un socio con el club, sin enseñar nunca el signo: lo dice con palabras. */
export function partnerAccountText(accountCents: number): string {
  if (accountCents > 0) return `Tiene ${formatCents(accountCents)} del club`;
  if (accountCents < 0) return `El club le debe ${formatCents(-accountCents)}`;
  return "Está a cero con el club";
}

/** Una cantidad con su signo para el extracto y las diferencias: «+12,50 €», «−3,00 €», «0,00 €». */
export function signedCents(cents: number): string {
  if (cents === 0) return formatCents(0);
  return `${cents > 0 ? "+" : "−"}${formatCents(Math.abs(cents))}`;
}

/** De lo escrito («12,5», «-3», «−3,00») a céntimos con signo; null si no es un importe. */
export function parseSignedCents(text: string): number | null {
  const clean = text.trim().replace(/\s/g, "").replace(",", ".");
  const m = /^([-−])?(\d+(?:\.\d{1,2})?)$/.exec(clean);
  if (!m) return null;
  const cents = Math.round(Number(m[2]) * 100);
  return m[1] ? -cents : cents;
}

// ── Atajos de «Mover dinero» ─────────────────────────────────────────────────

export type ShortcutId =
  | "cash_to_bank" | "partner_keeps" | "partner_returns" | "partner_puts" | "partner_takes" | "bizum_to_bank" | "other";

export interface Shortcut {
  id:           ShortcutId;
  label:        string;
  /** Una línea que lo explica en el diálogo. */
  hint:         string;
  needsPartner: boolean;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "cash_to_bank",    label: "Llevar la caja al banco",   needsPartner: false,
    hint: "El efectivo de la caja se ingresa en el banco." },
  { id: "partner_keeps",   label: "Un socio guarda efectivo",  needsPartner: true,
    hint: "El socio se lleva efectivo de la caja para guardarlo: sigue siendo del club." },
  { id: "partner_returns", label: "Un socio devuelve lo guardado", needsPartner: true,
    hint: "El socio vuelve a dejar en la caja el efectivo que guardaba." },
  { id: "partner_puts",    label: "Un socio pone dinero",      needsPartner: true,
    hint: "El socio pone dinero suyo en el club: el club se lo debe." },
  { id: "partner_takes",   label: "Un socio se lleva dinero",  needsPartner: true,
    hint: "El socio saca dinero del club para él: es un adelanto, o devuelve lo que se le debía. Un reparto del beneficio se apunta en «Repartir»." },
  { id: "bizum_to_bank",   label: "Pasar al banco el Bizum de un socio", needsPartner: true,
    hint: "Un Bizum llegó al móvil del socio y él lo pasa a la cuenta del club." },
  { id: "other",           label: "Otro",                      needsPartner: false,
    hint: "Elige tú de dónde sale y adónde va." },
];

/**
 * De dónde a dónde va el dinero en cada atajo. El socio pone o se lleva dinero
 * de la caja por defecto (se puede cambiar a mano en «De» y «A»).
 */
export function applyShortcut(id: ShortcutId, partnerId: string): { from: PlaceInput; to: PlaceInput } | null {
  const partner = partnerId || undefined;
  switch (id) {
    case "cash_to_bank":    return { from: { place: "CASH" }, to: { place: "BANK" } };
    case "partner_keeps":   return { from: { place: "CASH" }, to: { place: "PARTNER_HELD", partnerId: partner } };
    case "partner_returns": return { from: { place: "PARTNER_HELD", partnerId: partner }, to: { place: "CASH" } };
    case "partner_puts":    return { from: { place: "PARTNER_ACCOUNT", partnerId: partner }, to: { place: "CASH" } };
    case "partner_takes":   return { from: { place: "CASH" }, to: { place: "PARTNER_ACCOUNT", partnerId: partner } };
    case "bizum_to_bank":   return { from: { place: "PARTNER_ACCOUNT", partnerId: partner }, to: { place: "BANK" } };
    case "other":           return null;
  }
}

/** Por qué un traspaso no se puede guardar todavía; null si está bien. */
export function transferProblem(from: PlaceInput, to: PlaceInput): string | null {
  if (isPartnerPlace(from.place) !== !!from.partnerId || isPartnerPlace(to.place) !== !!to.partnerId)
    return "Elige el socio";
  if (from.place === to.place && (from.partnerId ?? null) === (to.partnerId ?? null))
    return "El origen y el destino no pueden ser el mismo";
  return null;
}

// ── Cuadre ───────────────────────────────────────────────────────────────────

export type CountUpTo = "today" | "yesterday";

export function countDay(upTo: CountUpTo, today: string): string {
  return upTo === "today" ? today : addDaysToKey(today, -1);
}

/** Lo calculado, lo contado y la diferencia, dichos con palabras. */
export function countDiffText(computedCents: number, countedCents: number): { diffCents: number; text: string } {
  const diffCents = countedCents - computedCents;
  if (diffCents === 0) return { diffCents, text: "Coincide: no hay diferencia." };
  return {
    diffCents,
    text: diffCents > 0
      ? `Hay ${formatCents(diffCents)} más de lo calculado.`
      : `Faltan ${formatCents(-diffCents)} respecto a lo calculado.`,
  };
}

/** Cuánto vale un lugar un día anterior al inicio sin extracto que lo diga: lo cuadrado ese día o 0. */
export function beforeStartBalance(lastCount: { upTo: string; countedCents: number } | null, day: string): number {
  return lastCount && lastCount.upTo === day ? lastCount.countedCents : 0;
}

// ── Extracto ─────────────────────────────────────────────────────────────────

/** Días entre dos «AAAA-MM-DD», ambos incluidos. */
export function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/** El rango de un extracto al abrirlo: los últimos 30 días, sin pasar del inicio de la tesorería. */
export function defaultStatementRange(today: string, startDate: string): { from: string; to: string } {
  const from = addDaysToKey(today, -29);
  return { from: from > startDate ? from : startDate, to: today };
}

/** Por qué un rango de extracto no vale; null si vale. */
export function statementRangeProblem(from: string, to: string, startDate: string, today: string): string | null {
  if (!from || !to) return "Elige los dos días";
  if (from > to) return "El extracto acaba antes de empezar";
  if (from < startDate) return "La tesorería empieza el " + startDate.split("-").reverse().join("/");
  if (to > today) return "No hay extracto de días futuros";
  if (daysInclusive(from, to) > STATEMENT_MAX_DAYS) return `Un extracto cubre como mucho ${STATEMENT_MAX_DAYS} días`;
  return null;
}

/** Las filas del extracto con el saldo que queda tras cada una (la fila COUNT ya trae lo que corrige). */
export function withRunningBalance(openingCents: number, rows: StatementRow[]): (StatementRow & { balanceCents: number })[] {
  let running = openingCents;
  return rows.map((r) => {
    running += r.amountCents;
    return { ...r, balanceCents: running };
  });
}

const SOURCE_LABEL: Record<StatementSource, string> = {
  BOOKING:       "Reserva",
  BOOKING_PART:  "Reserva",
  REGISTRATION:  "Inscripción",
  VOUCHER:       "Bono",
  SCHOOL_FEE:    "Escuela",
  PRIVATE_CLASS: "Clase particular",
  CLUB_DEBT:     "Deuda cobrada",
  SALE:          "Tienda",
  LEDGER:        "Apunte",
  PURCHASE:      "Compra de tienda",
  CARD_FEE:      "Comisión",
  CLOSURE:       "Cierre de caja",
  TRANSFER:      "Traspaso",
  PROFIT_SHARE:  "Reparto",
  COUNT:         "Cuadre",
};

export const sourceLabel = (source: StatementSource): string => SOURCE_LABEL[source] ?? source;
