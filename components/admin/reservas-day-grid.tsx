/**
 * ReservasDayGrid — vista diaria del calendario de reservas (horas × pistas).
 *
 * Rejilla de recepción: filas = franjas de 30 min desde la apertura hasta el
 * cierre, columnas = pistas. Cada reserva ocupa las franjas que dura. Un hueco
 * libre dentro del horario se pulsa para crear ahí la reserva (pista y hora
 * ya elegidas), salvo para quien solo lee. Lo que ocupa una pista sin ser una reserva (mantenimiento,
 * clase, partido de torneo, liga, evento, otro) sale con el color de su tipo;
 * un partido de torneo lleva al torneo.
 *
 * Horas en la zona del club (`timeZone`, la de `Club.timezone`, como el back
 * de reservas), no en la del navegador: la lógica está en
 * `lib/utils/booking-day-grid.ts`.
 *
 * Para recepción: enseña solo la mañana o la tarde si se pide, pinta la línea
 * de la hora actual (solo hoy) y, en el modo mostrador, franjas de 44 px
 * para el dedo.
 *
 * Cada bloque dice quién es el titular, si está cobrada o se debe, y las que
 * esperan invitaciones van con el borde discontinuo (leyenda debajo). Las de una
 * reserva fija llevan la marca «Fija». El enlace a la ficha lleva la vuelta a
 * este día y esta franja.
 */

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, CircleAlert, Repeat } from "lucide-react";
import { FixedBadge } from "@/components/admin/booking-fixed-badge";
import { BookingPartsDots, PartsLegendItems } from "@/components/admin/booking-parts-dots";
import { OccupationLegendItems } from "@/components/admin/occupation-legend";
import {
  buildDayGrid,
  minutesToHhmm,
  nowMarker,
  sliceDayGrid,
  type DayPeriod,
  type DayWindow,
} from "@/lib/utils/booking-day-grid";
import { bookingHolder, isUnpaid } from "@/lib/utils/booking-labels";
import { partsDebtLabel, partsOpenDebtCents } from "@/lib/utils/booking-parts";
import { isFixedBooking } from "@/lib/utils/booking-series";
import { occupationKindInfo } from "@/lib/utils/court-occupation";
import { activeParticipants, bookingCapacity } from "@/lib/utils/booking-participants";
import { zonedTime, zonedToDate } from "@/lib/utils/time-zone";
import type { Booking } from "@/types/bookings";
import type { Court, CourtOccupation } from "@/types";

interface Props {
  date: string; // "YYYY-MM-DD", día del club
  timeZone: string;
  courts: Court[]; // activas, en el orden del club
  bookings: Booking[]; // reservas de ese día
  occupations?: CourtOccupation[]; // bloqueos y partidos de torneo de ese día
  window: DayWindow | null; // horario del día; null = cerrado
  /** Sin él (quien solo lee las reservas) los huecos libres no se pulsan. */
  onSlotClick?: (args: { courtId: string; startsAtISO: string }) => void;
  /** Solo la mañana o la tarde (por defecto, el día entero). */
  period?: DayPeriod;
  /** Minutos desde las 00:00 del club ahora mismo, solo si `date` es hoy: la línea de la hora. */
  nowMinutes?: number | null;
  /** Modo mostrador (tablet): franjas de 44 px, lo mínimo para el dedo. */
  touch?: boolean;
}

