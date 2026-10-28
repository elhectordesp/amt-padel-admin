import { DEFAULT_TIME_ZONE, startOfZonedDay, zonedToDate } from "./time-zone";

/**
 * Qué falla en un cierre de inscripciones (`datetime-local`, hora de pared de
 * la zona del torneo) respecto al inicio del torneo (`YYYY-MM-DD`), o null.
 * La misma regla que el back: el cierre no puede pasar de las 00:00 del día
 * de inicio en la zona del torneo (antes se comparaba con la medianoche UTC y
 * se colaban las 00:00-02:00 de ese día en España). Al crear, además, tiene
 * que ser futuro; al editar no (un torneo ya pasado se tiene que poder
 * guardar). Una fecha que no se puede leer (p. ej. un año de 5 cifras, que el
 * campo deja escribir) es un error.
 */
export function registrationDeadlineIssue(
  deadline: string,
  startDate: string,
  {
    requireFuture = false,
    timeZone = DEFAULT_TIME_ZONE,
  }: { requireFuture?: boolean; timeZone?: string } = {},
): string | null {
  const at = zonedToDate(deadline, timeZone);
  if (!at) return "Fecha no válida";
  if (requireFuture && at <= new Date()) return "El cierre de inscripciones debe ser una fecha futura";
  const start = startDate ? startOfZonedDay(startDate, timeZone) : null;
  if (start && at > start) return "El cierre de inscripciones debe ser antes del inicio del torneo";
  return null;
}
