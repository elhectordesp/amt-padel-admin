/**
 * /mi-club/reservas/calendario — calendario operativo de reservas.
 *
 * Dos vistas:
 *  - DÍA: rejilla horas × pistas de un día. Click en hueco libre → crear reserva
 *    ahí mismo (pista + hora prefijadas). Es el flujo de recepción.
 *  - SEMANA: rejilla pistas × días (resumen). Click en reserva → detalle.
 *
 * Días y horas en la zona del club: las reservas van en hora de España
 * (Europe/Madrid, como el back), no en la del navegador.
 */

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { BookingCreateDialog, type BookingCreateInitial } from "@/components/admin/booking-create-dialog";
import { ReservasDayGrid } from "@/components/admin/reservas-day-grid";
import { adminService } from "@/lib/services/admin";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import { isoDayOfWeek, resolveDayWindow } from "@/lib/utils/booking-day-grid";
import { activeParticipants, bookingCapacity } from "@/lib/utils/booking-participants";
import {
  DEFAULT_TIME_ZONE,
  addDaysToKey,
  formatDayKey,
  startOfZonedDay,
  zonedDayKey,
  zonedTime,
} from "@/lib/utils/time-zone";
import type { Booking } from "@/types/bookings";
import type { Court } from "@/types";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
// Las reservas van en hora de España: el back las calcula en Europe/Madrid
const TZ = DEFAULT_TIME_ZONE;
type View = "day" | "week";

/** Desde las 00:00 del primer día hasta el final del último, en la zona del club. */
function dayRange(fromKey: string, toKey: string) {
  const start = startOfZonedDay(fromKey, TZ)!;
  const nextStart = startOfZonedDay(addDaysToKey(toKey, 1), TZ)!;
  return {
    fromDate: start.toISOString(),
    toDate: new Date(nextStart.getTime() - 1).toISOString(),
  };
}

export default function CalendarioPage() {
  const { role, clubId } = useRole();
  const [view, setView] = useState<View>("day");

  const courtsQuery = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId!),
    enabled: !!clubId && isClub(role),
  });
  // En el orden del club (el que da el back)
  const courts = useMemo(
    () => (courtsQuery.data ?? []).filter((c) => c.active),
    [courtsQuery.data],
  );

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Header title="Calendario de reservas" />
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <ViewTab active={view === "day"} onClick={() => setView("day")} icon={<CalendarDays className="h-3.5 w-3.5" />}>
            Día
          </ViewTab>
          <ViewTab active={view === "week"} onClick={() => setView("week")} icon={<CalendarRange className="h-3.5 w-3.5" />}>
            Semana
          </ViewTab>
        </div>
      </div>

      {view === "day" ? (
        <DayView clubId={clubId} courts={courts} courtsLoading={courtsQuery.isLoading} />
      ) : (
        <WeekView clubId={clubId} courts={courts} courtsLoading={courtsQuery.isLoading} />
      )}
    </div>
  );
}

// ── Vista DÍA ────────────────────────────────────────────────────────────────

function DayView({
  clubId,
  courts,
  courtsLoading,
}: {
  clubId: string;
  courts: Court[];
  courtsLoading: boolean;
}) {
  const [dayOffset, setDayOffset] = useState(0);
  // Abierto: con qué se abre el alta (null: cerrado)
  const [createInitial, setCreateInitial] = useState<BookingCreateInitial | null>(null);

  const dateStr = useMemo(
    () => addDaysToKey(zonedDayKey(new Date(), TZ), dayOffset),
    [dayOffset],
  );
  const range = useMemo(() => dayRange(dateStr, dateStr), [dateStr]);

  const hoursQuery = useQuery({
    queryKey: bookingsQK.operatingHours(clubId),
    queryFn: () => bookingsService.operatingHours.list(clubId),
  });

  const exceptionsQuery = useQuery({
    queryKey: bookingsQK.exceptions(clubId, dateStr, dateStr),
    queryFn: () =>
      bookingsService.exceptions.list(clubId, { fromDate: dateStr, toDate: dateStr }),
  });

  const bookingsFilters = { clubId, ...range };
  const bookingsQuery = useQuery({
    queryKey: bookingsQK.bookingsAll(bookingsFilters),
    queryFn: () => bookingsService.bookings.listAll(bookingsFilters),
  });

  const dayWindow = useMemo(
    () => resolveDayWindow(dateStr, hoursQuery.data ?? [], exceptionsQuery.data ?? []),
    [dateStr, hoursQuery.data, exceptionsQuery.data],
  );

  const loading =
    courtsLoading ||
    hoursQuery.isLoading ||
    exceptionsQuery.isLoading ||
    bookingsQuery.isLoading;
  const failed = hoursQuery.isError || exceptionsQuery.isError || bookingsQuery.isError;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setDayOffset((o) => o - 1)} aria-label="Día anterior">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[11rem] text-center text-sm font-medium capitalize">
            {formatDayKey(dateStr, { weekday: "long", day: "numeric", month: "short" })}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => setDayOffset((o) => o + 1)} aria-label="Día siguiente">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {dayOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setDayOffset(0)}>
              Hoy
            </Button>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateInitial({ date: dateStr })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nueva reserva
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : failed ? (
          <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-destructive">
            No se pudo cargar el día. Vuelve a intentarlo.
          </p>
        ) : courts.length === 0 ? (
          <EmptyCourts />
        ) : (
          <ReservasDayGrid
            date={dateStr}
            timeZone={TZ}
            courts={courts}
            bookings={bookingsQuery.data ?? []}
            window={dayWindow}
            onSlotClick={({ courtId, startsAtISO }) =>
              setCreateInitial({ courtId, date: dateStr, startsAt: startsAtISO })
            }
          />
        )}
      </div>

      {/* Se monta al abrir: cada alta empieza con lo elegido en la rejilla */}
      {createInitial && (
        <BookingCreateDialog
          open
          onClose={() => setCreateInitial(null)}
          clubId={clubId}
          initial={createInitial}
        />
      )}
    </>
  );
}

