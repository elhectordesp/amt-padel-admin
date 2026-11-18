/**
 * El cuadro final de una liga: la eliminatoria con los N primeros de cada
 * grupo. Lo saca el gestor a mano, por categoría, y solo cuando ya no queda
 * ningún partido de grupos sin resultado.
 */
import { isByeMatch, isMatchFinished } from "./match-status";
import type { MatchResult } from "@/types";

type CategoryMatch = Pick<MatchResult, "categoryId" | "phase" | "status" | "isResult" | "isWalkover" | "team1" | "team2">;

/** Un partido de grupos que nadie ha terminado (programado o en juego; no el cancelado). */
const isGroupPending = (m: CategoryMatch) =>
  m.phase === "GROUPS" && !isMatchFinished(m) && String(m.status ?? "").toUpperCase() !== "CANCELLED";

export interface LeagueFinalState {
  /** Partidos de grupos sin resultado. */
  pendingGroups: number;
  /** Si la categoría ya tiene partidos de grupos (sorteada). */
  hasGroups: boolean;
  /** Si ya hay un cuadro final (algún partido que no es de grupos). */
  hasFinal: boolean;
  /** Partidos del cuadro final ya jugados (un bye no cuenta): con alguno no se rehace. */
  playedFinal: number;
}

export function leagueFinalState(matches: readonly CategoryMatch[], categoryId: string): LeagueFinalState {
  const ofCategory = matches.filter((m) => m.categoryId === categoryId);
  const final = ofCategory.filter((m) => m.phase !== "GROUPS");
  return {
    pendingGroups: ofCategory.filter(isGroupPending).length,
    hasGroups: ofCategory.some((m) => m.phase === "GROUPS"),
    hasFinal: final.length > 0,
    playedFinal: final.filter((m) => isMatchFinished(m) && !isByeMatch(m)).length,
  };
}

/** Por qué no se puede sacar (o rehacer) el cuadro final todavía, o null si se puede. */
export function leagueFinalBlocker(state: LeagueFinalState): string | null {
  if (!state.hasGroups) return "Sortea primero los grupos de la categoría (pestaña «Grupos»).";
  if (state.pendingGroups > 0) {
    return state.pendingGroups === 1
      ? "Queda 1 partido de grupos sin resultado."
      : `Quedan ${state.pendingGroups} partidos de grupos sin resultado.`;
  }
  if (state.playedFinal > 0) return "El cuadro final ya tiene partidos jugados: no se puede rehacer.";
  return null;
}

/** Cuántos pueden pasar de cada grupo: de 1 a 4 y, como mucho, las parejas del grupo más pequeño. */
export function maxQualifiersPerGroup(groupSizes: readonly number[]): number {
  if (groupSizes.length === 0) return 1;
  return Math.max(1, Math.min(4, ...groupSizes));
}
