/**
 * Devolución de una reserva cobrada al cancelarla: lo que el club cobró en
 * dinero, que es lo más que puede devolver (el back lo comprueba igual).
 */
import type { Booking } from "@/types/bookings";

/**
 * Lo cobrado en dinero (céntimos), o null si no hay un cobro: pendiente de
 * pago, sin método (datos de cobro ya borrados) o sin fecha de cobro. Una
 * reserva pagada con una sesión de bono no movió dinero: cobrado 0. Sin
 * importe apuntado (reservas antiguas), su precio.
 */
export function collectedCents(
  b: Pick<Booking, "paymentMethod" | "paidAt" | "paidAmountCents" | "priceCents">,
): number | null {
  if (!b.paymentMethod || b.paymentMethod === "PENDING" || !b.paidAt) return null;
  if (b.paymentMethod === "VOUCHER") return 0;
  return b.paidAmountCents ?? b.priceCents;
}

/** De varias reservas, las cobradas en dinero (más de 0 €) y lo que suman: lo que «Devolver lo cobrado» devolvería. */
export function refundableOf(
  bookings: Pick<Booking, "paymentMethod" | "paidAt" | "paidAmountCents" | "priceCents">[],
): { count: number; cents: number } {
  let count = 0;
  let cents = 0;
  for (const b of bookings) {
    const collected = collectedCents(b) ?? 0;
    if (collected <= 0) continue;
    count += 1;
    cents += collected;
  }
  return { count, cents };
}
