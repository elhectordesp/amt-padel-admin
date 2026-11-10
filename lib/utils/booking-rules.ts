/**
 * Reglas de reserva del club: «Reservas sin huecos» (modo estricto) y
 * «Antelación con arrastre». Las horas son «HH:mm» locales del club.
 */

import type { ClubBookingConfig } from "@/types/bookings";

export type BookingRulesForm = Pick<
  ClubBookingConfig,
  | "strictModeEnabled"
  | "strictFrom"
  | "strictTo"
  | "advanceRuleEnabled"
  | "advanceRuleFrom"
  | "advanceRuleTo"
  | "advanceRuleMinutes"
>;

/** Franja que se propone al activar una regla sin horas guardadas. */
export const DEFAULT_RULE_FROM = "17:00";
export const DEFAULT_RULE_TO = "22:00";

/** Ejemplo del modo estricto (fijo: enseña el caso, no depende de la franja). */
export const STRICT_EXAMPLE =
  "Con reservas de 10:00 a 11:30, nadie podrá reservar de 12:00 a 13:30: dejaría libre 11:30-12:00.";

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const toHhmm = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** «90» → «1 h 30 min»; «120» → «2 h»; «45» → «45 min». */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Ejemplo de una línea de la antelación con arrastre para la franja y los
 * minutos puestos: a qué hora hay que haber reservado para jugar a la primera
 * hora de la franja.
 */
export function advanceExample(from: string | null, minutes: number): string {
  const start = from && /^\d{2}:\d{2}$/.test(from) ? from : "12:00";
  const deadline = toMin(start) - minutes;
  const when =
    deadline >= 0
      ? `antes de las ${toHhmm(deadline)}`
      : `antes de las ${toHhmm(((deadline % 1440) + 1440) % 1440)} del día anterior`;
  return `Con ${formatMinutes(minutes)} de antelación, para jugar a las ${start} hay que reservar ${when}; apuntarse a un partido ya creado se puede hasta que empiece.`;
}

/** Mensaje si las reglas no son guardables (el back devuelve lo mismo con 400). */
export function rulesError(f: BookingRulesForm): string | null {
  const checks: [string, boolean, string | null, string | null][] = [
    ["Reservas sin huecos", f.strictModeEnabled, f.strictFrom, f.strictTo],
    ["Antelación con arrastre", f.advanceRuleEnabled, f.advanceRuleFrom, f.advanceRuleTo],
  ];
  for (const [name, enabled, from, to] of checks) {
    if (enabled && (!from || !to)) {
      return `${name}: indica la hora de inicio y la de fin de la franja.`;
    }
    if (from && to && toMin(from) >= toMin(to)) {
      return `${name}: la hora de inicio tiene que ser anterior a la de fin.`;
    }
  }
  if (f.advanceRuleMinutes < 0 || f.advanceRuleMinutes > 2880) {
    return "Antelación con arrastre: los minutos van de 0 a 2880.";
  }
  return null;
}
