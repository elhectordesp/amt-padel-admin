import type { TournamentStatus } from "@/types";
import { localDayKey } from "@/lib/utils/date-keys";

/**
 * Los estados de un torneo activo: los mismos que cuenta la tarjeta «Torneos
 * activos» del back (sin borradores, finalizados ni cancelados).
 */
export const ACTIVE_TOURNAMENT_STATUSES: readonly TournamentStatus[] = ["ONGOING", "OPEN", "DRAW", "SCHEDULED"];

/** Si el estado (en mayúsculas o minúsculas) es de un torneo activo. */
export function isActiveTournamentStatus(status: string | null | undefined): boolean {
  return (ACTIVE_TOURNAMENT_STATUSES as readonly string[]).includes((status ?? "").toUpperCase());
}

/** El día de inicio (YYYY-MM-DD; las fechas del torneo se guardan como día UTC), o "" si no es válido. */
function startDay(startDate: string): string {
  const d = new Date(startDate);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * La lista «Torneos activos y próximos» del dashboard: primero los que están
 * en curso y luego los próximos, cada grupo por fecha de inicio (el más
 * cercano antes), sin borradores. Un torneo abierto, en sorteo o programado
 * cuya fecha de inicio ya pasó no es «próximo» (nada lo pasa a «en curso»
 * solo) y taparía a los que sí lo son: fuera. Antes cogía los `limit`
 * primeros sin terminar en el orden del listado, borradores incluidos, y el
 * torneo en curso podía quedarse fuera.
 */
export function activeAndUpcomingTournaments<
  T extends { status?: string | null; startDate: string },
>(tournaments: T[], limit = 5, now = new Date()): T[] {
  const today = localDayKey(now);
  const ongoing = (t: T) => (t.status ?? "").toUpperCase() === "ONGOING";
  const start = (t: T) => new Date(t.startDate).getTime() || 0;
  return tournaments
    .filter((t) => isActiveTournamentStatus(t.status))
    .filter((t) => ongoing(t) || !(startDay(t.startDate) && startDay(t.startDate) < today))
    .sort((a, b) => Number(ongoing(b)) - Number(ongoing(a)) || start(a) - start(b))
    .slice(0, limit);
}
