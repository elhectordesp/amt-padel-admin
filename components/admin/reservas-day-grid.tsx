/**
 * ReservasDayGrid — vista diaria del calendario de reservas (horas × pistas).
 *
 * Rejilla de recepción: filas = franjas de 30 min desde la apertura hasta el
 * cierre, columnas = pistas. Cada reserva ocupa las franjas que dura. Un hueco
 * libre dentro del horario se pulsa para crear ahí la reserva (pista y hora
 * ya elegidas). Los bloqueos de pista (torneos) salen como «Bloqueada».
 *
 * Horas en la zona del club (`timeZone`, la de `Club.timezone`, como el back
 * de reservas), no en la del navegador: la lógica está en
 * `lib/utils/booking-day-grid.ts`.
 *
 * Para recepción: enseña solo la mañana o la tarde si se pide, pinta la línea
 * de la hora actual (solo hoy) y, en el modo mostrador, franjas de 44 px
 * para el dedo.
 */

"use client";

import Link from "next/link";
import {
  buildDayGrid,
  minutesToHhmm,
  nowMarker,
  sliceDayGrid,
  type DayPeriod,
  type DayWindow,
} from "@/lib/utils/booking-day-grid";
import { activeParticipants, bookingCapacity } from "@/lib/utils/booking-participants";
import { zonedTime, zonedToDate } from "@/lib/utils/time-zone";
import type { Booking } from "@/types/bookings";
import type { Court } from "@/types";

interface Props {
  date: string; // "YYYY-MM-DD", día del club
  timeZone: string;
  courts: Court[]; // activas, en el orden del club
  bookings: Booking[]; // reservas de ese día
  window: DayWindow | null; // horario del día; null = cerrado
  onSlotClick: (args: { courtId: string; startsAtISO: string }) => void;
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
  window,
  onSlotClick,
  period = "todo",
  nowMinutes = null,
  touch = false,
}: Props) {
  const fullGrid = buildDayGrid({ dayKey: date, courts, bookings, window, timeZone });

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

  const now = nowMinutes === null ? null : nowMarker(grid.rows, nowMinutes);
  const nowLabel = nowMinutes === null ? "" : `Hora actual, ${minutesToHhmm(nowMinutes)}`;
  // Todas las franjas miden lo mismo, también las que solo tienen reservas
  // (que no empujan la altura de la fila)
  const slotHeight = touch ? "h-11" : "h-7";
  const slotLeading = touch ? "leading-11" : "leading-7";

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
              <tr key={t}>
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
                        <BookingBlock booking={cell.booking} timeZone={timeZone} />
                        {nowInBooking !== null && <NowLine at={nowInBooking} />}
                      </td>
                    );
                  }
                  if (cell.kind === "blocked") {
                    return (
                      <td
                        key={c.id}
                        className={`${lineCell}border-t border-l border-border bg-muted/60 px-2 align-middle text-muted-foreground`}
                        title={cell.reason ?? undefined}
                      >
                        <span className={`block ${slotHeight} truncate ${slotLeading}`}>Bloqueada</span>
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
                      {nowHere !== null && <NowLine at={nowHere} />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
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

function BookingBlock({ booking: b, timeZone }: { booking: Booking; timeZone: string }) {
  const players = activeParticipants(b);
  const isOpen = b.matchMode === "OPEN";
  // Reserva por teléfono: el contacto va como invitado sin cuenta (en otro
  // modo, un invitado es un jugador más, no quien reserva)
  const contact =
    b.matchMode === "ADMIN_MANUAL"
      ? players.find((p) => !p.userId && p.guestName)?.guestName
      : undefined;
  const label = isOpen
    ? `Abierta · ${players.length}/${bookingCapacity(b)}`
    : contact ?? `${players.length} jug.`;
  const bg = isOpen
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
    : "bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25";

  return (
    <Link
      href={`/mi-club/reservas/bookings/${b.id}`}
      className={`absolute inset-0.5 flex flex-col justify-start gap-0.5 overflow-hidden rounded px-2 py-1 transition-colors ${bg}`}
      title={`${b.shortCode} · ${b.durationMinutes} min`}
    >
      <span className="font-medium tabular-nums">
        {zonedTime(b.startsAt, timeZone)}–{zonedTime(b.endsAt, timeZone)}
      </span>
      <span className="truncate opacity-80">{label}</span>
    </Link>
  );
}
