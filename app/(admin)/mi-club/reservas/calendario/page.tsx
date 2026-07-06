/**
 * /mi-club/reservas/calendario — vista semanal de bookings por pista.
 *
 * Grid eje Y = pistas, eje X = días de la semana (lunes-domingo).
 * Cada bloque = booking. Click → detalle. Navegación: semana anterior/siguiente.
 */

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import { localDayKey } from "@/lib/utils/date-keys";
import type { Booking } from "@/types/bookings";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarioPage() {
  const { role, clubId } = useRole();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = semana actual, +1 = siguiente

  // Calcular lunes de la semana actual + offset
  const { mondayDate, sundayDate, weekDates } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // En JS getDay(): 0=domingo, 1=lunes... 6=sábado
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek - 1) + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    return { mondayDate: monday, sundayDate: sunday, weekDates: dates };
  }, [weekOffset]);

  const courtsQuery = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId!),
    enabled: !!clubId && isClub(role),
  });

  const bookingsQuery = useQuery({
    queryKey: bookingsQK.bookingsList({
      clubId: clubId ?? "",
      fromDate: mondayDate.toISOString(),
      toDate: sundayDate.toISOString(),
      limit: 200,
    }),
    queryFn: () =>
      bookingsService.bookings.list({
        clubId: clubId!,
        fromDate: mondayDate.toISOString(),
        toDate: sundayDate.toISOString(),
        limit: 200,
      }),
    enabled: !!clubId && isClub(role),
  });

  const courts = (courtsQuery.data ?? []).filter((c) => c.active);
  const bookings = bookingsQuery.data?.items ?? [];

  // Map court → date → bookings (debe estar antes de cualquier early return)
  const grid = useMemo(() => {
    const map: Record<string, Record<string, Booking[]>> = {};
    for (const c of courts) map[c.id] = {};
    for (const b of bookings) {
      // Convertir UTC → YYYY-MM-DD en hora LOCAL del navegador,
      // para que case con localDayKey() de las columnas weekDates.
      const dayKey = localDayKey(new Date(b.startsAt));
      if (!map[b.courtId]) map[b.courtId] = {};
      if (!map[b.courtId][dayKey]) map[b.courtId][dayKey] = [];
      map[b.courtId][dayKey].push(b);
    }
    return map;
  }, [courts, bookings]);

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isClub(role) || !clubId) {
    return (
      <div className="p-6">
        <BackLink />
        <Header title="Calendario" />
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BackLink />
      <Header title="Calendario semanal" />

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setWeekOffset((o) => o - 1)}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm font-medium">
            {mondayDate.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
            {" – "}
            {sundayDate.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label="Semana siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {weekOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(0)}
            >
              Hoy
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {bookings.length} reservas esta semana
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        {courtsQuery.isLoading || bookingsQuery.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : courts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Sin pistas activas. Crea pistas en{" "}
            <Link href="/mi-club" className="text-primary underline">
              Mi club
            </Link>
            .
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-32 bg-background py-2 px-3 text-left font-medium text-muted-foreground">
                  Pista
                </th>
                {weekDates.map((d, i) => (
                  <th
                    key={i}
                    className="min-w-[120px] border-l border-border py-2 px-3 text-left font-medium text-muted-foreground"
                  >
                    {DAY_NAMES[i]}
                    <span className="ml-1 text-foreground">
                      {d.getDate()}/{d.getMonth() + 1}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courts.map((c) => (
                <tr key={c.id}>
                  <td className="sticky left-0 z-10 border-t border-border bg-background py-3 px-3 align-top text-sm font-medium">
                    {c.name}
                  </td>
                  {weekDates.map((d, i) => {
                    const key = localDayKey(d);
                    const dayBookings = grid[c.id]?.[key] ?? [];
                    return (
                      <td
                        key={i}
                        className="border-t border-l border-border align-top p-1.5"
                      >
                        <div className="space-y-1">
                          {dayBookings
                            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                            .map((b) => (
                              <BookingBlock key={b.id} booking={b} />
                            ))}
                          {dayBookings.length === 0 && (
                            <span className="block py-1 text-xs text-muted-foreground/40">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BookingBlock({ booking: b }: { booking: Booking }) {
  const start = new Date(b.startsAt);
  const time = start.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isOpen = b.matchMode === "OPEN";
  const isCancelled = b.status === "CANCELLED";
  const bg = isCancelled
    ? "bg-muted text-muted-foreground line-through"
    : isOpen
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : "bg-blue-500/15 text-blue-600 dark:text-blue-400";
  return (
    <Link
      href={`/mi-club/reservas/bookings/${b.id}`}
      className={`block rounded px-2 py-1 text-xs transition-opacity hover:opacity-80 ${bg}`}
      title={`${b.shortCode} · ${b.matchMode} · ${b.status}`}
    >
      <div className="font-medium">{time}</div>
      <div className="truncate opacity-70">
        {isOpen
          ? `${b.participants?.length ?? 0}/4`
          : `${b.participants?.length ?? 0} jug.`}{" "}· {b.shortCode}
      </div>
    </Link>
  );
}

function BackLink() {
  return (
    <Link
      href="/mi-club/reservas"
      className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3" /> Volver a Reservas
    </Link>
  );
}
