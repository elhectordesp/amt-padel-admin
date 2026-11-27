import { api } from "@/lib/api";
import type { BookingPaymentMethod, BookingStatus } from "@/types/bookings";

/**
 * Reservas fijas: el mismo hueco cada semana para un cliente del club. Cada
 * fecha es una reserva normal; la serie solo las agrupa (`recurringGroupId` de
 * la reserva). Fechas «YYYY-MM-DD» y horas «HH:MM» en la zona del club;
 * instantes en ISO UTC.
 */

/** Lo que se pide para planificar (y crear) una reserva fija. */
export interface SeriesPlan {
  courtId:         string;
  clubCustomerId:  string;
  /** Primera fecha: de ella sale el día de la semana. */
  startDate:       string;
  /** Última fecha posible, inclusive (como mucho, startDate + 364 días). */
  endDate:         string;
  startTime:       string;
  durationMinutes: number;
}

export interface CreateSeriesPayload extends SeriesPlan {
  /** Hasta 500 caracteres; se copian a cada reserva. */
  notes?: string;
}

export type SeriesOccurrenceStatus = "FREE" | "OTHER_COURT" | "UNAVAILABLE";

/** Por qué una fecha no se puede crear. */
export type SeriesUnavailableReason = "CLUB_CLOSED" | "OUTSIDE_HOURS" | "TAKEN";

/** Una fecha del plan: libre en su pista, en otra pista o sin hueco. */
export interface SeriesOccurrence {
  date:       string;
  startsAt:   string;
  endsAt:     string;
  status:     SeriesOccurrenceStatus;
  /** Sin hueco (UNAVAILABLE): null. */
  courtId:    string | null;
  courtName:  string | null;
  priceCents: number | null;
  /** Solo si no se puede (UNAVAILABLE). */
  reason:     SeriesUnavailableReason | null;
}

export interface SeriesTotals {
  free:        number;
  otherCourt:  number;
  unavailable: number;
  /** Lo que suman las fechas que se crearían. */
  priceCents:  number;
}

/** Vista previa en seco: no escribe nada. */
export interface SeriesPreview {
  /** 1 = lunes … 7 = domingo. */
  weekday:     number;
  occurrences: SeriesOccurrence[];
  totals:      SeriesTotals;
}

/** Una reserva fija en la lista. */
export interface SeriesView {
  id:              string;
  courtId:         string;
  courtName:       string;
  clubCustomerId:  string;
  customerName:    string | null;
  weekday:         number;
  startTime:       string;
  durationMinutes: number;
  startDate:       string;
  endDate:         string;
  /** Cuándo se terminó antes de tiempo; null: sigue o llegó a su fin. */
  endedAt:         string | null;
  /** Sus reservas no canceladas que aún no han empezado. */
  upcomingCount:   number;
  nextStartsAt:    string | null;
}

/** Una reserva de la serie, en su detalle. */
export interface SeriesBookingRow {
  id:              string;
  shortCode:       string;
  startsAt:        string;
  endsAt:          string;
  courtId:         string;
  courtName:       string;
  status:          BookingStatus;
  paymentMethod:   BookingPaymentMethod | null;
  priceCents:      number;
  paidAmountCents: number | null;
  /** Algo cobrado o a deber: terminar la serie no la cancela. */
  hasMoney:        boolean;
}

export interface SeriesDetail extends SeriesView {
  bookings: SeriesBookingRow[];
}

/** Lo que de verdad se creó al crear o ampliar (las ocupadas entretanto salen sin hueco). */
export interface SeriesCreated {
  series:      SeriesView;
  occurrences: SeriesOccurrence[];
}

export interface SeriesEndResult {
  series:    SeriesView;
  cancelled: number;
  /** Las que tienen dinero (cobrado o a deber) y no se tocan. */
  kept:      { id: string; shortCode: string; startsAt: string }[];
}

export type SeriesStatusFilter = "active" | "ended" | "all";

export const bookingSeriesQK = {
  all:    (clubId: string) => ["booking-series", clubId] as const,
  list:   (clubId: string, status: SeriesStatusFilter) => ["booking-series", clubId, "list", status] as const,
  detail: (clubId: string, id: string) => ["booking-series", clubId, "detail", id] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/booking-series`;

// Crear, ampliar y terminar escriben una reserva por fecha (hasta 53) en una
// transacción: con los 10 s de siempre cortaría una petición que sí acaba
const WRITE_TIMEOUT_MS = 30_000;

export const bookingSeriesService = {
  preview: (clubId: string, plan: SeriesPlan) =>
    api.post<SeriesPreview>(`${base(clubId)}/preview`, plan).then((r) => r.data),

  create: (clubId: string, payload: CreateSeriesPayload) =>
    api.post<SeriesCreated>(base(clubId), payload, { timeout: WRITE_TIMEOUT_MS }).then((r) => r.data),

  list: (clubId: string, status: SeriesStatusFilter = "active") =>
    api.get<SeriesView[]>(base(clubId), { params: { status } }).then((r) => r.data ?? []),

  detail: (clubId: string, id: string) =>
    api.get<SeriesDetail>(`${base(clubId)}/${id}`).then((r) => r.data),

  /** Las fechas nuevas, de después del fin actual hasta `endDate`. No escribe. */
  extendPreview: (clubId: string, id: string, endDate: string) =>
    api.post<SeriesPreview>(`${base(clubId)}/${id}/extend-preview`, { endDate }).then((r) => r.data),

  extend: (clubId: string, id: string, endDate: string) =>
    api
      .post<SeriesCreated>(`${base(clubId)}/${id}/extend`, { endDate }, { timeout: WRITE_TIMEOUT_MS })
      .then((r) => r.data),

  /** Cancela, desde `fromDate`, las futuras sin dinero; las que tienen dinero se quedan. */
  end: (clubId: string, id: string, payload: { fromDate: string; reason?: string }) =>
    api.post<SeriesEndResult>(`${base(clubId)}/${id}/end`, payload, { timeout: WRITE_TIMEOUT_MS }).then((r) => r.data),
};
