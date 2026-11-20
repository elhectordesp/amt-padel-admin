/**
 * Lógica pura del cobro por partes de una reserva (módulo Cuentas): los códigos
 * de error del back con su mensaje, los puntos de color del calendario, qué
 * precio tiene elegido una parte y cuándo se avisa de que es un alumno.
 */
import type { BookingPart, BookingPartsView, PartPriceOption, UpdatePartPayload } from "@/lib/services/booking-parts";
import type { BookingPartsSummary } from "@/types/bookings";

/** Lo más que admite el back al repartir una reserva. */
export const PARTS_MIN_COUNT = 1;
export const PARTS_MAX_COUNT = 8;

/** Los códigos de error del módulo Cuentas, dichos en llano para el gestor. */
export const ACCOUNTS_ERROR_MESSAGES: Record<string, string> = {
  ACCOUNTS_DISABLED:         "El módulo Cuentas no está activado en este club. Pídeselo a AMT.",
  ACCOUNTS_IN_USE:           "Ya se ha usado en alguna reserva, así que no se puede borrar. Desactívalo y dejará de ofrecerse.",
  BOOKING_HAS_PARTS:         "Esta reserva se cobra por partes: cobra, deshaz o devuelve cada parte desde «Por jugadores».",
  BOOKING_PARTS_LOCKED:      "Alguna parte ya está cobrada, a deber o invitada. Deshazla primero para cambiar el reparto o el precio.",
  BOOKING_ALREADY_COLLECTED: "La reserva ya está cobrada entera. Márcala como no pagada si quieres cobrarla por jugadores.",
  BOOKING_PART_INVALID:      "Los datos de la parte no valen. Revisa el precio, el motivo y quién es.",
};

/** Los códigos cuyo mensaje del back lleva el motivo concreto (qué dato falla): ese mensaje se enseña tal cual. */
const BACK_MESSAGE_WINS = new Set(["BOOKING_PART_INVALID"]);

/** El mensaje de un error al cobrar o configurar: el del código si lo conocemos; si no, el que manda el back. */
export function accountsErrorText(err: unknown): string {
  const code = (err as { code?: unknown }).code;
  const message = (err as Error).message;
  if (typeof code !== "string" || !(code in ACCOUNTS_ERROR_MESSAGES)) return message;
  if (BACK_MESSAGE_WINS.has(code) && message) return message;
  return ACCOUNTS_ERROR_MESSAGES[code];
}

// ── Puntos de color del calendario ───────────────────────────────────────────

export type PartDotKey = "paid" | "debt" | "invited" | "pending";

/** Cada estado de una parte con su color y su texto de leyenda. */
export const PART_DOT_INFO: Record<PartDotKey, { legend: string; className: string }> = {
  paid:    { legend: "Parte cobrada",    className: "bg-green-500" },
  debt:    { legend: "Parte a deber",    className: "bg-orange-500" },
  invited: { legend: "Parte invitada",   className: "bg-violet-500" },
  pending: { legend: "Parte sin cobrar", className: "bg-red-500" },
};

const DOT_ORDER: PartDotKey[] = ["paid", "debt", "invited", "pending"];

/** Un punto por parte, agrupados por estado (cobradas primero, sin cobrar al final). */
export function partDots(summary: BookingPartsSummary): PartDotKey[] {
  return DOT_ORDER.flatMap((key) => Array<PartDotKey>(summary[key]).fill(key));
}

/** «2 cobradas, 1 debe, 1 sin cobrar» para quien no ve los colores. */
export function partsDescription(summary: BookingPartsSummary): string {
  const words: Record<PartDotKey, (n: number) => string> = {
    paid:    (n) => (n === 1 ? "1 cobrada" : `${n} cobradas`),
    debt:    (n) => `${n} ${n === 1 ? "debe" : "deben"}`,
    invited: (n) => (n === 1 ? "1 invitada" : `${n} invitadas`),
    pending: (n) => `${n} sin cobrar`,
  };
  return DOT_ORDER.filter((key) => summary[key] > 0).map((key) => words[key](summary[key])).join(", ");
}

// ── Precio de una parte ──────────────────────────────────────────────────────

/** Lo que vale elegir en el selector de precio de una parte. */
export const PRICE_NORMAL = "normal";
export const PRICE_MEMBER = "member";
export const PRICE_CUSTOM = "custom";
const PRICE_NAMED = "price:";

/** La opción de precio que tiene elegida la parte. */
export function priceChoiceOf(part: Pick<BookingPart, "kind" | "partPriceId">): string {
  if (part.kind === "MEMBER") return PRICE_MEMBER;
  if (part.kind === "CUSTOM") return PRICE_CUSTOM;
  if (part.kind === "SPECIAL" && part.partPriceId) return `${PRICE_NAMED}${part.partPriceId}`;
  return PRICE_NORMAL;
}

export const namedPriceChoice = (partPriceId: string) => `${PRICE_NAMED}${partPriceId}`;

/**
 * Lo que se manda al back al elegir una opción que no pide datos (todas menos
 * «Otro precio», que lleva importe y motivo): null si no vale.
 */
export function updateForChoice(choice: string): UpdatePartPayload | null {
  if (choice === PRICE_NORMAL) return { kind: "NORMAL" };
  if (choice === PRICE_MEMBER) return { kind: "MEMBER" };
  if (choice.startsWith(PRICE_NAMED)) return { kind: "SPECIAL", partPriceId: choice.slice(PRICE_NAMED.length) };
  return null;
}

/** El precio de alumno de la reserva (el club solo tiene uno activo), si hay franja para su hora. */
export function studentOption(view: Pick<BookingPartsView, "priceOptions">): PartPriceOption | null {
  return view.priceOptions.find((o) => o.kind === "STUDENT") ?? null;
}

/**
 * El precio de alumno que se propone en una parte: solo si la parte es de un
 * alumno, está sin cobrar (el precio ya no se cambia después) y todavía no lo
 * lleva puesto. El club lo aplica a mano con un toque.
 */
export function studentSuggestion(
  part: Pick<BookingPart, "isStudent" | "status" | "kind" | "partPriceId">,
  view: Pick<BookingPartsView, "priceOptions">,
): PartPriceOption | null {
  if (!part.isStudent || part.status !== "PENDING") return null;
  const option = studentOption(view);
  if (!option) return null;
  const alreadyApplied = part.kind === "SPECIAL" && part.partPriceId === option.partPriceId;
  return alreadyApplied ? null : option;
}

// ── Quién y cómo se cobró ────────────────────────────────────────────────────

/** El nombre de quien es la parte (cliente o nombre libre); null si aún no se sabe. */
export function partWho(part: Pick<BookingPart, "customerName" | "label">): string | null {
  return part.customerName ?? part.label;
}

/** Todas las partes están sin cobrar: se puede volver a cobrar la reserva entera. */
export function canCollectWhole(parts: Pick<BookingPart, "status">[]): boolean {
  return parts.every((p) => p.status === "PENDING");
}

/** El motivo de una devolución: de 3 a 200 caracteres (como en el back). */
export const REFUND_REASON_MIN = 3;
export const REFUND_REASON_MAX = 200;

/** Lo que aún se puede devolver de una parte cobrada. */
export function refundableOfPart(part: Pick<BookingPart, "status" | "priceCents" | "refundAmountCents">): number {
  return part.status === "PAID" ? Math.max(0, part.priceCents - (part.refundAmountCents ?? 0)) : 0;
}