// ── Vista SEMANA (resumen) ───────────────────────────────────────────────────

function WeekView({
  clubId,
  courts,
  courtsLoading,
}: {
  clubId: string;
  courts: Court[];
  courtsLoading: boolean;
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Lunes a domingo de la semana, en días del club
  const weekKeys = useMemo(() => {
    const today = zonedDayKey(new Date(), TZ);
    const monday = addDaysToKey(today, 1 - isoDayOfWeek(today) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
  }, [weekOffset]);
  const range = useMemo(() => dayRange(weekKeys[0], weekKeys[6]), [weekKeys]);

  const bookingsFilters = { clubId, ...range };
  const bookingsQuery = useQuery({
    queryKey: bookingsQK.bookingsAll(bookingsFilters),
    queryFn: () => bookingsService.bookings.listAll(bookingsFilters),
  });

  const bookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);

  // Pista → día → reservas, por hora de inicio
  const grid = useMemo(() => {
    const map: Record<string, Record<string, Booking[]>> = {};
    for (const c of courts) map[c.id] = {};
    for (const b of [...bookings].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
      const dayKey = zonedDayKey(b.startsAt, TZ);
      if (!map[b.courtId]) map[b.courtId] = {};
      if (!map[b.courtId][dayKey]) map[b.courtId][dayKey] = [];
      map[b.courtId][dayKey].push(b);
    }
    return map;
  }, [courts, bookings]);

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setWeekOffset((o) => o - 1)} aria-label="Semana anterior">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm font-medium">
            {formatDayKey(weekKeys[0], { day: "numeric", month: "short" })}
            {" – "}
            {formatDayKey(weekKeys[6], { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => setWeekOffset((o) => o + 1)} aria-label="Semana siguiente">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Hoy
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {bookings.length} reservas esta semana
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        {courtsLoading || bookingsQuery.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : bookingsQuery.isError ? (
          <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-destructive">
            No se pudo cargar la semana. Vuelve a intentarlo.
          </p>
        ) : courts.length === 0 ? (
          <EmptyCourts />
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-32 bg-background py-2 px-3 text-left font-medium text-muted-foreground">
                  Pista
                </th>
                {weekKeys.map((key, i) => (
                  <th key={key} className="min-w-[120px] border-l border-border py-2 px-3 text-left font-medium text-muted-foreground">
                    {DAY_NAMES[i]}
                    <span className="ml-1 text-foreground">
                      {formatDayKey(key, { day: "numeric", month: "numeric" })}
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
                  {weekKeys.map((key) => {
                    const dayBookings = grid[c.id]?.[key] ?? [];
                    return (
                      <td key={key} className="border-t border-l border-border align-top p-1.5">
                        <div className="space-y-1">
                          {dayBookings.map((b) => (
                            <WeekBookingBlock key={b.id} booking={b} />
                          ))}
                          {dayBookings.length === 0 && (
                            <span className="block py-1 text-xs text-muted-foreground/40">—</span>
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
    </>
  );
}

// ── UI compartida ────────────────────────────────────────────────────────────

function ViewTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyCourts() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      Sin pistas activas. Crea pistas en{" "}
      <Link href="/mi-club" className="text-primary underline">
        Mi club
      </Link>
      .
    </div>
  );
}

function WeekBookingBlock({ booking: b }: { booking: Booking }) {
  const isOpen = b.matchMode === "OPEN";
  const isCancelled = b.status === "CANCELLED";
  const players = activeParticipants(b).length;
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
      <div className="font-medium">{zonedTime(b.startsAt, TZ)}</div>
      <div className="truncate opacity-70">
        {isOpen ? `${players}/${bookingCapacity(b)}` : `${players} jug.`}{" "}
        · {b.shortCode}
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
