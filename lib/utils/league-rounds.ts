/**
 * Las jornadas de una liga: los partidos de grupos de cada categoría, por
 * grupo y por jornada (`Match.round`). Todos contra todos: en cada jornada
 * cada pareja juega una vez y, con un número impar de parejas, una descansa.
 */

/** Lo que hace falta de un partido de la lista del back. */
export interface LeagueMatchLike {
  id: string;
  phase: string;
  /** Nombre del grupo («Grupo A»). */
  group?: string | null;
  /** Número de jornada; sin él (partidos antiguos), la 1. */
  round?: number | null;
  players?: { userId: string }[];
}

/** Una fila de la clasificación de un grupo (la pareja y sus jugadores). */
interface StandingsRowLike {
  userId: string;
  partnerId?: string | null;
  name: string;
}

/** Un grupo con su clasificación, tal como lo devuelve el back. */
export interface StandingsGroupLike {
  id: string;
  label: string;
  rows: StandingsRowLike[];
}

export interface LeagueRound<M> {
  round: number;
  matches: M[];
  /** Las parejas que no juegan esta jornada (nombre); solo con grupos de impares. */
  resting: string[];
}

export interface LeagueGroupRounds<M> {
  /** Nombre del grupo («Grupo A»). */
  name: string;
  rounds: LeagueRound<M>[];
}

/**
 * Los partidos de grupos agrupados por grupo y jornada, con las jornadas en
 * orden. Con la clasificación de los grupos se sabe quién descansa cada
 * jornada; sin ella (aún sin cargar), solo salen los partidos.
 */
export function leagueRounds<M extends LeagueMatchLike>(
  matches: readonly M[],
  groups: readonly StandingsGroupLike[] = [],
): LeagueGroupRounds<M>[] {
  const byGroup = new Map<string, M[]>();
  for (const m of matches) {
    if (m.phase !== "GROUPS" || !m.group) continue;
    byGroup.set(m.group, [...(byGroup.get(m.group) ?? []), m]);
  }

  return [...byGroup.keys()]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((name) => {
      const ofGroup = byGroup.get(name)!;
      const rows = groups.find((g) => g.label === name)?.rows ?? [];
      const roundNumbers = [...new Set(ofGroup.map((m) => m.round ?? 1))].sort((a, b) => a - b);
      return {
        name,
        rounds: roundNumbers.map((round) => {
          const inRound = ofGroup.filter((m) => (m.round ?? 1) === round);
          const playing = new Set(inRound.flatMap((m) => (m.players ?? []).map((p) => p.userId)));
          return {
            round,
            matches: inRound,
            // Una pareja descansa si ninguno de sus jugadores juega esta jornada
            resting: rows
              .filter((r) => ![r.userId, r.partnerId].some((id) => !!id && playing.has(id)))
              .map((r) => r.name),
          };
        }),
      };
    });
}
