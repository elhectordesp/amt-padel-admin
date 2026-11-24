import { api } from "@/lib/api";

/**
 * Ocupación de las pistas del club y efecto de un cambio de precios (F8, C4b).
 * Solo lectura, del área «accounts» y con el módulo «Cuentas» encendido (si no,
 * 403 ACCOUNTS_DISABLED). Los minutos son de tiempo de pista; los días
 * («AAAA-MM-DD») son del calendario del club; el dinero va en céntimos.
 */

export const OCCUPANCY_TYPES = ["BOOKING", "CONTRACT", "CLASS", "EVENT"] as const;
export type OccupancyType = (typeof OCCUPANCY_TYPES)[number];

export const OCCUPANCY_BANDS = ["WEEKDAY_MORNING", "WEEKDAY_AFTERNOON", "WEEKEND"] as const;
export type OccupancyBand = (typeof OCCUPANCY_BANDS)[number];

export interface OccupancyCell {
  openMinutes:     number;
  occupiedMinutes: number;
  /** 0-100, un decimal; 0 si no hubo tiempo abierto. */
  pct:             number;
  /** Minutos ocupados por tipo. */
  byType:          Record<OccupancyType, number>;
}

export interface Occupancy {
  from:      string;
  to:        string;
  totals:    OccupancyCell;
  byCourt:   (OccupancyCell & { courtId: string; name: string })[];
  byBand:    Record<OccupancyBand, OccupancyCell>;
  /** 24 elementos, de la hora 0 a la 23. */
  byHour:    (OccupancyCell & { hour: number })[];
  /** 7 elementos, de lunes (1) a domingo (7). */
  byWeekday: (OccupancyCell & { weekday: number })[];
}

export interface PriceMetrics {
  pct:                   number;
  openMinutes:           number;
  occupiedMinutes:       number;
  bookedHours:           number;
  openDays:              number;
  /** null si no hubo horas reservadas. */
  avgPricePerHourCents:  number | null;
  /** null si no hubo días abiertos. */
  bookedPerOpenDayCents: number | null;
}

export interface PriceSide {
  from:   string;
  to:     string;
  days:   number;
  total:  PriceMetrics;
  byBand: Record<OccupancyBand, PriceMetrics>;
}

export interface PriceChange {
  date:      string;
  before:    PriceSide;
  /** null si la fecha es futura: aún no hay «después». */
  after:     PriceSide | null;
  afterDays: number;
  /** Menos de 7 días después del cambio. */
  lowData:   boolean;
}

export const occupancyQK = {
  all:         (clubId: string) => ["club-occupancy", clubId] as const,
  range:       (clubId: string, from: string, to: string) => ["club-occupancy", clubId, "range", from, to] as const,
  priceChange: (clubId: string, date: string) => ["club-occupancy", clubId, "price-change", date] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/accounts/occupancy`;

export const occupancyService = {
  get: (clubId: string, from: string, to: string) =>
    api.get<Occupancy>(base(clubId), { params: { from, to } }).then((r) => r.data),
  priceChange: (clubId: string, date: string) =>
    api.get<PriceChange>(`${base(clubId)}/price-change`, { params: { date } }).then((r) => r.data),
};
