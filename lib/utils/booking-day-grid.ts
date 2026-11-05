/**
 * La rejilla de un día del calendario de reservas (vista «Día»): franjas de
 * 30 min × pistas, como la ve recepción.
 *
 * Las horas van en la zona del club. El back de reservas trabaja en hora de
 * España fija (Europe/Madrid): se pasa `timeZone` para no depender de la
 * zona del navegador.
 */

import {
  addDaysToKey,
  dateOnlyKey,
  startOfZonedDay,
  zonedDayKey,
  zonedMinutes,
} from "@/lib/utils/time-zone";
import type { Court, CourtBlock } from "@/types";
import type {
  Booking,
  ClubOperatingHours,
  ClubScheduleException,
} from "@/types/bookings";

/** Cada cuánto empieza un hueco (como el back al ofrecer huecos). */
export const SLOT_MINUTES = 30;

const DAY_MINUTES = 24 * 60;

export interface DayWindow {
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
}

export type DayGridCell =
  /** Libre. `bookable`: dentro del horario del club, se puede crear ahí. */
  | { kind: "free"; bookable: boolean }
  /** Pista bloqueada (p. ej. por un torneo) en esa franja. */
  | { kind: "blocked"; reason: string | null }
  /** Primera franja de una reserva, que ocupa `span` franjas. */
  | { kind: "booking"; booking: Booking; span: number }
  /** Franja tapada por la reserva que empieza más arriba. */
  | { kind: "covered" };

export interface DayGrid {
  /** Inicio de cada franja, en minutos desde las 00:00 del día. */
  rows: number[];
  /** Por pista, una celda por franja. */
  cells: Record<string, DayGridCell[]>;
}

/**
 * La parte del día que enseña la rejilla. Es también el valor de `?franja=`
 * en la URL (sin él, «todo»): recepción deja fija la suya.
 */
export type DayPeriod = "todo" | "manana" | "tarde";

/** La tarde empieza a las 15:00 (hora del club): «Mañana» son las franjas que empiezan antes. */
export const AFTERNOON_START_MINUTES = 15 * 60;

