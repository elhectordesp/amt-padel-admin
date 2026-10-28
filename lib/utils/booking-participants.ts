/**
 * Quién cuenta en una reserva. Su lista de participantes guarda también a
 * quien rechazó la invitación (DECLINED) y a quien salió o fue quitado
 * (REMOVED): ni juegan ni se les avisa.
 */

import type { Booking, BookingParticipant } from "@/types/bookings";

/** Los que siguen en la reserva: invitados pendientes, confirmados e invitados sin cuenta. */
export function activeParticipants(b: Pick<Booking, "participants">): BookingParticipant[] {
  return (b.participants ?? []).filter(
    (p) => p.status !== "DECLINED" && p.status !== "REMOVED",
  );
}

/** «1 jugador», «3 jugadores» (antes «1 jugadores»). */
export function playersLabel(n: number): string {
  return n === 1 ? "1 jugador" : `${n} jugadores`;
}

/** Cuántos juegan en la pista: 2 en una individual, 4 en una de dobles. */
export function bookingCapacity(b: Pick<Booking, "court">): number {
  return b.court?.type === "SINGLES" ? 2 : 4;
}

/**
 * A cuántos avisa el back al cancelar: los que siguen en la reserva y tienen
 * cuenta, menos quien cancela (`notifyCancellation` del back).
 */
export function cancellationNoticeCount(
  b: Pick<Booking, "participants">,
  cancellerUserId: string | undefined,
): number {
  return activeParticipants(b).filter(
    (p) => p.userId !== null && p.userId !== cancellerUserId,
  ).length;
}
