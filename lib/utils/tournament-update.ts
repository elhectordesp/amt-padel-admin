import { localDateTimeToIso } from "@/lib/utils/date-keys";

/**
 * Lo que manda «Guardar» en la edición del torneo. El estado y el cierre de
 * inscripciones, solo si se han tocado:
 *  - el estado avanza solo con la preparación (abrir, cerrar, publicar). Si el
 *    formulario lo mandara siempre, guardar con el torneo de antes en caché
 *    lo devolvería atrás (cerrar inscripciones y guardar la edición las
 *    reabría);
 *  - el cierre, al mostrarlo, pierde los segundos y, en la hora repetida del
 *    cambio de otoño, cuál de las dos era. Se manda con su zona: sin ella, el
 *    back lo leía en la hora del servidor.
 */
export function tournamentUpdatePayload<
  T extends { status?: string; registrationDeadline?: string | null },
>(data: T, dirty: { status?: boolean; registrationDeadline?: boolean }) {
  return {
    ...data,
    status: dirty.status ? data.status : undefined,
    registrationDeadline: dirty.registrationDeadline
      ? localDateTimeToIso(data.registrationDeadline)
      : undefined,
  };
}