/** La franja de `?franja=`; cualquier otro valor (o ninguno) es el día entero. */
export function parseDayPeriod(value: string | null | undefined): DayPeriod {
  return value === "manana" || value === "tarde" ? value : "todo";
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de «YYYY-MM-DD». */
export function isoDayOfWeek(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * El rango de GET /bookings para los días `fromKey` a `toKey` del club: de
 * las 00:00 del primero al último milisegundo del último, en la zona del
 * club (con el cambio de hora, un día dura 23 o 25 horas).
 */
export function dayRangeIso(
  fromKey: string,
  toKey: string,
  timeZone: string,
): { fromDate: string; toDate: string } {
  const start = startOfZonedDay(fromKey, timeZone)!;
  const nextStart = startOfZonedDay(addDaysToKey(toKey, 1), timeZone)!;
  return {
    fromDate: start.toISOString(),
    toDate: new Date(nextStart.getTime() - 1).toISOString(),
  };
}

/** Lunes a domingo («YYYY-MM-DD») de la semana de `dayKey`, movida `weekOffset` semanas. */
export function weekDayKeys(dayKey: string, weekOffset = 0): string[] {
  const monday = addDaysToKey(dayKey, 1 - isoDayOfWeek(dayKey) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
}

/** Las reservas por pista y por día del club, cada día por hora de inicio. */
export function bookingsByCourtAndDay(
  bookings: Booking[],
  timeZone: string,
): Record<string, Record<string, Booking[]>> {
  const map: Record<string, Record<string, Booking[]>> = {};
  for (const b of [...bookings].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
    const day = zonedDayKey(b.startsAt, timeZone);
    ((map[b.courtId] ??= {})[day] ??= []).push(b);
  }
  return map;
}

/**
 * El horario del club ese día, como lo calcula el back al ofrecer huecos:
 * manda la excepción del día (cerrado, u horario especial si trae los dos
 * extremos); si no, el horario semanal activo. null: cerrado.
 */
export function resolveDayWindow(
  dayKey: string,
  hours: ClubOperatingHours[],
  exceptions: ClubScheduleException[],
): DayWindow | null {
  // La fecha llega como la medianoche UTC del día ("2026-10-28T00:00:00.000Z")
  const exc = exceptions.find((e) => dateOnlyKey(e.date) === dayKey);
  if (exc) {
    if (exc.isClosed) return null;
    if (exc.customOpen && exc.customClose) {
      return { openTime: exc.customOpen, closeTime: exc.customClose };
    }
  }
  const dow = isoDayOfWeek(dayKey);
  const oh = hours.find((h) => h.dayOfWeek === dow && h.active);
  return oh ? { openTime: oh.openTime, closeTime: oh.closeTime } : null;
}

/** Tramos [inicio, fin) en minutos que un bloqueo quita a la pista ese día. */
function blockRange(block: CourtBlock, dayKey: string): [number, number] | null {
  if (dayKey < block.startDate || dayKey > block.endDate) return null;
  if (!block.startTime || !block.endTime) return [0, DAY_MINUTES];
  return [hhmmToMinutes(block.startTime), hhmmToMinutes(block.endTime)];
}

/**
 * Monta la rejilla del día. null: el club está cerrado y no hay reservas
 * que enseñar.
 *
 * - Las canceladas no ocupan (su hueco queda libre).
 * - Una reserva fuera del horario (cambiado después) también se ve: la
 *   rejilla se alarga hasta ella, pero esas franjas no se ofrecen libres.
 * - Las franjas van alineadas con la apertura, como los huecos del back.
 */
export function buildDayGrid(params: {
  dayKey: string;
  courts: Court[];
  bookings: Booking[];
  window: DayWindow | null;
  timeZone: string;
}): DayGrid | null {
  const { dayKey, courts, window, timeZone } = params;
  const courtIds = new Set(courts.map((c) => c.id));
  const bookings = params.bookings.filter(
    (b) => b.status !== "CANCELLED" && courtIds.has(b.courtId),
  );

  const openMin = window ? hhmmToMinutes(window.openTime) : null;
  const closeMin = window ? hhmmToMinutes(window.closeTime) : null;
  const hasWindow = openMin !== null && closeMin !== null && openMin < closeMin;

  const spans = bookings.map((b) => {
    const start = zonedMinutes(b.startsAt, timeZone);
    return { booking: b, start, end: Math.min(start + b.durationMinutes, DAY_MINUTES) };
  });

  if (!hasWindow && spans.length === 0) return null;

  // Primera y última franja: el horario, alargado hasta las reservas que se salgan
  let first = hasWindow
    ? openMin!
    : Math.floor(Math.min(...spans.map((s) => s.start)) / SLOT_MINUTES) * SLOT_MINUTES;
  for (const s of spans) {
    while (s.start < first) first -= SLOT_MINUTES;
  }
  first = Math.max(first, 0);
  const end = Math.max(hasWindow ? closeMin! : 0, ...spans.map((s) => s.end));

  const rows: number[] = [];
  for (let t = first; t < end; t += SLOT_MINUTES) rows.push(t);

  const cells: Record<string, DayGridCell[]> = {};
  for (const c of courts) {
    cells[c.id] = rows.map((t) => ({
      kind: "free" as const,
      bookable: hasWindow && t >= openMin! && t + SLOT_MINUTES <= closeMin!,
    }));
  }

  for (const s of spans.sort((a, b) => a.start - b.start)) {
    const column = cells[s.booking.courtId];
    const startRow = Math.floor((s.start - first) / SLOT_MINUTES);
    const endRow = Math.ceil((s.end - first) / SLOT_MINUTES);
    // El back no deja solapar dos reservas vivas de la misma pista
    if (column[startRow].kind !== "free") continue;
    const span = Math.max(1, Math.min(endRow, rows.length) - startRow);
    column[startRow] = { kind: "booking", booking: s.booking, span };
    for (let r = startRow + 1; r < startRow + span; r++) column[r] = { kind: "covered" };
  }

  for (const c of courts) {
    for (const block of c.blocks ?? []) {
      const range = blockRange(block, dayKey);
      if (!range) continue;
      rows.forEach((t, i) => {
        const cell = cells[c.id][i];
        if (cell.kind === "free" && t < range[1] && t + SLOT_MINUTES > range[0]) {
          cells[c.id][i] = { kind: "blocked", reason: block.reason ?? null };
        }
      });
    }
  }

  return { rows, cells };
}

/**
 * La rejilla solo con las franjas de la mañana o de la tarde. Una reserva
 * que cruza las 15:00 sale en las dos, cada una con las franjas que le tocan
 * (su hora de inicio y de fin no cambian).
 */
export function sliceDayGrid(grid: DayGrid, period: DayPeriod): DayGrid {
  if (period === "todo") return grid;
  // Las franjas van en orden: la mañana es el principio y la tarde, el resto
  const split = grid.rows.findIndex((t) => t >= AFTERNOON_START_MINUTES);
  const cut = split === -1 ? grid.rows.length : split;
  const [from, to] = period === "manana" ? [0, cut] : [cut, grid.rows.length];

  const cells: Record<string, DayGridCell[]> = {};
  for (const [courtId, column] of Object.entries(grid.cells)) {
    cells[courtId] = column.slice(from, to).map((cell, i): DayGridCell => {
      // La que empezó antes de la franja se ve desde la primera fila
      if (cell.kind === "covered" && i === 0) {
        const head = bookingStartAbove(column, from);
        return head
          ? { kind: "booking", booking: head.booking, span: Math.min(head.end, to) - from }
          : cell;
      }
      // La que sigue después de la franja se corta en la última fila
      if (cell.kind === "booking") return { ...cell, span: Math.min(cell.span, to - from - i) };
      return cell;
    });
  }
  return { rows: grid.rows.slice(from, to), cells };
}

/** La reserva que tapa la fila `row` (empieza más arriba) y la fila en la que termina. */
function bookingStartAbove(
  column: DayGridCell[],
  row: number,
): { booking: Booking; end: number } | null {
  for (let r = row - 1; r >= 0; r--) {
    const cell = column[r];
    if (cell.kind === "booking") return { booking: cell.booking, end: r + cell.span };
  }
  return null;
}

/**
 * Dónde va la línea de la hora actual: la franja en la que cae `nowMinutes`
 * (minutos desde las 00:00 del día del club) y cuánto de ella ha pasado, de
 * 0 a 1. null: la hora está fuera de la rejilla.
 */
export function nowMarker(
  rows: number[],
  nowMinutes: number,
): { row: number; offset: number } | null {
  const row = rows.findIndex((t) => nowMinutes >= t && nowMinutes < t + SLOT_MINUTES);
  return row === -1 ? null : { row, offset: (nowMinutes - rows[row]) / SLOT_MINUTES };
}
