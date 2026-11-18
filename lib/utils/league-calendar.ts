/**
 * El calendario de una liga: sus partidos por día (en la zona de la liga) y,
 * aparte, los que aún no tienen fecha. Una liga no tiene programador: el
 * gestor pone fecha, hora y pista a cada partido según le dicen las parejas.
 */
import { phaseLabel } from "@/lib/constants";
import { isByeMatch } from "./match-status";
import { zonedDayKey } from "./time-zone";
import type { MatchResult } from "@/types";

export interface LeagueCalendarDay {
  /** «YYYY-MM-DD» en la zona de la liga. */
  dayKey: string;
  /** Por hora, y a la misma hora por pista. */
  matches: MatchResult[];
}

export interface LeagueCalendar {
  days: LeagueCalendarDay[];
  /** Sin fecha: por categoría, grupo y jornada (los del cuadro final, por fase). */
  unscheduled: MatchResult[];
}

const PHASE_ORDER = ["GROUPS", "R32", "R16", "QF", "SF", "FINAL", "CONSOLATION"];
const phaseRank = (phase: string) => {
  const i = PHASE_ORDER.indexOf(phase);
  return i < 0 ? PHASE_ORDER.length : i;
};

const byText = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").localeCompare(b ?? "", "es");

/**
 * Los partidos de la liga agrupados por día y por hora. Un pase directo (bye)
 * no se juega: no sale en el calendario.
 */
export function leagueCalendar(matches: readonly MatchResult[], timeZone: string): LeagueCalendar {
  const playable = matches.filter((m) => !isByeMatch(m));

  const byDay = new Map<string, MatchResult[]>();
  for (const m of playable) {
    if (!m.date) continue;
    const key = zonedDayKey(m.date, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  }

  const days = [...byDay.keys()]
    .sort()
    .map((dayKey) => ({
      dayKey,
      matches: byDay
        .get(dayKey)!
        .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime() || byText(a.court, b.court)),
    }));

  const unscheduled = playable
    .filter((m) => !m.date)
    .sort(
      (a, b) =>
        byText(a.categoryId, b.categoryId) ||
        phaseRank(a.phase) - phaseRank(b.phase) ||
        byText(a.group, b.group) ||
        (a.round ?? 1) - (b.round ?? 1),
    );

  return { days, unscheduled };
}

/** Qué partido es, en una línea: «Jornada 3 · Grupo A» o «Semifinales». */
export function leagueMatchTitle(m: Pick<MatchResult, "phase" | "round" | "group">): string {
  if (m.phase === "GROUPS") return [`Jornada ${m.round ?? 1}`, m.group].filter(Boolean).join(" · ");
  return phaseLabel(m.phase);
}
