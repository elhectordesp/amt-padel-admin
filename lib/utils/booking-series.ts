/**
 * Lógica pura de las reservas fijas (el mismo hueco cada semana): la fecha «Hasta»
 * por defecto y sus límites, los textos de cada fecha y del resumen, el estado de
 * cada reserva fija y los mensajes de sus errores. Fechas «YYYY-MM-DD» del club.
 */
import type {
  SeriesBookingRow,
  SeriesOccurrence,
  SeriesPlan,
  SeriesTotals,
  SeriesUnavailableReason,
  SeriesView,
} from "@/lib/services/booking-series";
import { formatCents } from "@/lib/utils/booking-price";
import { addDaysToKey, capitalizeFirst, formatDayKey, formatInTimeZone } from "@/lib/utils/time-zone";
import type { Booking } from "@/types/bookings";

/** Una reserva fija dura como mucho un año: la fecha de inicio más 364 días. */
export const SERIES_MAX_DAYS = 364;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** ¿Es una reserva de una reserva fija? Para la marca «Fija». */
export function isFixedBooking(b: Pick<Booking, "recurringGroupId">): boolean {
  return !!b.recurringGroupId;
}

/** El último día en que puede acabar una reserva fija que empieza `startDay`. */
export function seriesMaxEndDate(startDay: string): string {
  return DAY_KEY.test(startDay) ? addDaysToKey(startDay, SERIES_MAX_DAYS) : "";
}

/**
 * Hasta cuándo se propone repetir: el 30 de junio siguiente al día de inicio (el
 * fin de la temporada), sin pasar del máximo de un año. Sin día de inicio, vacío.
 */
export function defaultSeriesEndDate(startDay: string): string {
  if (!DAY_KEY.test(startDay)) return "";
  const year = Number(startDay.slice(0, 4));
  const thisJune = `${year}-06-30`;
  const june = startDay < thisJune ? thisJune : `${year + 1}-06-30`;
  const max = seriesMaxEndDate(startDay);
  return june < max ? june : max;
}

/** «2/12»: el día y el mes, para «Desde el 2/12 hasta el 30/6». */
export function shortDay(dayKey: string): string {
  return formatDayKey(dayKey, { day: "numeric", month: "numeric" });
}

/** Por qué no vale la fecha «Hasta» (null si vale), dicho para quien la escribe. */
export function seriesEndDateError(startDay: string, endDay: string): string | null {
  if (!DAY_KEY.test(endDay)) return "Elige hasta qué fecha se repite.";
  if (DAY_KEY.test(startDay) && endDay < startDay) return "La fecha de fin no puede ser anterior a la de inicio.";
  const max = seriesMaxEndDate(startDay);
  if (max && endDay > max) return `Una reserva fija dura como mucho un año: hasta el ${shortDay(max)} como máximo.`;
  return null;
}

/** Los datos de lo que se va a repetir, listos para pedir la vista previa; null si falta algo. */
export function buildSeriesPlan(args: {
  courtId: string;
  clubCustomerId: string | null | undefined;
  startDate: string;
  endDate: string;
  startTime: string;
  durationMinutes: number;
}): SeriesPlan | null {
  if (!args.courtId || !args.clubCustomerId || !DAY_KEY.test(args.startDate) || !DAY_KEY.test(args.endDate)) return null;
  if (!/^\d{2}:\d{2}$/.test(args.startTime) || !(args.durationMinutes > 0)) return null;
  return {
    courtId: args.courtId,
    clubCustomerId: args.clubCustomerId,
    startDate: args.startDate,
    endDate: args.endDate,
    startTime: args.startTime,
    durationMinutes: args.durationMinutes,
  };
}

// ── Textos de las fechas ────────────────────────────────────────────────────

const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** El día de la semana (1 = lunes … 7 = domingo) con mayúscula: «Martes». */
export function weekdayName(weekday: number): string {
  return capitalizeFirst(WEEKDAYS[weekday - 1] ?? "");
}

