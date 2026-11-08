import type { ScoringFormat } from "@/types";

/**
 * Los formatos de partido (enum `ScoringFormat` del back): cómo se llaman
 * para quien organiza, cuánto suelen durar y qué marcador vale en cada uno.
 * Es la única definición del panel: asistente, opciones del club, ficha del
 * torneo, resultados y visor leen de aquí. Las reglas del marcador son las
 * del back (`validate-score.util.ts`), que es quien las aplica al guardar.
 *
 * El punto de oro (sin ventaja en el 40-40) no cambia el marcador: no es un
 * formato; si el club lo usa, va en las normas del torneo.
 */

/**
 * Qué marcador vale en una casilla de set:
 * - standard: 6-0 a 6-4, 7-5 o 7-6.
 * - shortSet: 6-0 a 6-4 o 6-5 (el set se decide con un tie-break a 5-5).
 * - pro9: 9-0 a 9-8.
 * - superTb: súper tie-break, primero a 10 con 2 de diferencia.
 */
export type SetKind = "standard" | "shortSet" | "pro9" | "superTb";

export const SET_KIND: Record<SetKind, { hint: string; maxGames: number }> = {
  standard: { hint: "6-0 a 6-4, 7-5 o 7-6",                                  maxGames: 7  },
  shortSet: { hint: "6-0 a 6-4 o 6-5",                                       maxGames: 6  },
  pro9:     { hint: "9-0 a 9-8",                                             maxGames: 9  },
  superTb:  { hint: "súper tie-break: primero a 10 con 2 de diferencia (10-8, 11-9…)", maxGames: 99 },
};

interface ScoringFormatInfo {
  /** El nombre en panel y visor. */
  label:          string;
  /** Lo que suele durar un partido en pista, en minutos (una pista para elegir la duración, no una regla). */
  typicalMinutes: number;
  /** El marcador que vale, dicho para quien mete el resultado. */
  scoreHint:      string;
  /**
   * Las casillas de set del partido, en orden. Con una, se juega a un solo set;
   * con tres, al mejor de tres (gana quien llega a 2) y la 3.ª solo se juega
   * si hace falta.
   */
  sets:           readonly SetKind[];
}

const INFO: Record<ScoringFormat, ScoringFormatInfo> = {
  BEST_OF_3: {
    label:          "3 sets",
    typicalMinutes: 75,
    scoreHint:      "3 sets: cada set 6-0 a 6-4, 7-5 o 7-6",
    sets:           ["standard", "standard", "standard"],
  },
  BEST_OF_2_SUPERTB: {
    label:          "2 sets + súper tie-break",
    typicalMinutes: 60,
    scoreHint:      "2 sets de 6-0 a 6-4, 7-5 o 7-6 y, si se reparten, súper tie-break a 10 (10-8, 11-9…)",
    sets:           ["standard", "standard", "superTb"],
  },
  ONE_SET: {
    label:          "1 set (tie-break a 6-6)",
    typicalMinutes: 30,
    scoreHint:      "1 set: 6-0 a 6-4, 7-5 o 7-6",
    sets:           ["standard"],
  },
  ONE_SET_GOLDEN_GAME: {
    label:          "1 set (juego decisivo a 5-5)",
    typicalMinutes: 30,
    scoreHint:      "1 set: 6-0 a 6-4 o 6-5",
    sets:           ["shortSet"],
  },
  PRO_SET_9: {
    label:          "A 9 juegos",
    typicalMinutes: 45,
    scoreHint:      "a 9 juegos: 9-0 a 9-8",
    sets:           ["pro9"],
  },
  SHORT_SETS_SUPERTB: {
    label:          "2 sets (tie-break a 5-5) + súper tie-break",
    typicalMinutes: 60,
    scoreHint:      "2 sets de 6-0 a 6-4 o 6-5 y, si se reparten, súper tie-break a 10 (10-8, 11-9…)",
    sets:           ["shortSet", "shortSet", "superTb"],
  },
};

/** Los seis, en el orden en que se ofrecen. */
export const SCORING_FORMATS = Object.keys(INFO) as ScoringFormat[];

/** El de una categoría o un club que no ha elegido otro (el `@default` del back). */
export const DEFAULT_SCORING_FORMAT: ScoringFormat = "BEST_OF_3";

export function isScoringFormat(value: unknown): value is ScoringFormat {
  return SCORING_FORMATS.some((f) => f === value);
}

/** Las opciones de un selector de formato. */
export const SCORING_FORMAT_OPTIONS: { value: ScoringFormat; label: string }[] =
  SCORING_FORMATS.map((value) => ({ value, label: INFO[value].label }));

/** El nombre del formato; uno que el panel no conoce, tal cual. */
export function scoringFormatLabel(format: string): string {
  return isScoringFormat(format) ? INFO[format].label : format;
}

/** Lo que suele durar un partido del formato, en minutos. */
export function typicalMinutes(format: ScoringFormat): number {
  return INFO[format].typicalMinutes;
}

/** «Suele durar unos 30 min»: la pista junto al selector (no cambia la duración del partido). */
export function typicalDurationText(format: ScoringFormat): string {
  return `Suele durar unos ${typicalMinutes(format)} min`;
}

/** El marcador que vale en el formato, para la pista del resultado. */
export function scoreHint(format: ScoringFormat): string {
  return INFO[format].scoreHint;
}

/** Las casillas de set del formato (1, o 3 si es al mejor de tres). */
export function setKinds(format: ScoringFormat): readonly SetKind[] {
  return INFO[format].sets;
}

/** Cuántos sets hacen falta como mínimo para un partido acabado: 1 en los de un set; 2 en los demás. */
export function minSets(format: ScoringFormat): number {
  return INFO[format].sets.length === 1 ? 1 : 2;
}
