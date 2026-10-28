import type { TournamentStatus } from "./index";

/** Pasos de la preparación de un torneo, en orden (los da el back). */
export type PreparationStepKey =
  | "CATEGORIES"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "DRAW"
  | "SCHEDULE"
  | "PUBLISH";

export interface PreparationCategory {
  categoryId: string;
  gender: string;
  level: string;
  confirmedPairs: number;
  /** Tiene partidos: el cuadro está generado. */
  hasDraw: boolean;
  /** Con menos de 3 parejas confirmadas no se puede sortear. */
  canDraw: boolean;
  /** Partidos con las dos parejas y sin hora o sin pista. */
  unscheduled: number;
  /** El resto de conflictos de horario. */
  conflicts: number;
  published: boolean;
}

export interface TournamentPreparation {
  status: TournamentStatus;
  registrationDeadline: string | null;
  percent: number;
  steps: { key: PreparationStepKey; done: boolean }[];
  nextStep: PreparationStepKey | null;
  categories: PreparationCategory[];
}

export interface ScheduleConflictLite {
  type: string;
  matchId: string;
  description: string;
}

export interface PublishAndNotifyResult {
  results: {
    categoryId: string;
    gender: string;
    level: string;
    alreadyPublished: boolean;
    published: boolean;
    conflicts: ScheduleConflictLite[];
  }[];
  publishedCount: number;
  total: number;
  status: TournamentStatus | null;
}

/** Semáforo de una franja: alta (≥ 90 % puede jugar), media (≥ 75 %), baja (≥ 50 %) y crítica. */
export type HeatLevel = "HIGH" | "MEDIUM" | "LOW" | "CRITICAL";

export interface AvailabilityHeatmap {
  categoryId: string | null;
  totalPairs: number;
  pairsWithRestrictions: number;
  criticalCells: number;
  days: {
    dayId: string;
    label: string;
    date: string | null;
    type: string;
    cells: { slot: string; unavailablePairs: number; availablePct: number; level: HeatLevel }[];
  }[];
}

export interface CategoryLevelSummary {
  categoryId: string;
  gender: string;
  level: string;
  /** La banda de SPA recomendada para el nivel (null si no tiene umbral). */
  band: { min: number; max: number | null } | null;
  players: number;
  minSpa: number | null;
  maxSpa: number | null;
  avgSpa: number | null;
  belowBand: number;
  aboveBand: number;
  lowReliability: number;
}

/**
 * «Forzar» el bloqueo de los grupos de un cuadro publicado: sin él, mover
 * parejas, reestructurar, añadir o borrar grupos y regenerar dan 409
 * GROUPS_LOCKED. No confirma perder resultados (eso es `force`).
 */
export interface GroupsLockOptions {
  forceLocked?: boolean;
}
