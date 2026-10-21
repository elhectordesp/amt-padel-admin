import type { TournamentStatus } from "@/types";

/**
 * Los torneos activos: los mismos estados que cuenta la tarjeta «Torneos
 * activos» del back (sin borradores, finalizados ni cancelados).
 */
const ACTIVE: readonly TournamentStatus[] = ["ONGOING", "OPEN", "DRAW", "SCHEDULED"];

/**
 * La lista «Torneos activos y próximos» del dashboard: primero los que están
 * en curso y luego los próximos, cada grupo por fecha de inicio (el más
 * cercano antes), sin borradores. Antes cogía los `limit` primeros sin
 * terminar en el orden del listado, borradores incluidos, y el torneo en
 * curso podía quedarse fuera.
 */
export function activeAndUpcomingTournaments<
  T extends { status?: string | null; startDate: string },
>(tournaments: T[], limit = 5): T[] {
  const statusOf = (t: T) => (t.status ?? "").toUpperCase() as TournamentStatus;
  const start = (t: T) => new Date(t.startDate).getTime() || 0;
  return tournaments
    .filter((t) => ACTIVE.includes(statusOf(t)))
    .sort((a, b) => {
      const ongoing = Number(statusOf(b) === "ONGOING") - Number(statusOf(a) === "ONGOING");
      return ongoing || start(a) - start(b);
    })
    .slice(0, limit);
}
