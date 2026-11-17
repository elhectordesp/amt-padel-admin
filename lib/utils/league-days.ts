/**
 * Los días de juego de una liga: semanales (lunes a domingo), cada uno con sus
 * franjas horarias. Un torneo tiene un día por fecha; una liga, no: sus
 * jornadas (números de ronda) las saca el sorteo y cada una cae en una semana.
 */
import { hhmmToMinutes, overlappingBlocks, type TimeBlock } from "./schedule-windows";
import { addDaysToKey } from "./time-zone";
import type { ScheduleDayPayload } from "@/types";

/** De 1 (lunes) a 7 (domingo), como el `weekday` del back. */
export const WEEKDAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
] as const;

/** «Lunes»: el nombre de un día de la semana (1 a 7). */
export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((d) => d.value === weekday)?.label ?? "";
}

/** Un día de juego de la liga tal cual se edita. */
export interface LeagueDayForm {
  weekday: number;
  blocks: TimeBlock[];
  /** Franjas que un jugador puede marcar como no disponibles ese día (0 = automático). */
  maxUnavailableSlots: number;
}

/** Un día de la semana cualquiera: ordenados de lunes a domingo, sin repetir. */
export function sortLeagueDays<T extends { weekday: number }>(days: readonly T[]): T[] {
  return [...days].sort((a, b) => a.weekday - b.weekday);
}

/** Lo primero que impide guardar los días de juego de una liga, o null. */
export function leagueDaysIssue(days: readonly LeagueDayForm[]): string | null {
  if (days.length === 0) return "Elige al menos un día de juego.";
  for (const d of days) {
    const day = weekdayLabel(d.weekday).toLowerCase();
    if (d.blocks.length === 0) return `El ${day} necesita al menos una franja horaria.`;
    if (d.blocks.some((b) => hhmmToMinutes(b.start) == null || hhmmToMinutes(b.end) == null)) {
      return `El ${day}: cada franja necesita su hora de inicio y de fin.`;
    }
    if (d.blocks.some((b) => hhmmToMinutes(b.start)! >= hhmmToMinutes(b.end)!)) {
      return `El ${day}: en cada franja, la hora de inicio debe ser anterior a la de fin.`;
    }
    if (overlappingBlocks(d.blocks).length > 0) return `El ${day} tiene franjas que se solapan.`;
  }
  return null;
}

/** Lo que se manda al back: un día por día de la semana, sin fecha. */
export function leagueDaysPayload(days: readonly LeagueDayForm[]): ScheduleDayPayload[] {
  return sortLeagueDays(days).map((d) => ({
    weekday: d.weekday,
    maxUnavailableSlots: d.maxUnavailableSlots,
    blocks: d.blocks,
  }));
}

/**
 * La fecha orientativa de una jornada: el inicio de la liga más una semana por
 * jornada ya jugada (la 1 es la semana del inicio). Se calcula, no se guarda:
 * es una guía para el gestor, no una fecha del partido.
 * `startDate`: la fecha de inicio («YYYY-MM-DD», de calendario).
 */
export function leagueRoundDate(startDate: string, round: number): string {
  return addDaysToKey(startDate, 7 * (round - 1));
}
