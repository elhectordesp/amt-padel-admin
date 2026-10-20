import type { MatchResult } from "@/types";

/**
 * Si un partido ya tiene resultado. El back manda el estado en mayúsculas
 * ("FINISHED"); comparar con "finished" daba todos por pendientes en el CSV
 * del horario y en los informes. `isResult` ya lo resuelve el servicio.
 */
export function isMatchFinished(m: Pick<MatchResult, "isResult" | "status">): boolean {
  return m.isResult || String(m.status ?? "").toUpperCase() === "FINISHED";
}

/**
 * Si el partido tiene ya las dos parejas. Un partido del cuadro aún sin
 * rellenar (una semifinal por jugar) o un pase directo (BYE, terminado con
 * una sola pareja) no admite resultado: editar un BYE podía dejar el cuadro
 * sin ganador y quitar a la pareja de la ronda siguiente.
 */
export function hasBothPairs(m: Pick<MatchResult, "team1" | "team2">): boolean {
  return m.team1.length > 0 && m.team2.length > 0;
}

/** Un partido con fecha (los que se ordenan y agrupan por día y hora). */
export type DatedMatch = MatchResult & { date: string };

export function hasDate(m: MatchResult): m is DatedMatch {
  return !!m.date;
}
