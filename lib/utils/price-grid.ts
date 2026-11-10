/**
 * Cuadrícula de precios de una pista: filas = franjas (nombre, horas, días),
 * columnas = duraciones, celdas = precio.
 *
 * La fuente de verdad sigue siendo CourtPriceSlot (uno por día × franja ×
 * duración). Estas funciones, puras, convierten entre los slots y la
 * cuadrícula sin perder nada: al cargar se agrupa, al guardar se expande.
 */

import type { ClubOperatingHours, CourtPriceSlot, PriceSlotInput } from "@/types/bookings";
import { centsToEurosText, eurosToCents, formatCents } from "./booking-price";

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKEND = [6, 7];
export const DAY_SHORT = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export interface GridRow {
  /** Identificador estable de la fila en pantalla (no se guarda). */
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  days: number[];
  /** Precio en euros tal cual se escribe, por duración; vacío = sin precio. */
  prices: Record<number, string>;
}

let seq = 0;
export function newRowId(): string {
  seq += 1;
  return `row-${seq}`;
}

function sortedUnique(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

/**
 * Agrupa los slots en filas. Clave de franja: (nombre, desde, hasta); dentro de
 * ella, los días que tienen el mismo mapa duración→precio forman una fila.
 */
export function slotsToRows(slots: CourtPriceSlot[]): GridRow[] {
  const bands = new Map<
    string,
    { label: string; startTime: string; endTime: string; byDay: Map<number, Map<number, number>> }
  >();
  for (const s of slots) {
    const label = s.label ?? "";
    const key = JSON.stringify([label, s.startTime, s.endTime]);
    let band = bands.get(key);
    if (!band) {
      band = { label, startTime: s.startTime, endTime: s.endTime, byDay: new Map() };
      bands.set(key, band);
    }
    let prices = band.byDay.get(s.dayOfWeek);
    if (!prices) {
      prices = new Map();
      band.byDay.set(s.dayOfWeek, prices);
    }
    prices.set(s.durationMinutes, s.priceCents);
  }

  const rows: GridRow[] = [];
  for (const band of bands.values()) {
    const byPrices = new Map<string, { days: number[]; prices: Record<number, string> }>();
    for (const [day, prices] of band.byDay) {
      const entries = [...prices.entries()].sort((a, b) => a[0] - b[0]);
      const sig = JSON.stringify(entries);
      let g = byPrices.get(sig);
      if (!g) {
        g = {
          days: [],
          prices: Object.fromEntries(entries.map(([d, c]) => [d, centsToEurosText(c)])),
        };
        byPrices.set(sig, g);
      }
      g.days.push(day);
    }
    for (const g of byPrices.values()) {
      rows.push({
        id: newRowId(),
        label: band.label,
        startTime: band.startTime,
        endTime: band.endTime,
        days: sortedUnique(g.days),
        prices: g.prices,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime) ||
      a.days[0] - b.days[0],
  );
}

export interface RowsToSlotsResult {
  /** Slots de lo que ya está bien escrito (sirve para avisar de huecos mientras se edita). */
  slots: PriceSlotInput[];
  /** Problemas que impiden guardar; vacío si se puede guardar. */
  errors: string[];
}

/** Cuadrícula → slots: uno por cada día × duración con precio. */
export function rowsToSlots(rows: GridRow[]): RowsToSlotsResult {
  const errors: string[] = [];
  const slots: PriceSlotInput[] = [];
  rows.forEach((r, i) => {
    const name = r.label.trim() ? `«${r.label.trim()}»` : `Franja ${i + 1}`;
    if (r.days.length === 0) errors.push(`${name}: elige al menos un día.`);
    if (!r.startTime || !r.endTime || r.startTime >= r.endTime) {
      errors.push(`${name}: la hora «Desde» debe ser anterior a «Hasta».`);
    }
    if (r.label.trim().length > 40) errors.push(`${name}: el nombre admite hasta 40 caracteres.`);
    const priced: [number, number][] = [];
    for (const [dur, text] of Object.entries(r.prices)) {
      if (text.trim() === "") continue;
      const cents = eurosToCents(text);
      if (cents === null) {
        errors.push(`${name}, ${dur} min: el precio no es válido (p. ej. 25 o 12,50).`);
        continue;
      }
      priced.push([Number(dur), cents]);
    }
    if (priced.length === 0) errors.push(`${name}: no tiene ningún precio.`);
    for (const day of sortedUnique(r.days)) {
      for (const [durationMinutes, priceCents] of priced) {
        slots.push({
          dayOfWeek: day,
          startTime: r.startTime,
          endTime: r.endTime,
          durationMinutes,
          priceCents,
          ...(r.label.trim() ? { label: r.label.trim() } : {}),
        });
      }
    }
  });
  return { slots, errors };
}

/** Texto de los días de una fila: «Laborables», «Fin de semana», «Todos» o «Lun, Mié». */
export function daysLabel(days: number[]): string {
  const d = sortedUnique(days);
  const same = (a: number[]) => a.length === d.length && a.every((x, i) => x === d[i]);
  if (same(ALL_DAYS)) return "Todos";
  if (same(WEEKDAYS)) return "Laborables";
  if (same(WEEKEND)) return "Fin de semana";
  return d.map((x) => DAY_SHORT[x]).join(", ");
}

/** Precio aproximado por jugador: entre 4 en dobles, entre 2 en individual. */
export function perPlayerText(priceEur: string, courtType: "SINGLES" | "DOUBLES" | undefined): string | null {
  const cents = eurosToCents(priceEur);
  if (cents === null || priceEur.trim() === "") return null;
  const players = courtType === "SINGLES" ? 2 : 4;
  return `≈ ${formatCents(Math.round(cents / players))} por jugador`;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Huecos de la cuadrícula: combinaciones día × duración sin ningún precio y,
 * si se conoce el horario de apertura, tramos del horario sin precio.
 */
export function findGaps(
  slots: PriceSlotInput[],
  durations: number[],
  hours?: ClubOperatingHours[],
): string[] {
  const gaps: string[] = [];
  const open = (day: number) =>
    hours ? hours.filter((h) => h.active && h.dayOfWeek === day) : null;

  for (const dur of [...durations].sort((a, b) => a - b)) {
    const noPrice = ALL_DAYS.filter((day) => {
      const o = open(day);
      if (o !== null && o.length === 0) return false; // el club cierra ese día
      return !slots.some((s) => s.dayOfWeek === day && s.durationMinutes === dur);
    });
    if (noPrice.length > 0) gaps.push(`${dur} min: sin precio ${daysLabel(noPrice) === "Todos" ? "ningún día" : `en ${daysLabel(noPrice)}`}.`);
  }

  if (hours) {
    for (const dur of durations) {
      for (const day of ALL_DAYS) {
        const own = slots
          .filter((s) => s.dayOfWeek === day && s.durationMinutes === dur)
          .map((s) => [toMin(s.startTime), toMin(s.endTime)] as const)
          .sort((a, b) => a[0] - b[0]);
        if (own.length === 0) continue; // ya salió como día sin precio
        for (const h of open(day) ?? []) {
          let cursor = toMin(h.openTime);
          const close = toMin(h.closeTime);
          const holes: string[] = [];
          for (const [s, e] of own) {
            if (s > cursor) holes.push(`${toHHMM(cursor)}-${toHHMM(Math.min(s, close))}`);
            cursor = Math.max(cursor, e);
            if (cursor >= close) break;
          }
          if (cursor < close) holes.push(`${toHHMM(cursor)}-${toHHMM(close)}`);
          const real = holes.filter((x) => {
            const [a, b] = x.split("-");
            return toMin(b) > toMin(a);
          });
          if (real.length > 0) {
            gaps.push(`${DAY_SHORT[day]}, ${dur} min: sin precio de ${real.join(" y ")}.`);
          }
        }
      }
    }
  }
  return gaps;
}

/** Duraciones del slot que la pista no ofrece (para avisar antes de guardar). */
export function durationsMissingIn(slots: PriceSlotInput[], offered: number[]): number[] {
  return sortedUnique(slots.map((s) => s.durationMinutes)).filter((d) => !offered.includes(d));
}
