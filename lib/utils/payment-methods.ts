/**
 * Catálogo único de métodos de cobro del club: el mismo en las reservas y en
 * las inscripciones de torneo (el back solo acepta estos nombres). El panel
 * ofrece los cinco con los que el club cobra en mano; «Online» solo se lee.
 */

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH",     label: "Efectivo" },
  { value: "CARD",     label: "Tarjeta" },
  { value: "BIZUM",    label: "Bizum" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "OTHER",    label: "Otro" },
] as const;

export type CounterPaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number]["value"];

const LABELS: Record<string, string> = {
  ...Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((o) => [o.value, o.label])),
  ONLINE:        "Online",
  PENDING:       "Pendiente",
  // Reserva pagada con una sesión de un bono (no es un método de cobro: solo se lee)
  VOUCHER:       "Bono",
  // Reserva cobrada por partes con más de un método (módulo Cuentas)
  MIXED:         "Varios",
  // Solo filas antiguas de reservas (no se sabe si fue efectivo o tarjeta)
  CASH_AT_VENUE: "En el club",
  PAID_MANUAL:   "Pagada",
};

/** El nombre de un método para leer; sin método, que no consta. */
export function methodLabel(method: string | null | undefined): string {
  if (!method) return "Sin método";
  return LABELS[method] ?? method;
}

/** De euros escritos («12», «12,5», «12.50») a céntimos; null si no es un importe válido. */
export function eurosToCents(text: string): number | null {
  const clean = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** De céntimos a euros para un campo de texto: «12,50». */
export function centsToEurosInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** La mitad del precio de la pareja (euros enteros de la categoría), en céntimos: lo que paga un jugador. */
export function playerShareCents(categoryPriceEuros: number): number {
  return Math.round((categoryPriceEuros * 100) / 2);
}
