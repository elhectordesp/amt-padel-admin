import type { ClubNotice } from "@/lib/services/club-notices";

/** La pantalla a la que lleva un aviso: la reserva o el torneo; null si no dice ninguna. */
export function noticeHref(notice: Pick<ClubNotice, "data">): string | null {
  const data = notice.data;
  if (!data) return null;
  if (typeof data.bookingId === "string" && data.bookingId) return `/mi-club/reservas/bookings/${data.bookingId}`;
  if (typeof data.tournamentId === "string" && data.tournamentId) return `/torneos/${data.tournamentId}`;
  return null;
}

/** «hace 5 min», «hace 3 h», «hace 2 días»; «ahora» si es de hace menos de un minuto. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}
