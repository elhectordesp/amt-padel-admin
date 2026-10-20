/**
 * Si el valor de un `datetime-local` se puede leer como fecha (no detecta un
 * 30 de febrero, que `Date` pasa al 2 de marzo, pero el campo no lo deja
 * escribir; sí un año de 5 cifras, que el campo sí deja).
 */
export function isValidDateTime(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Qué falla en un cierre de inscripciones (`datetime-local`, hora local)
 * respecto al inicio del torneo (`YYYY-MM-DD`), o null. La misma regla que el
 * back: el cierre no puede ser posterior al inicio (que es la medianoche UTC
 * del día de inicio). Al crear, además, tiene que ser futuro; al editar no
 * (un torneo ya pasado se tiene que poder guardar).
 */
export function registrationDeadlineIssue(
  deadline: string,
  startDate: string,
  { requireFuture = false }: { requireFuture?: boolean } = {},
): string | null {
  if (!isValidDateTime(deadline)) return "Fecha no válida";
  const at = new Date(deadline);
  if (requireFuture && at <= new Date()) return "El cierre de inscripciones debe ser una fecha futura";
  if (startDate && at > new Date(startDate)) return "El cierre de inscripciones debe ser antes del inicio del torneo";
  return null;
}
