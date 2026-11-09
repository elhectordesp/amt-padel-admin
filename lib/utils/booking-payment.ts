/**
 * El pago de una reserva en su detalle. A los 6 años del cobro el back borra
 * sus datos de cobro (RGPD, lo que dice /privacidad): el método llega vacío
 * (null) y no consta.
 */
import type { BookingPaymentMethod } from "@/types/bookings";

const PAYMENT_LABELS: Record<BookingPaymentMethod, string> = {
  PENDING: "Pendiente",
  CASH_AT_VENUE: "En el club (efectivo o tarjeta)",
  ONLINE: "Online",
  PAID_MANUAL: "Transferencia u otro",
};

// Los dos con los que el club cobra a mano (el enum del back no cambia).
// Al crear: la reserva de pago pendiente nace cobrada con uno de ellos
export const CLUB_PAYMENT_METHODS = ["CASH_AT_VENUE", "PAID_MANUAL"] as const;
export type ClubPaymentMethod = (typeof CLUB_PAYMENT_METHODS)[number];

/** Cómo se cobró, para leer; sin método, que no consta (antes salía «()»). */
export function paymentMethodLabel(method: BookingPaymentMethod | null): string {
  return method ? PAYMENT_LABELS[method] : "sin datos de cobro";
}

/**
 * Qué puede hacer el club con el pago: marcarla pagada si está pendiente o
 * como no pagada si consta un cobro. Sin método, nada: sus datos de cobro se
 * borraron y marcarla los volvería a crear.
 */
export function paymentAction(
  method: BookingPaymentMethod | null,
): "markPaid" | "markUnpaid" | null {
  if (method === null) return null;
  return method === "PENDING" ? "markPaid" : "markUnpaid";
}
