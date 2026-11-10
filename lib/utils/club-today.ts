/**
 * Lo que la portada del gestor cuenta del día del club: la ocupación de hoy,
 * las próximas reservas y la lista de arranque de un club a medio configurar.
 * Las horas van en la zona del club, como el calendario.
 */

import { hhmmToMinutes, type DayWindow } from "@/lib/utils/booking-day-grid";
import { zonedDayKey, zonedMinutes } from "@/lib/utils/time-zone";
import type { CourtOccupation } from "@/types";
import type { ActivationState, Booking } from "@/types/bookings";

const DAY_MINUTES = 24 * 60;

export interface TodayOccupancy {
  /** Minutos de pista ocupados (reservas y bloqueos) dentro del horario. */
  occupiedMinutes: number;
  /** Minutos de pista abiertos: horario del día × pistas activas. */
  openMinutes: number;
  /** 0-100; null si el club está cerrado hoy o no tiene pistas activas. */
  percent: number | null;
}

type Span = [number, number];

/** Une tramos que se pisan (una reserva y un bloqueo en la misma pista no cuentan doble). */
function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out;
}

/**
 * Horas ocupadas frente a horas abiertas de hoy. Las canceladas no ocupan;
 * solo cuenta lo que cae dentro del horario de apertura y en pistas activas.
 * `occupations` son las de hoy (el back las devuelve por rango); se recortan
 * al día por si alguna lo cruza.
 */
export function todayOccupancy(params: {
  courtIds: string[];
  window: DayWindow | null;
  bookings: Booking[];
  occupations: CourtOccupation[];
  /** «YYYY-MM-DD» de hoy en la zona del club. */
  dayKey: string;
  timeZone: string;
}): TodayOccupancy {
  const { courtIds, window, bookings, occupations, dayKey, timeZone } = params;
  if (!window || courtIds.length === 0) return { occupiedMinutes: 0, openMinutes: 0, percent: null };
  const open = hhmmToMinutes(window.openTime);
  const close = hhmmToMinutes(window.closeTime);
  if (close <= open) return { occupiedMinutes: 0, openMinutes: 0, percent: null };

  const byCourt = new Map<string, Span[]>(courtIds.map((id) => [id, []]));
  const add = (courtId: string, startIso: string, endIso: string) => {
    const spans = byCourt.get(courtId);
    if (!spans) return;
    const startDay = zonedDayKey(startIso, timeZone);
    const endDay = zonedDayKey(endIso, timeZone);
    if (startDay > dayKey || endDay < dayKey) return;
    const start = startDay < dayKey ? 0 : zonedMinutes(startIso, timeZone);
    const end = endDay > dayKey ? DAY_MINUTES : zonedMinutes(endIso, timeZone);
    const from = Math.max(start, open);
    const to = Math.min(end, close);
    if (to > from) spans.push([from, to]);
  };
  for (const b of bookings) {
    if (b.status === "CANCELLED") continue;
    add(b.courtId, b.startsAt, b.endsAt);
  }
  for (const o of occupations) add(o.courtId, o.startsAt, o.endsAt);

  let occupiedMinutes = 0;
  for (const spans of byCourt.values()) {
    for (const [a, b] of mergeSpans(spans)) occupiedMinutes += b - a;
  }
  const openMinutes = (close - open) * courtIds.length;
  return { occupiedMinutes, openMinutes, percent: Math.round((occupiedMinutes / openMinutes) * 100) };
}

/** Las reservas de hoy que siguen en pie (sin canceladas). */
export function liveBookings(bookings: Booking[]): Booking[] {
  return bookings.filter((b) => b.status !== "CANCELLED");
}

/** Las próximas `limit` reservas que aún no han acabado, por hora de inicio. */
export function upcomingBookings(bookings: Booking[], nowMs: number, limit = 5): Booking[] {
  return liveBookings(bookings)
    .filter((b) => Date.parse(b.endsAt) > nowMs)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit);
}

export interface LaunchStep {
  key: "club" | "courts" | "hours" | "pricing" | "rules" | "activation";
  label: string;
  hint: string;
  href: string;
  ok: boolean;
}

/**
 * Los pasos para arrancar las reservas, con su estado. Reutiliza la
 * comprobación de Activación del back (`readiness`: pistas, horario,
 * duraciones y precios) y añade lo que ella no mira: los datos del club y las
 * normas. Sin datos aún (`null`), no se sabe nada y no hay lista.
 */
export function launchSteps(input: {
  activation: ActivationState | null | undefined;
  rulesMarkdown: string | null | undefined;
  clubPendingSetup: boolean | undefined;
}): LaunchStep[] | null {
  const { activation, rulesMarkdown, clubPendingSetup } = input;
  if (!activation) return null;
  // Con el módulo ya activado (o en pruebas) el back no manda `readiness`: no hay nada que arrancar
  if (activation.status !== "INACTIVE") return [];
  const check = (code: string) => activation.readiness?.checks.find((c) => c.code === code)?.ok ?? true;
  const pricingOk = check("COURT_DURATIONS") && check("COURT_PRICES");
  return [
    {
      key: "club", label: "Datos del club", ok: clubPendingSetup !== true,
      hint: "El nombre y la ciudad reales de tu club.", href: "/mi-club",
    },
    {
      key: "courts", label: "Pistas", ok: check("COURTS"),
      hint: "Da de alta al menos una pista activa.", href: "/mi-club/reservas/pistas",
    },
    {
      key: "hours", label: "Horario", ok: check("OPERATING_HOURS"),
      hint: "Los días y horas en que abre el club.", href: "/mi-club/reservas/horarios",
    },
    {
      key: "pricing", label: "Duraciones y precios", ok: pricingOk,
      hint: "Cuánto pueden durar las reservas y cuánto cuestan.",
      href: check("COURT_DURATIONS") ? "/mi-club/reservas/precios" : "/mi-club/reservas/pistas",
    },
    {
      key: "rules", label: "Normas del club", ok: !!rulesMarkdown?.trim(),
      hint: "El reglamento que aceptan los jugadores al reservar.", href: "/mi-club/reservas/normas",
    },
    {
      key: "activation", label: "Solicitar la activación", ok: !!activation.bookingActivationRequestedAt,
      hint: "Cuando lo demás esté listo, pídesela al equipo de AMT.", href: "/mi-club/reservas/activacion",
    },
  ];
}

/** Si falta algún paso (la lista de arranque sale en la portada). */
export function launchPending(steps: LaunchStep[] | null): boolean {
  return !!steps && steps.some((s) => !s.ok);
}

/** Jerga del feed de actividad a lenguaje del gestor. */
export function plainActivity(message: string): string {
  return message.replace(/\bbrackets?\b/gi, (m) => (m.toLowerCase().endsWith("s") ? "cuadros" : "cuadro"));
}
