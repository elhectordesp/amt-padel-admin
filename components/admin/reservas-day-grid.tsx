/**
 * ReservasDayGrid — vista diaria del calendario de reservas (horas × pistas).
 *
 * Rejilla de recepción: filas = franjas de 30 min desde la apertura hasta el
 * cierre, columnas = pistas. Cada reserva ocupa las franjas que dura. Un hueco
 * libre dentro del horario se pulsa para crear ahí la reserva (pista y hora
 * ya elegidas). Los bloqueos de pista (torneos) salen como «Bloqueada».
 *
 * Horas en la zona del club (Europe/Madrid, como el back de reservas), no en
 * la del navegador: la lógica está en `lib/utils/booking-day-grid.ts`.
 */

"use client";

import Link from "next/link";
import {
  buildDayGrid,
  minutesToHhmm,
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
}

export function ReservasDayGrid({
  date,
  timeZone,
  courts,
  bookings,
  window,
  onSlotClick,
}: Props) {
  const grid = buildDayGrid({ dayKey: date, courts, bookings, window, timeZone });

  if (!grid) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        El club está cerrado este día.
      </div>
    );
  }

  return (
    <>
      {!window && (
        <p className="mb-2 text-xs text-muted-foreground">
          El club está cerrado este día; se ven solo las reservas que tiene.
        </p>
      )}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-16 bg-background py-2 px-2 text-left font-medium text-muted-foreground">
              Hora
            </th>
            {courts.map((c) => (
              <th
                key={c.id}
                className="min-w-[130px] border-l border-border py-2 px-3 text-left font-medium text-foreground"
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
            return (
              <tr key={t}>
                <td
                  className={`sticky left-0 z-10 border-t border-border bg-background py-0 px-2 align-top tabular-nums ${
                    isHour ? "font-medium text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {time}
                </td>
                {courts.map((c) => {
                  const cell = grid.cells[c.id][row];
                  if (cell.kind === "covered") return null; // la tapa el rowSpan de arriba
                  if (cell.kind === "booking") {
                    return (
                      <td
                        key={c.id}
                        rowSpan={cell.span}
                        className="border-t border-l border-border p-1 align-top"
                      >
                        <BookingBlock booking={cell.booking} timeZone={timeZone} />
                      </td>
                    );
                  }
                  if (cell.kind === "blocked") {
                    return (
                      <td
                        key={c.id}
                        className="border-t border-l border-border bg-muted/60 px-2 align-middle text-muted-foreground"
                        title={cell.reason ?? undefined}
                      >
                        <span className="block h-7 truncate leading-7">Bloqueada</span>
                      </td>
                    );
                  }
                  if (!cell.bookable) {
                    return (
                      <td
                        key={c.id}
                        className="border-t border-l border-border bg-muted/30"
                        aria-label={`Fuera del horario, ${c.name} a las ${time}`}
                      />
                    );
                  }
                  return (
                    <td key={c.id} className="border-t border-l border-border p-0 align-top">
                      <button
                        type="button"
                        onClick={() => {
                          const startsAt = zonedToDate(`${date}T${time}`, timeZone);
                          if (startsAt) onSlotClick({ courtId: c.id, startsAtISO: startsAt.toISOString() });
                        }}
                        className="group flex h-7 w-full items-center justify-center rounded-sm transition-colors hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary focus:outline-none"
                        aria-label={`Crear reserva en ${c.name} a las ${time}`}
                      >
                        <span className="text-sm opacity-0 group-hover:opacity-100 group-focus:opacity-100">
                          +
                        </span>
                      </button>
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
      className={`flex h-full min-h-[1.75rem] flex-col justify-start gap-0.5 rounded px-2 py-1 transition-colors ${bg}`}
      title={`${b.shortCode} · ${b.durationMinutes} min`}
    >
      <span className="font-medium tabular-nums">
        {zonedTime(b.startsAt, timeZone)}–{zonedTime(b.endsAt, timeZone)}
      </span>
      <span className="truncate opacity-80">{label}</span>
    </Link>
  );
}
