import type { OccupancyBand, OccupancyType } from "@/lib/services/club-occupancy";
import { addDaysToKey } from "@/lib/utils/time-zone";

/** Días máximos de un rango, como en el back. */
export const OCCUPANCY_MAX_DAYS = 366;

export type OccupancyPreset = "MONTH" | "QUARTER" | "CUSTOM";

export const OCCUPANCY_PRESETS: { value: OccupancyPreset; label: string }[] = [
  { value: "MONTH",   label: "Último mes" },
  { value: "QUARTER", label: "Último trimestre" },
  { value: "CUSTOM",  label: "Fechas" },
];

export const OCCUPANCY_TYPE_LABEL: Record<OccupancyType, string> = {
  BOOKING:  "Reservas",
  CONTRACT: "Contrato de pistas",
  CLASS:    "Clases",
  EVENT:    "Torneos y eventos",
};

export const OCCUPANCY_BAND_LABEL: Record<OccupancyBand, string> = {
  WEEKDAY_MORNING:   "L-V mañana (hasta las 14:00)",
  WEEKDAY_AFTERNOON: "L-V tarde (desde las 14:00)",
  WEEKEND:           "Fin de semana y festivos",
};

export const WEEKDAY_LABEL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/**
 * Colores de cada tipo en la barra: tonos de la paleta de Tailwind que se leen
 * sobre el fondo oscuro del panel y sobre uno claro; la leyenda y las cifras
 * dicen lo mismo con texto, así que no depende solo del color.
 */
export const OCCUPANCY_TYPE_BAR: Record<OccupancyType, string> = {
  BOOKING:  "bg-amber-500",
  CONTRACT: "bg-sky-500",
  CLASS:    "bg-emerald-500",
  EVENT:    "bg-violet-500",
};

/** El rango de un preajuste que acaba en `today`: 30 o 90 días contando hoy. */
export function presetRange(preset: "MONTH" | "QUARTER", today: string): { from: string; to: string } {
  return { from: addDaysToKey(today, preset === "MONTH" ? -29 : -89), to: today };
}

/** Días de un rango («AAAA-MM-DD», los dos incluidos); 0 si está al revés o falta alguno. */
export function rangeDays(from: string, to: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return 0;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Qué falla de un rango escrito a mano, o null si vale. */
export function rangeError(from: string, to: string): string | null {
  if (!from || !to) return "Elige las dos fechas";
  if (to < from) return "La fecha final no puede ser anterior a la inicial";
  if (rangeDays(from, to) > OCCUPANCY_MAX_DAYS) return `El rango no puede pasar de ${OCCUPANCY_MAX_DAYS} días`;
  return null;
}

const PCT = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/** «42,5 %». */
export function formatPct(pct: number): string {
  return `${PCT.format(pct)} %`;
}

/** Minutos de pista como horas: «12 h», «12 h 30 min», «45 min». */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
