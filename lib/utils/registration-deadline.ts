/**
 * Qué falla en un cierre de inscripciones (`datetime-local`, hora local)
 * respecto al inicio del torneo (`YYYY-MM-DD`), o null. La misma regla que el
 * back: el cierre no puede ser posterior al inicio (que es la medianoche UTC
 * del día de inicio). Al crear, además, tiene que ser futuro; al editar no
 * (un torneo ya pasado se tiene que poder guardar). Una fecha que no se puede
 * leer (p. ej. un año de 5 cifras, que el campo deja escribir) es un error.
 */
export function registrationDeadlineIssue(
  deadline: string,
  startDate: string,
  { requireFuture = false }: { requireFuture?: boolean } = {},
): string | null {
  const at = new Date(deadline);
  if (Number.isNaN(at.getTime())) return "Fecha no válida";
  if (requireFuture && at <= new Date()) return "El cierre de inscripciones debe ser una fecha futura";
  if (startDate && at > new Date(startDate)) return "El cierre de inscripciones debe ser antes del inicio del torneo";
  return null;
}
