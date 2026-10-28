import { zonedDateTimeToIso } from "@/lib/utils/time-zone";

/**
 * Lo que manda «Guardar» en la edición del torneo. El estado, el cierre de
 * inscripciones y la zona, solo si se han tocado:
 *  - el estado avanza solo con la preparación (abrir, cerrar, publicar). Si el
 *    formulario lo mandara siempre, guardar con el torneo de antes en caché
 *    lo devolvería atrás (cerrar inscripciones y guardar la edición las
 *    reabría);
 *  - el cierre, al mostrarlo, pierde los segundos y, en la hora repetida del
 *    cambio de otoño, cuál de las dos era. Se manda como instante: lo escrito
 *    es hora de la zona del torneo (la del formulario), no la del navegador;
 *  - la zona: al cambiarla, el back conserva la hora del reloj de los
 *    partidos y del cierre en la zona nueva.
 */
export function tournamentUpdatePayload<
  T extends { status?: string; registrationDeadline?: string | null; timezone: string },
>(data: T, dirty: { status?: boolean; registrationDeadline?: boolean; timezone?: boolean }) {
  return {
    ...data,
    status: dirty.status ? data.status : undefined,
    registrationDeadline: dirty.registrationDeadline
      ? zonedDateTimeToIso(data.registrationDeadline, data.timezone)
      : undefined,
    timezone: dirty.timezone ? data.timezone : undefined,
  };
}
