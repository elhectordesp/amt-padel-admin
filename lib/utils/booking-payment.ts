/**
 * El pago de una reserva en su detalle. A los 6 años del cobro el back borra
 * sus datos de cobro (RGPD, lo que dice /privacidad): el método llega vacío
 * (null) y no consta.
 */
import type { BookingPaymentMethod } from "@/types/bookings";
import { methodLabel } from "@/lib/utils/payment-methods";

/**
 * Cómo se cobró, para leer; sin método, que no consta (antes salía «()»).
 * Los métodos son los del catálogo único (lib/utils/payment-methods.ts); las
 * reservas antiguas pueden llevar «En el club» o «Pagada».
 */
export function paymentMethodLabel(method: BookingPaymentMethod | null): string {
  return method ? methodLabel(method) : "sin datos de cobro";
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
