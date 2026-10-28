import type { TournamentStatus } from "@/types";

/**
 * Los pasos de estado habituales de un torneo: los mismos que admite el back
 * sin forzar (`TOURNAMENT_TRANSITIONS` en admin.service.ts). Cualquier otro
 * salto el back lo pide confirmar («Confirma para forzar…»).
 */
const STANDARD_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT:     ["OPEN", "CANCELLED"],
  OPEN:      ["DRAW", "CANCELLED"],
  DRAW:      ["SCHEDULED", "OPEN", "CANCELLED"],
  SCHEDULED: ["ONGOING", "DRAW", "CANCELLED"],
  ONGOING:   ["FINISHED", "CANCELLED"],
  FINISHED:  [],
  CANCELLED: [],
};

/** Si pasar de `from` a `to` es un paso habitual (o quedarse igual). */
export function isStandardTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  return from === to || (STANDARD_TRANSITIONS[from] ?? []).includes(to);
}

/** Los pasos habituales desde `from`. */
export function standardNextStatuses(from: TournamentStatus): TournamentStatus[] {
  return STANDARD_TRANSITIONS[from] ?? [];
}
