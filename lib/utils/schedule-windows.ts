/**
 * Los tramos horarios de las jornadas de un torneo, y si un partido cabe en
 * ellos. Es la regla del back (`outsideScheduleProblem` en schedule-rules.ts):
 * aquí sirve para avisar en la rejilla y al crear un partido antes de
 * guardarlo, y para proponer tramos que no se solapen al montar las jornadas.
 *
 * Las horas van en minutos desde las 00:00, en la hora de pared del torneo.
 */

import { dateOnlyKey } from "./time-zone";

export interface TimeWindow {
  start: number;
  end:   number;
}

/** Un tramo tal cual se escribe: «HH:MM» de inicio y de fin. */
export interface TimeBlock {
  start: string;
  end:   string;
}

/** Lo que hace falta de una jornada del back: su fecha y sus slots («HH:MM»). */
export interface ScheduleDayLike {
  date?:  string | null;
  slots?: string[] | null;
}

/** Lo que hace falta del torneo para saber cuánto dura un partido. */
export interface MatchDurations {
  matchDuration?:     number | null;
  elimMatchDuration?: number | null;
}

/** Los slots que genera el back son de 30 min. */
const SLOT_MINUTES = 30;
const DAY_END = 24 * 60;

/** Las fases de eliminatoria: duran `elimMatchDuration` (si lo hay). */
const ELIM_PHASES = new Set(["R32", "R16", "QF", "SF", "FINAL", "CONSOLATION"]);

/** «09:30» → 570. null si no es una hora válida. */
export function hhmmToMinutes(value: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** 570 → «09:30». */
export function minutesToHhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Minutos que dura un partido de esa fase, como en el back. */
export function phaseDuration(t: MatchDurations | null | undefined, phase: string | null | undefined): number {
  const group = t?.matchDuration ?? 60;
  return phase && ELIM_PHASES.has(phase.toUpperCase()) ? (t?.elimMatchDuration ?? group) : group;
}

/**
 * Junta los slots de una jornada en sus tramos. Cada slot dura el paso de la
 * jornada: la menor diferencia entre dos seguidos (30 min si solo hay uno).
 */
export function dayWindows(slots: readonly string[]): TimeWindow[] {
  const starts = [...new Set(slots.map(hhmmToMinutes))]
    .filter((m): m is number => m != null)
    .sort((a, b) => a - b);
  let step = Infinity;
  for (let i = 1; i < starts.length; i++) step = Math.min(step, starts[i] - starts[i - 1]);
  if (!Number.isFinite(step)) step = SLOT_MINUTES;

  const windows: TimeWindow[] = [];
  for (const s of starts) {
    const last = windows[windows.length - 1];
    if (last && s <= last.end) last.end = Math.max(last.end, s + step);
    else windows.push({ start: s, end: s + step });
  }
  return windows;
}

/**
 * Los tramos del día `dayKey` («YYYY-MM-DD»). null si el torneo no tiene
 * ninguna jornada con fecha (no hay con qué comparar); vacío si ese día no hay
 * jornada.
 */
export function windowsForDay(
  schedule: readonly ScheduleDayLike[] | null | undefined,
  dayKey: string,
): TimeWindow[] | null {
  const dated = (schedule ?? []).filter((d) => !!d?.date);
  if (dated.length === 0) return null;
  const sameDay = dated.filter((d) => dateOnlyKey(d.date) === dayKey);
  return dayWindows(sameDay.flatMap((d) => d.slots ?? []));
}

/** Si un partido de `startMin` a `startMin + duration` cabe entero en un tramo. */
export function fitsInWindows(windows: readonly TimeWindow[], startMin: number, duration: number): boolean {
  return windows.some((w) => startMin >= w.start && startMin + duration <= w.end);
}

/**
 * Por qué un partido el día `dayKey` a `startMin` no cabe en las jornadas del
 * torneo, o null si cabe (o si no hay jornadas con fecha con las que comparar).
 */
export function outsideScheduleIssue(
  schedule: readonly ScheduleDayLike[] | null | undefined,
  dayKey: string,
  startMin: number,
  duration: number,
): string | null {
  const windows = windowsForDay(schedule, dayKey);
  if (windows === null) return null;
  if (windows.length === 0) return "Ese día no hay jornada del torneo.";
  if (fitsInWindows(windows, startMin, duration)) return null;
  const startsIn = windows.find((w) => startMin >= w.start && startMin < w.end);
  if (startsIn) {
    return `Acabaría a las ${minutesToHhmm(startMin + duration)}, después del cierre del tramo (${minutesToHhmm(startsIn.end)}).`;
  }
  const list = windows.map((w) => `${minutesToHhmm(w.start)}-${minutesToHhmm(w.end)}`).join(", ");
  return `Está fuera de los tramos de la jornada (${list}).`;
}

/** Si dos tramos de la misma jornada se pisan (tocarse no es pisarse). */
function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Los tramos escritos que se leen bien y empiezan antes de acabar. */
function validWindows(blocks: readonly TimeBlock[]): TimeWindow[] {
  return blocks
    .map((b) => ({ start: hhmmToMinutes(b.start), end: hhmmToMinutes(b.end) }))
    .filter((w): w is TimeWindow => w.start != null && w.end != null && w.start < w.end);
}

/**
 * Las posiciones de los tramos que se solapan con otro anterior de la misma
 * jornada (ordenados por la hora de inicio).
 */
export function overlappingBlocks(blocks: readonly TimeBlock[]): number[] {
  const ordered = blocks
    .map((b, i) => ({ start: hhmmToMinutes(b.start), end: hhmmToMinutes(b.end), i }))
    .filter((w): w is TimeWindow & { i: number } => w.start != null && w.end != null && w.start < w.end)
    .sort((a, b) => a.start - b.start);
  const result: number[] = [];
  let reach = -1;
  for (const w of ordered) {
    if (w.start < reach) result.push(w.i);
    reach = Math.max(reach, w.end);
  }
  return result;
}

/**
 * Un tramo nuevo para la jornada que no pise los que ya tiene: el de mañana
 * (09:00-14:00) o el de tarde (16:00-21:00) si están libres; si no, uno de
 * hasta 2 h justo después del último. null si no queda hueco en el día.
 */
export function nextFreeBlock(blocks: readonly TimeBlock[]): TimeBlock | null {
  const taken = validWindows(blocks);
  const candidates: TimeWindow[] = [
    { start: 9 * 60, end: 14 * 60 },
    { start: 16 * 60, end: 21 * 60 },
  ];
  const free = candidates.find((c) => !taken.some((t) => overlaps(c, t)));
  if (free) return { start: minutesToHhmm(free.start), end: minutesToHhmm(free.end) };

  const lastEnd = Math.max(...taken.map((t) => t.end));
  // Un tramo sirve, como mucho, hasta las 23:30: el último slot de 30 min que
  // cabe antes de medianoche es el de las 23:00
  const end = Math.min(lastEnd + 120, DAY_END - SLOT_MINUTES);
  if (end - lastEnd < SLOT_MINUTES) return null;
  return { start: minutesToHhmm(lastEnd), end: minutesToHhmm(end) };
}