export function ReservasDayGrid({
  date,
  timeZone,
  courts,
  bookings,
  occupations = [],
  window,
  onSlotClick,
  period = "todo",
  nowMinutes = null,
  touch = false,
}: Props) {
  // Hoy, la rejilla arranca en la hora actual (de noche, la apertura quedaba
  // lejos y la línea de ahora fuera de la vista)
  const nowRow = useRef<HTMLTableRowElement | null>(null);
  const isToday = nowMinutes !== null;
  useEffect(() => {
    if (isToday) nowRow.current?.scrollIntoView?.({ block: "center" });
  }, [date, isToday]);

  const fullGrid = buildDayGrid({ dayKey: date, courts, bookings, occupations, window, timeZone });

  if (!fullGrid) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        El club está cerrado este día.
      </div>
    );
  }

  const grid = sliceDayGrid(fullGrid, period);
  if (grid.rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Este día no hay franjas por la {period === "manana" ? "mañana" : "tarde"}.
      </div>
    );
  }

  const backHref = calendarDayHref(date, period);
  const now = nowMinutes === null ? null : nowMarker(grid.rows, nowMinutes);
  const nowLabel = nowMinutes === null ? "" : `Hora actual, ${minutesToHhmm(nowMinutes)}`;
  // Todas las franjas miden lo mismo, también las que solo tienen reservas
  // (que no empujan la altura de la fila)
  const slotHeight = touch ? "h-11" : "h-7 max-[1024px]:h-11";
  const slotLeading = touch ? "leading-11" : "leading-7 max-[1024px]:leading-11";

  return (
    <>
      {!window && (
        <p className="mb-2 text-xs text-muted-foreground">
          El club está cerrado este día; se ven solo las reservas que tiene.
        </p>
      )}
      <table className="w-full border-collapse text-xs">
        {/* En el modo mostrador la rejilla se desplaza por dentro: la cabecera
            de pistas se queda arriba, por encima de la columna de horas. Fuera
            de él no: se montaría sobre la cabecera del panel al bajar la página */}
        <thead>
          <tr>
            <th
              className={`sticky left-0 ${touch ? "top-0 z-30" : "z-10"} w-16 bg-background py-2 px-2 text-left font-medium text-muted-foreground`}
            >
              Hora
            </th>
            {courts.map((c) => (
              <th
                key={c.id}
                className={`${touch ? "sticky top-0 z-20 bg-background " : ""}min-w-[130px] border-l border-border py-2 px-3 text-left font-medium text-foreground`}
              >
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((t, row) => {
            const time = minutesToHhmm(t);
            const isHour = t % 60 === 0;
            // La línea de la hora actual pasa por esta franja: sus celdas la llevan
            const nowHere = now?.row === row ? now.offset : null;
            const lineCell = nowHere === null ? "" : "relative ";
            return (
              <tr key={t} ref={nowHere !== null ? nowRow : undefined}>
                <td
                  className={`sticky left-0 z-10 ${slotHeight} border-t border-border bg-background py-0 px-2 align-top tabular-nums ${
                    isHour ? "font-medium text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {time}
                  {nowHere !== null && <NowLine at={nowHere} label={nowLabel} />}
                </td>
                {courts.map((c) => {
                  const cell = grid.cells[c.id][row];
                  if (cell.kind === "covered") return null; // la tapa el rowSpan de arriba
                  if (cell.kind === "booking") {
                    // La línea cruza también la reserva, a su altura dentro del bloque
                    const nowInBooking =
                      now && now.row >= row && now.row < row + cell.span
                        ? (now.row - row + now.offset) / cell.span
                        : null;
                    return (
                      // relative: el bloque se estira a toda la celda (h-full dentro
                      // de un td con rowSpan no se resuelve y medían todos lo mismo)
                      <td
                        key={c.id}
                        rowSpan={cell.span}
                        className="relative border-t border-l border-border p-0 align-top"
                      >
                        <BookingBlock booking={cell.booking} timeZone={timeZone} backHref={backHref} />
                        {nowInBooking !== null && <NowLine at={nowInBooking} />}
                      </td>
                    );
                  }
                  if (cell.kind === "blocked") {
                    const o = cell.occupation;
                    const info = occupationKindInfo(o.kind);
                    // El texto solo en la primera franja del tramo
                    const above = row > 0 ? grid.cells[c.id][row - 1] : null;
                    const first = !(above?.kind === "blocked" && above.occupation === o);
                    const text = first ? `${info.label} · ${o.label}` : "";
                    const hours = `${zonedTime(o.startsAt, timeZone)}–${zonedTime(o.endsAt, timeZone)}`;
                    return (
                      <td
                        key={c.id}
                        className={`${lineCell}border-l border-border px-0 align-middle ${info.className} ${
                          first ? "border-t" : ""
                        }`}
                        title={`${info.label} · ${o.label} · ${hours}`}
                      >
                        {o.source === "MATCH" && o.tournamentId ? (
                          <Link
                            href={`/torneos/${o.tournamentId}`}
                            className={`block ${slotHeight} truncate px-2 ${slotLeading} underline-offset-2 hover:underline`}
                          >
                            {text}
                          </Link>
                        ) : (
                          <span className={`block ${slotHeight} truncate px-2 ${slotLeading}`}>{text}</span>
                        )}
                        {nowHere !== null && <NowLine at={nowHere} />}
                      </td>
                    );
                  }
                  if (!cell.bookable) {
                    return (
                      <td
                        key={c.id}
                        className={`${lineCell}border-t border-l border-border bg-muted/30`}
                        aria-label={`Fuera del horario, ${c.name} a las ${time}`}
                      >
                        {nowHere !== null && <NowLine at={nowHere} />}
                      </td>
                    );
                  }
                  return (
                    <td key={c.id} className={`${lineCell}border-t border-l border-border p-0 align-top`}>
                      {onSlotClick ? (
                        <button
                          type="button"
                          onClick={() => {
                            const startsAt = zonedToDate(`${date}T${time}`, timeZone);
                            if (startsAt) onSlotClick({ courtId: c.id, startsAtISO: startsAt.toISOString() });
                          }}
                          className={`group flex ${slotHeight} w-full items-center justify-center rounded-sm transition-colors hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary focus:outline-none`}
                          aria-label={`Crear reserva en ${c.name} a las ${time}`}
                        >
                          {/* Siempre a la vista, discreto: en táctil no hay hover
                              y el hueco parecía una celda vacía */}
                          <span className="text-sm text-muted-foreground/40 transition-colors group-hover:text-primary group-focus:text-primary">
                            +
                          </span>
                        </button>
                      ) : (
                        <div className={slotHeight} />
                      )}
                      {nowHere !== null && <NowLine at={nowHere} />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Legend showParts={bookings.some((b) => b.partsSummary != null)} showFixed={bookings.some(isFixedBooking)} />
    </>
  );
}

/** El calendario en este día y franja: a donde vuelve la ficha de una reserva. */
export function calendarDayHref(date: string, period: DayPeriod): string {
  const franja = period === "todo" ? "" : `&franja=${period}`;
  return `/mi-club/reservas/calendario?fecha=${date}${franja}`;
}

function Legend({ showParts, showFixed }: { showParts: boolean; showFixed: boolean }) {
  return (
    <ul aria-label="Leyenda" className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded-sm border border-blue-500/40 bg-blue-500/15" /> Confirmada
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded-sm border border-amber-500/40 bg-amber-500/15" /> Abierta
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded-sm border border-dashed border-blue-500 bg-blue-500/15" /> Esperando invitaciones
      </li>
      <li className="flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden /> Cobrada
      </li>
      <li className="flex items-center gap-1.5">
        <CircleAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden /> Sin cobrar
      </li>
      {showFixed && (
        <li className="flex items-center gap-1.5">
          <Repeat className="h-3.5 w-3.5" aria-hidden /> Fija: se repite cada semana
        </li>
      )}
      {showParts && (
        <li className="flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" aria-hidden /> Cobrada con partes a deber
        </li>
      )}
      {showParts && <PartsLegendItems />}
      <OccupationLegendItems />
    </ul>
  );
}

/**
 * La línea de la hora actual dentro de una celda, a la altura `at` (0 arriba,
 * 1 abajo). Deja pasar los toques al hueco o a la reserva de debajo. Solo la
 * de la columna de horas se anuncia (con la hora); las demás son decorado.
 */
function NowLine({ at, label }: { at: number; label?: string }) {
  return (
    <div
      role={label ? "separator" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="pointer-events-none absolute inset-x-0 z-[1] h-0.5 -translate-y-1/2 bg-primary"
      style={{ top: `${at * 100}%` }}
    >
      {label && <span className="absolute -top-[3px] left-0 h-2 w-2 rounded-full bg-primary" />}
    </div>
  );
}

function BookingBlock({
  booking: b,
  timeZone,
  backHref,
}: {
  booking: Booking;
  timeZone: string;
  backHref: string;
}) {
  const players = activeParticipants(b);
  const isOpen = b.matchMode === "OPEN";
  const holder = bookingHolder(b);
  const unpaid = isUnpaid(b);
  const fixed = isFixedBooking(b);
  // Cobrada: con método de cobro y no pendiente (null: datos de cobro ya borrados)
  const owed = partsOpenDebtCents(b.partsSummary) > 0;
  const paid = !owed && b.paymentMethod !== null && b.paymentMethod !== "PENDING" && b.priceCents > 0;
  const people = isOpen ? `Abierta · ${players.length}/${bookingCapacity(b)}` : `${players.length} jug.`;
  const bg = isOpen
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
    : "bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25";
  // Esperando invitaciones: aún no es firme
  const border = b.status === "PENDING_INVITES" ? "border border-dashed border-current" : "";

  return (
    <Link
      href={`/mi-club/reservas/bookings/${b.id}?volver=${encodeURIComponent(backHref)}`}
      className={`absolute inset-0.5 flex flex-col justify-start gap-0.5 overflow-hidden rounded px-2 py-1 transition-colors ${bg} ${border}`}
      title={`${b.shortCode} · ${b.durationMinutes} min${holder ? ` · ${holder}` : ""}${fixed ? " · Reserva fija" : ""}`}
    >
      <span className="flex items-center justify-between gap-1 font-medium tabular-nums">
        <span>
          {zonedTime(b.startsAt, timeZone)}–{zonedTime(b.endsAt, timeZone)}
        </span>
        {unpaid && (
          <span title="Sin cobrar" className="text-red-600 dark:text-red-400">
            <CircleAlert className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Sin cobrar</span>
          </span>
        )}
        {owed && b.partsSummary && (
          <span title={partsDebtLabel(b.partsSummary)} className="text-orange-600 dark:text-orange-400">
            <CircleAlert className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{partsDebtLabel(b.partsSummary)}</span>
          </span>
        )}
        {paid && (
          <span title="Cobrada" className="text-green-600 dark:text-green-400">
            <Check className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Cobrada</span>
          </span>
        )}
      </span>
      <span className="flex items-center justify-between gap-1">
        <span className="min-w-0 truncate opacity-80">{holder ?? people}</span>
        {fixed && <FixedBadge className="bg-background/60" />}
      </span>
      {holder && !isOpen && <span className="truncate text-[11px] opacity-60">{people}</span>}
      {b.partsSummary && <BookingPartsDots summary={b.partsSummary} />}
    </Link>
  );
}