/** El día de la semana de una fecha «YYYY-MM-DD»: 1 = lunes … 7 = domingo; 0 si no es una fecha. */
export function isoWeekday(dayKey: string): number {
  if (!DAY_KEY.test(dayKey)) return 0;
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** «martes» → «los martes»; «sábado» → «los sábados». */
export function everyWeekdayText(weekday: number): string {
  const name = WEEKDAYS[weekday - 1];
  if (!name) return "";
  return `los ${name.endsWith("s") ? name : `${name}s`}`;
}

/** «Martes 19:30 · 90 min». */
export function seriesSlotLabel(s: Pick<SeriesView, "weekday" | "startTime" | "durationMinutes">): string {
  return `${weekdayName(s.weekday)} ${s.startTime} · ${s.durationMinutes} min`;
}

/** «Desde el 2/12 hasta el 30/6». */
export function seriesRangeLabel(s: Pick<SeriesView, "startDate" | "endDate">): string {
  return `Desde el ${shortDay(s.startDate)} hasta el ${shortDay(s.endDate)}`;
}

/** «mar 2 dic»: lo que va delante de cada fecha de la vista previa. */
export function occurrenceDayLabel(dayKey: string): string {
  return formatDayKey(dayKey, { weekday: "short", day: "numeric", month: "short" }).replace(/[.,]/g, "");
}

/** «mié 2 dic»: el día de una reserva (un instante) en la zona del club. */
export function bookingDayLabel(startsAt: string, timeZone: string): string {
  return formatInTimeZone(startsAt, timeZone, { weekday: "short", day: "numeric", month: "short" }).replace(/[.,]/g, "");
}

const UNAVAILABLE_REASON: Record<SeriesUnavailableReason, string> = {
  CLUB_CLOSED:   "el club cierra",
  OUTSIDE_HOURS: "fuera de horario",
  TAKEN:         "todas las pistas ocupadas",
};

/** «Libre · 22,00 €», «En Pista 4 · 22,00 €» o «No se puede: el club cierra». */
export function occurrenceStatusText(o: Pick<SeriesOccurrence, "status" | "courtName" | "priceCents" | "reason">): string {
  if (o.status === "UNAVAILABLE") {
    return `No se puede: ${(o.reason && UNAVAILABLE_REASON[o.reason]) || "sin hueco"}`;
  }
  const price = formatCents(o.priceCents ?? 0);
  return o.status === "OTHER_COURT" ? `En ${o.courtName ?? "otra pista"} · ${price}` : `Libre · ${price}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Cuántas fechas hay de cada tipo. Las libres y las de otra pista son las que se crean. */
export function countOccurrences(occurrences: Pick<SeriesOccurrence, "status">[]): Omit<SeriesTotals, "priceCents"> {
  const count = (status: SeriesOccurrence["status"]) => occurrences.filter((o) => o.status === status).length;
  return { free: count("FREE"), otherCourt: count("OTHER_COURT"), unavailable: count("UNAVAILABLE") };
}

/** Las reservas que se crearían (o se crearon): las libres más las de otra pista. */
export function createdCount(t: Pick<SeriesTotals, "free" | "otherCourt">): number {
  return t.free + t.otherCourt;
}

/** «Crear 28 reservas» / «Crear 1 reserva». */
export function createButtonLabel(n: number): string {
  return `Crear ${plural(n, "reserva", "reservas")}`;
}

/** «28 reservas · 616,00 €, 2 en otra pista y 1 fecha sin hueco»: el resumen bajo las fechas. */
export function previewSummary(t: SeriesTotals): string {
  const n = createdCount(t);
  const parts = [`${plural(n, "reserva", "reservas")} · ${formatCents(t.priceCents)}`];
  if (t.otherCourt > 0) parts.push(`${t.otherCourt} en otra pista`);
  if (t.unavailable > 0) parts.push(`${plural(t.unavailable, "fecha", "fechas")} sin hueco`);
  return parts.join(", ");
}

/** El aviso al crear: «Reserva fija creada: 28 reservas, 2 en otra pista, 1 fecha sin hueco». */
export function createdMessage(occurrences: Pick<SeriesOccurrence, "status">[]): string {
  const t = countOccurrences(occurrences);
  const parts = [`Reserva fija creada: ${plural(createdCount(t), "reserva", "reservas")}`];
  if (t.otherCourt > 0) parts.push(`${t.otherCourt} en otra pista`);
  if (t.unavailable > 0) parts.push(`${plural(t.unavailable, "fecha", "fechas")} sin hueco`);
  return parts.join(", ");
}

/** El aviso al ampliar: «Reserva fija ampliada: 8 reservas más, 1 en otra pista». */
export function extendedMessage(occurrences: Pick<SeriesOccurrence, "status">[]): string {
  const t = countOccurrences(occurrences);
  const parts = [`Reserva fija ampliada: ${plural(createdCount(t), "reserva más", "reservas más")}`];
  if (t.otherCourt > 0) parts.push(`${t.otherCourt} en otra pista`);
  if (t.unavailable > 0) parts.push(`${plural(t.unavailable, "fecha", "fechas")} sin hueco`);
  return parts.join(", ");
}

// ── Estado de una reserva fija ──────────────────────────────────────────────

export type SeriesState = "active" | "ended" | "finished";

/** Activa; terminada a mano antes de tiempo; o acabada, porque llegó su fecha de fin. */
export function seriesState(s: Pick<SeriesView, "endedAt" | "endDate">, today: string): SeriesState {
  if (s.endedAt) return "ended";
  return s.endDate < today ? "finished" : "active";
}

export const SERIES_STATE_LABEL: Record<SeriesState, string> = {
  active:   "Activa",
  ended:    "Terminada",
  finished: "Acabada",
};

/**
 * Ampliar vale mientras no se haya terminado a mano (la ya acabada se puede alargar)
 * y quede algún día entre su fin y el máximo (un año desde hoy).
 */
export function canExtendSeries(s: Pick<SeriesView, "endedAt" | "endDate">, today: string): boolean {
  return !s.endedAt && s.endDate < extendMaxEndDate(today);
}

/** Terminar vale con la serie sin terminar y con alguna fecha por delante. */
export function canEndSeries(s: Pick<SeriesView, "endedAt" | "endDate">, today: string): boolean {
  return !s.endedAt && s.endDate >= today;
}

/** «2 próximas» / «Sin próximas» y, si la hay, cuál es la siguiente. */
export function upcomingText(count: number): string {
  return count === 0 ? "Sin próximas" : plural(count, "próxima", "próximas");
}

/** Cómo va una reserva de la serie, para la lista del detalle. */
export function seriesBookingState(b: Pick<SeriesBookingRow, "status" | "paymentMethod" | "priceCents" | "paidAmountCents" | "hasMoney">): {
  text: string;
  tone: "paid" | "unpaid" | "money" | "muted";
} {
  if (b.status === "CANCELLED") return { text: "Cancelada", tone: "muted" };
  const paid = (b.paidAmountCents ?? 0) > 0 || (b.paymentMethod !== null && b.paymentMethod !== "PENDING" && b.priceCents > 0);
  if (paid) return { text: "Cobrada", tone: "paid" };
  // Con partes cobradas o a deber, o con un bono o venta: no está «sin cobrar» sin más
  if (b.hasMoney) return { text: "Con cobros o deuda", tone: "money" };
  if (b.priceCents > 0) return { text: "Sin cobrar", tone: "unpaid" };
  return { text: "Sin importe", tone: "muted" };
}

// ── Errores ─────────────────────────────────────────────────────────────────

/** Los códigos de error de las reservas fijas, dichos en llano para el gestor. */
export const SERIES_ERROR_MESSAGES: Record<string, string> = {
  BOOKING_SERIES_NOT_FOUND: "Esa reserva fija ya no existe. Recarga la pantalla.",
  BOOKING_SERIES_INVALID:   "Los datos de la reserva fija no valen. Revisa la pista, la hora y las fechas.",
  BOOKING_SERIES_ENDED:     "Esta reserva fija ya está terminada. Para seguir, crea otra desde el calendario.",
  BOOKING_SERIES_EMPTY:     "Ninguna de las fechas está libre, así que no se ha creado la reserva fija. Prueba con otra hora, otra pista o más semanas.",
  BOOKING_SERIES_DUPLICATE: "Este cliente ya tiene una reserva fija ese día, a esa hora y en esa pista. Búscala en Reservas fijas.",
};

/** El mensaje de un error de reservas fijas: el del código; en INVALID, el del back, que dice qué dato falla. */
export function seriesErrorText(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  const message = (err as Error | null)?.message ?? "";
  if (typeof code !== "string" || !(code in SERIES_ERROR_MESSAGES)) return message || "No se pudo completar la operación. Inténtalo de nuevo.";
  if (code === "BOOKING_SERIES_INVALID" && message) return message;
  return SERIES_ERROR_MESSAGES[code];
}

// ── Ampliar y terminar ──────────────────────────────────────────────────────

/** Lo más lejos a lo que se puede ampliar: un año (364 días) desde hoy. */
export function extendMaxEndDate(today: string): string {
  return seriesMaxEndDate(today);
}

/** Hasta cuándo se propone ampliar: el 30 de junio siguiente al fin actual, sin pasar del máximo. */
export function defaultExtendEndDate(currentEnd: string, today: string): string {
  const june = defaultSeriesEndDate(currentEnd);
  const max = extendMaxEndDate(today);
  return june && june < max ? june : max;
}

/** Por qué no vale la nueva fecha de fin al ampliar (null si vale). */
export function extendEndDateError(currentEnd: string, newEnd: string, today: string): string | null {
  if (!DAY_KEY.test(newEnd)) return "Elige la nueva fecha de fin.";
  if (newEnd <= currentEnd) return `La nueva fecha tiene que ser posterior al ${shortDay(currentEnd)}.`;
  const max = extendMaxEndDate(today);
  if (newEnd > max) return `Se puede ampliar hasta el ${shortDay(max)} como máximo (un año desde hoy).`;
  return null;
}

/** Por qué no vale el día desde el que se termina (null si vale). */
export function endFromDateError(fromDay: string, today: string, seriesEnd: string): string | null {
  if (!DAY_KEY.test(fromDay)) return "Elige desde qué día termina.";
  if (fromDay < today) return "Solo se puede terminar desde hoy en adelante.";
  if (fromDay > seriesEnd) return `No hay reservas desde ese día: la reserva fija acaba el ${shortDay(seriesEnd)}.`;
  return null;
}

/** «Se han cancelado 5 reservas.» / «Se ha cancelado 1 reserva.» */
export function endSummary(cancelled: number): string {
  if (cancelled === 0) return "No se ha cancelado ninguna reserva.";
  return cancelled === 1 ? "Se ha cancelado 1 reserva." : `Se han cancelado ${cancelled} reservas.`;
}

/** «Reserva fija de Hugo · martes 19:30 · hasta el 30/6»: la línea de la ficha de una reserva. */
export function seriesNoticeText(s: Pick<SeriesView, "customerName" | "weekday" | "startTime" | "endDate">): string {
  return `Reserva fija de ${s.customerName ?? "un cliente"} · ${weekdayName(s.weekday).toLowerCase()} ${s.startTime} · hasta el ${shortDay(s.endDate)}`;
}
