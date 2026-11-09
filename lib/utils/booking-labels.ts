/**
 * Cómo se llaman las reservas en el panel, igual en el calendario, el listado
 * y la ficha: modo, titular y si se debe dinero.
 */
import type { Booking, BookingMatchMode } from "@/types/bookings";

export const MODE_LABELS: Record<BookingMatchMode, string> = {
  INDIVIDUAL: "Individual",
  PRIVATE_AMT: "Privada",
  PRIVATE_WITH_GUESTS: "Privada con invitados",
  OPEN: "Abierta",
  ADMIN_MANUAL: "Reservada en mostrador",
};

/**
 * Quién la ha reservado, para el personal del club: el cliente del club si la
 * reserva lo tiene; si no, el contacto de una reserva de mostrador (invitado
 * sin cuenta) y, si tampoco, quien la apuntó. null si el back no lo manda.
 */
export function bookingHolder(b: Booking): string | null {
  if (b.clubCustomer?.name) return b.clubCustomer.name;
  if (b.matchMode === "ADMIN_MANUAL") {
    const contact = b.participants?.find((p) => !p.userId && p.guestName)?.guestName;
    if (contact) return contact;
  }
  return b.creator?.name ?? null;
}

/** Se debe: sin cobrar, con importe y no cancelada (como el filtro «Sin pagar» del back). */
export function isUnpaid(b: Pick<Booking, "paymentMethod" | "priceCents" | "status">): boolean {
  return b.paymentMethod === "PENDING" && b.priceCents > 0 && b.status !== "CANCELLED";
}
