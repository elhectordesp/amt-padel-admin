/**
 * Fechas y horas en la zona horaria de un torneo, no en la del navegador.
 *
 * Cada torneo tiene su zona (`Tournament.timezone`, heredada de su club; por
 * defecto Europe/Madrid). Sus horas (jornadas, partidos, cierre de
 * inscripciones) se enseñan y se mandan en esa zona: un admin en otra zona, o
 * un torneo en Canarias gestionado desde Madrid, ve la hora del torneo.
 *
 * - Un instante (ISO con zona) se enseña con `formatInTimeZone` o
 *   `toZonedDateTimeInput`.
 * - Lo que se escribe en un `datetime-local` es hora de pared del torneo y se
 *   manda como instante con `zonedDateTimeToIso`.
 * - Las fechas de calendario (inicio, fin, jornadas) van a la medianoche UTC:
 *   se leen con `dateOnlyKey`, sin zona.
 */

export const DEFAULT_TIME_ZONE = "Europe/Madrid";

/** Las zonas que ofrece el selector (el back admite cualquier zona IANA). */
export const TIME_ZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Europe/Madrid",   label: "Península, Baleares, Ceuta y Melilla" },
  { value: "Atlantic/Canary", label: "Canarias" },
  { value: "Europe/Lisbon",   label: "Portugal" },
  { value: "Europe/Andorra",  label: "Andorra" },
];

/** El nombre de la zona en el selector («Canarias»); si no está, la zona tal cual. */
export function timeZoneLabel(tz: string): string {
  return TIME_ZONE_OPTIONS.find((o) => o.value === tz)?.label ?? tz;
}

/** Las opciones del selector, con la zona actual aunque no esté en la lista. */
export function timeZoneOptions(current?: string | null): { value: string; label: string }[] {
  if (!current || TIME_ZONE_OPTIONS.some((o) => o.value === current)) return TIME_ZONE_OPTIONS;
  return [...TIME_ZONE_OPTIONS, { value: current, label: current }];
}

/** Si el navegador conoce la zona. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** La zona del torneo (o del club); sin ella (un back anterior), la de Madrid. */
export function tournamentTimeZone(t?: { timezone?: string | null } | null): string {
  return isValidTimeZone(t?.timezone) ? t!.timezone! : DEFAULT_TIME_ZONE;
}

// ── Hora de pared ───────────────────────────────────────────────────────────

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

function wallClock(d: Date, tz: string): WallClock {
  const parts = partsFormatter(tz).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «YYYY-MM-DD» del instante en la zona. */
export function zonedDayKey(value: string | Date, tz: string): string {
  const w = wallClock(new Date(value), tz);
  return `${w.year}-${pad2(w.month)}-${pad2(w.day)}`;
}

/** «HH:mm» del instante en la zona. */
export function zonedTime(value: string | Date, tz: string): string {
  const w = wallClock(new Date(value), tz);
  return `${pad2(w.hour)}:${pad2(w.minute)}`;
}

/** Minutos desde las 00:00 del instante en la zona. */
export function zonedMinutes(value: string | Date, tz: string): number {
  const w = wallClock(new Date(value), tz);
  return w.hour * 60 + w.minute;
}

/** Fecha y hora para un texto, en la zona del torneo. Vacío si no es válida. */
export function formatInTimeZone(
  value: string | Date | null | undefined,
  tz: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  return d ? d.toLocaleString("es-ES", { ...opts, timeZone: tz }) : "";
}

/** La hora de pared de `instant` en `tz`, leída como si fuera UTC (sin ms). */
function wallMs(instant: number, tz: string): number {
  const w = wallClock(new Date(instant), tz);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
}

function offsetAt(instant: number, tz: string): number {
  const whole = Math.floor(instant / 1000) * 1000;
  return wallMs(whole, tz) - whole;
}

/**
 * El instante de una hora de pared de `tz` (dada como si fuera UTC). En el
 * cambio de hora, como el back: la hora repetida de otoño es la primera vez
 * que pasa, y la que no existe en primavera se corre lo que dura el salto.
 */
function wallToInstant(target: number, tz: string): Date {
  const before = offsetAt(target - DAY_MS, tz);
  const after = offsetAt(target + DAY_MS, tz);
  const matches = [...new Set([before, after])]
    .map((offset) => target - offset)
    .filter((instant) => wallMs(instant, tz) === target)
    .sort((a, b) => a - b);
  return new Date(matches.length > 0 ? matches[0] : target - before);
}

// Los segundos, si vienen, no cuentan (como NAIVE_DATE_TIME en el back). Sin
// ellos aquí, un valor con segundos no se leía y el partido se guardaba sin hora
const NAIVE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/;

/** El instante de «YYYY-MM-DD» o «YYYY-MM-DDTHH:mm» (hora de pared de `tz`). */
export function zonedToDate(value: string, tz: string): Date | null {
  const m = NAIVE.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00"] = m;
  const target = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  // Un mes 13 o un día 45 no existen (Date.UTC los normalizaría)
  const check = new Date(target);
  if (check.getUTCMonth() !== +mo - 1 || check.getUTCDate() !== +d || +h > 23 || +mi > 59) return null;
  return wallToInstant(target, tz);
}

/**
 * El valor de un `<input type="datetime-local">` (YYYY-MM-DDTHH:mm) para un
 * instante, en la zona del torneo. Vacío si no hay o no es válido.
 */
export function toZonedDateTimeInput(value: string | Date | null | undefined, tz: string): string {
  const d = toDate(value);
  return d ? `${zonedDayKey(d, tz)}T${zonedTime(d, tz)}` : "";
}

/**
 * El instante (ISO con zona) de lo escrito en un `datetime-local`, leído en
 * la zona del torneo: así se manda al back. Vacío o no válido: undefined.
 */
export function zonedDateTimeToIso(value: string | null | undefined, tz: string): string | undefined {
  if (!value) return undefined;
  return zonedToDate(value, tz)?.toISOString();
}

// ── Fechas de calendario ────────────────────────────────────────────────────

/**
 * El día («YYYY-MM-DD») de una fecha de calendario del back (inicio, fin,
 * jornada). Va a la medianoche UTC; alguna antigua se guardó como la
 * medianoche de España («2026-11-19T23:00Z» para el 20). Como el back, se
 * redondea a la medianoche UTC más cercana, que es su día en cualquier zona
 * entre UTC-12 y UTC+12. Leída en la zona del torneo, en Canarias salía el
 * día anterior (y al guardar el formulario, se movía el inicio).
 */
export function dateOnlyKey(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  return new Date(Math.round(d.getTime() / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
}

/** Una fecha de calendario («YYYY-MM-DD») para un texto, sin zona. */
export function formatDayKey(dayKey: string, opts: Intl.DateTimeFormatOptions): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dayKey);
  if (!m) return "";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("es-ES", { ...opts, timeZone: "UTC" });
}

/** El día `days` días después de `dayKey` («YYYY-MM-DD»), sin zona ni cambio de hora. */
export function addDaysToKey(dayKey: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return dayKey;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days)).toISOString().slice(0, 10);
}

/** Las 00:00 del día `dayKey` en la zona: el inicio del torneo. */
export function startOfZonedDay(dayKey: string, tz: string): Date | null {
  return zonedToDate(dayKey, tz);
}
