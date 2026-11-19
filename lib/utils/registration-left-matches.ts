/**
 * Un partido sin jugar que deja una pareja al cancelarse su inscripción con el
 * sorteo ya hecho (grupos o cuadro generados): el back lo manda en
 * `leftMatches` al cancelar.
 */
export interface LeftMatch {
  matchId: string;
  categoryId: string;
  phase: string;
  /** «Cuartos: Ana / Bea vs por definir». */
  label: string;
}

/** Cuántos partidos se enumeran en el aviso antes de decir «y N más». */
const LISTED = 4;

/**
 * El aviso para el admin al cancelar parejas de una categoría ya sorteada:
 * esos partidos se quedan con una pareja cancelada y no sube nadie de la lista
 * de espera ni se rehace el cuadro. Null si no deja ninguno.
 */
export function leftMatchesNotice(
  leftMatches: readonly LeftMatch[] | null | undefined,
): string | null {
  if (!leftMatches || leftMatches.length === 0) return null;
  const n = leftMatches.length;
  const listed = leftMatches
    .slice(0, LISTED)
    .map((m) => m.label)
    .join("; ");
  const more = n > LISTED ? ` y ${n - LISTED} más` : "";
  return (
    `${n === 1 ? "Deja 1 partido sin jugar" : `Dejan ${n} partidos sin jugar`}: ${listed}${more}. ` +
    "El cuadro no se rehace solo y no sube nadie de la lista de espera: " +
    "resuélvelos (W.O., otra pareja o regenerar el cuadro)."
  );
}
