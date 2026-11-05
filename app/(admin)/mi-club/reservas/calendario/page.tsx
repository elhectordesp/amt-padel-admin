/**
 * /mi-club/reservas/calendario — calendario operativo de reservas.
 *
 * Dos vistas:
 *  - DÍA: rejilla horas × pistas de un día. Click en hueco libre → crear reserva
 *    ahí mismo (pista + hora prefijadas). Es el flujo de recepción: se
 *    actualiza sola, marca la hora actual, filtra mañana/tarde (en la URL,
 *    `?franja=`) y tiene un modo mostrador a pantalla completa para tablet.
 *  - SEMANA: rejilla pistas × días (resumen). Click en reserva → detalle.
 *
 * Días y horas en la zona del club: las reservas van en hora de España
 * (Europe/Madrid, como el back), no en la del navegador.
 */

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
} from "lucide-react";
import { ReservasPage } from "@/components/admin/reservas-page";
import { Button } from "@/components/ui/button";
import { BookingCreateDialog, type BookingCreateInitial } from "@/components/admin/booking-create-dialog";
import { ReservasDayGrid } from "@/components/admin/reservas-day-grid";
import { adminService } from "@/lib/services/admin";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import { cn } from "@/lib/utils";
import {
  bookingsByCourtAndDay,
  dayRangeIso,
  parseDayPeriod,
  resolveDayWindow,
  weekDayKeys,
  type DayPeriod,
} from "@/lib/utils/booking-day-grid";
import { activeParticipants, bookingCapacity } from "@/lib/utils/booking-participants";
import {
  DEFAULT_TIME_ZONE,
  addDaysToKey,
  capitalizeFirst,
  formatDayKey,
  zonedDayKey,
  zonedMinutes,
  zonedTime,
} from "@/lib/utils/time-zone";
import type { Booking } from "@/types/bookings";
import type { Court } from "@/types";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
// Las reservas van en hora de España: el back las calcula en Europe/Madrid
const TZ = DEFAULT_TIME_ZONE;
type View = "day" | "week";

const CALENDAR_PATH = "/mi-club/reservas/calendario";
// Recepción tiene el día abierto: lo que reservan otros (la app, otro puesto) entra solo
const REFRESH_MS = 60_000;
// La línea de la hora actual avanza sola, y «hoy» cambia solo a medianoche
const CLOCK_TICK_MS = 30_000;

const PERIODS: { value: DayPeriod; label: string; title?: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "manana", label: "Mañana", title: "Antes de las 15:00" },
  { value: "tarde", label: "Tarde", title: "Desde las 15:00" },
];

function calendarHref(period: DayPeriod): string {
  return period === "todo" ? CALENDAR_PATH : `${CALENDAR_PATH}?franja=${period}`;
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
      <ReservasPage title="Calendario">
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </ReservasPage>
    );
  }

  return (
    <ReservasPage title="Calendario de reservas">
      {/* Día / Semana, en el contenido: la cabecera del panel va sola y a todo el ancho */}
      <div className="mt-2 inline-flex rounded-lg border border-border p-0.5">
        <ViewTab active={view === "day"} onClick={() => setView("day")} icon={<CalendarDays className="h-3.5 w-3.5" />}>
          Día
        </ViewTab>
        <ViewTab active={view === "week"} onClick={() => setView("week")} icon={<CalendarRange className="h-3.5 w-3.5" />}>
          Semana
        </ViewTab>
      </div>

      {/* Si fallan las pistas es un fallo de carga, no un club «sin pistas»;
          si falla un refresco, se siguen usando las que llegaron, con un aviso */}
      {view === "day" ? (
        // La franja sale de la URL (useSearchParams): sin Suspense, el build no prerenderiza la página
        <Suspense fallback={<Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />}>
          <DayView
            clubId={clubId}
            courts={courts}
            courtsLoading={courtsQuery.isLoading}
            courtsError={courtsQuery.isLoadingError}
            courtsRefreshError={courtsQuery.isRefetchError}
          />
        </Suspense>
      ) : (
        <WeekView
          clubId={clubId}
          courts={courts}
          courtsLoading={courtsQuery.isLoading}
          courtsError={courtsQuery.isLoadingError}
          courtsRefreshError={courtsQuery.isRefetchError}
        />
      )}
    </ReservasPage>
  );
}

// ── Vista DÍA ────────────────────────────────────────────────────────────────

function DayView({
  clubId,
  courts,
  courtsLoading,
  courtsError,
  courtsRefreshError,
}: {
  clubId: string;
  courts: Court[];
  courtsLoading: boolean;
  courtsError: boolean;
  courtsRefreshError: boolean;
}) {
  const now = useNow(CLOCK_TICK_MS);
  const todayKey = zonedDayKey(now, TZ);
  // null: hoy, y lo sigue siendo pasada la medianoche (la tablet de recepción se queda abierta)
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const dateStr = pickedDay ?? todayKey;
  const isToday = dateStr === todayKey;
  const goToDay = (key: string) => setPickedDay(key === todayKey ? null : key);

  // La franja va en la URL: recepción la deja fija y sobrevive a recargar.
  // Sin ir al servidor: Next sincroniza useSearchParams con replaceState
  const period = parseDayPeriod(useSearchParams().get("franja"));
  const choosePeriod = (p: DayPeriod) => window.history.replaceState(null, "", calendarHref(p));

  const counter = useCounterMode();
  // Modo mostrador: botones de 44 px, lo mínimo para el dedo
  const tapIcon = counter.on ? "size-11" : undefined;
  const tapText = counter.on ? "h-11 px-4" : undefined;

  // Abierto: con qué se abre el alta (null: cerrado)
  const [createInitial, setCreateInitial] = useState<BookingCreateInitial | null>(null);

  const range = useMemo(() => dayRangeIso(dateStr, dateStr, TZ), [dateStr]);

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
    // Lo que reservan otros entra solo. Mientras llega, se queda la rejilla
    // que había (con su scroll): un refresco no pasa por «cargando»
    refetchInterval: REFRESH_MS,
    // Al volver a la pestaña, siempre, aunque lo último tenga menos de 30 s
    refetchOnWindowFocus: "always",
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
  // Si falla un refresco (la tablet vuelve del reposo sin red), se sigue
  // viendo lo último que llegó, con un aviso, en vez de cambiar la rejilla
  // por un error: el error es solo para lo que no llegó a cargar
  const failed =
    courtsError ||
    hoursQuery.isLoadingError ||
    exceptionsQuery.isLoadingError ||
    bookingsQuery.isLoadingError;
  const refreshFailed =
    courtsRefreshError ||
    hoursQuery.isRefetchError ||
    exceptionsQuery.isRefetchError ||
    bookingsQuery.isRefetchError;

  return (
    <>
      {/* En modo mostrador, la vista del día tapa todo (también la barra lateral) */}
      <div
        className={
          counter.on ? "fixed inset-0 z-50 flex flex-col gap-3 bg-background p-3 sm:p-4" : undefined
        }
      >
        <div className={cn("flex flex-wrap items-center justify-between gap-3", !counter.on && "mt-4")}>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              className={tapIcon}
              onClick={() => goToDay(addDaysToKey(dateStr, -1))}
              aria-label="Día anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[11rem] text-center text-sm font-medium">
              {capitalizeFirst(formatDayKey(dateStr, { weekday: "long", day: "numeric", month: "short" }))}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              className={tapIcon}
              onClick={() => goToDay(addDaysToKey(dateStr, 1))}
              aria-label="Día siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            {!isToday && (
              <Button variant="ghost" size="sm" className={tapText} onClick={() => setPickedDay(null)}>
                Hoy
              </Button>
            )}
            <input
              type="date"
              aria-label="Elegir fecha"
              value={dateStr}
              onChange={(e) => {
                // Borrar la fecha no lleva a ningún día: se queda la que había
                if (e.target.value) goToDay(e.target.value);
              }}
              className={cn(
                "rounded-md border border-border bg-background px-2 text-sm text-foreground",
                counter.on ? "h-11" : "h-7",
              )}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Franja del día" className="inline-flex rounded-lg border border-border p-0.5">
              {PERIODS.map((p) => (
                <ViewTab
                  key={p.value}
                  active={period === p.value}
                  onClick={() => choosePeriod(p.value)}
                  title={p.title}
                  className={counter.on ? "min-h-11 px-4" : undefined}
                >
                  {p.label}
                </ViewTab>
              ))}
            </div>
            <Button size="sm" className={tapText} onClick={() => setCreateInitial({ date: dateStr })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Nueva reserva
            </Button>
            <Button variant="outline" size="sm" className={tapText} onClick={counter.on ? counter.exit : counter.enter}>
              {counter.on ? (
                <>
                  <Minimize2 className="mr-1.5 h-3.5 w-3.5" /> Salir del modo mostrador
                </>
              ) : (
                <>
                  <Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Modo mostrador
                </>
              )}
            </Button>
          </div>
        </div>

        {refreshFailed && (
          <p className={cn("text-xs text-amber-600 dark:text-amber-400", !counter.on && "mt-2")}>
            No se pudo actualizar el día; se ve lo último que llegó y se vuelve a intentar solo.
          </p>
        )}

        {/* En modo mostrador la rejilla se desplaza por dentro: la cabecera de
            pistas queda arriba y la columna de horas, a la izquierda */}
        <div className={counter.on ? "min-h-0 flex-1 overflow-auto" : "mt-4 overflow-x-auto"}>
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
              period={period}
              nowMinutes={isToday ? zonedMinutes(now, TZ) : null}
              touch={counter.on}
            />
          )}
        </div>
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
  courtsError,
  courtsRefreshError,
}: {
  clubId: string;
  courts: Court[];
  courtsLoading: boolean;
  courtsError: boolean;
  courtsRefreshError: boolean;
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Lunes a domingo de la semana, en días del club
  const weekKeys = useMemo(
    () => weekDayKeys(zonedDayKey(new Date(), TZ), weekOffset),
    [weekOffset],
  );
  const range = useMemo(() => dayRangeIso(weekKeys[0], weekKeys[6], TZ), [weekKeys]);

  const bookingsFilters = { clubId, ...range };
  const bookingsQuery = useQuery({
    queryKey: bookingsQK.bookingsAll(bookingsFilters),
    queryFn: () => bookingsService.bookings.listAll(bookingsFilters),
  });

  const bookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  // Las canceladas se ven tachadas, pero no cuentan como reservas de la semana
  const liveCount = bookings.filter((b) => b.status !== "CANCELLED").length;

  // Pista → día → reservas, por hora de inicio
  const grid = useMemo(() => bookingsByCourtAndDay(bookings, TZ), [bookings]);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
          {liveCount === 1 ? "1 reserva" : `${liveCount} reservas`} esta semana
        </div>
      </div>

      {/* Como en el día: un refresco que falla (al volver a la pestaña) no quita la semana */}
      {(courtsRefreshError || bookingsQuery.isRefetchError) && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          No se pudo actualizar la semana; se ve lo último que llegó.
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        {courtsLoading || bookingsQuery.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : courtsError || bookingsQuery.isLoadingError ? (
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
  title,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Recepción: reloj y modo mostrador ────────────────────────────────────────

/** La hora actual, puesta al día cada `everyMs`. */
function useNow(everyMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/**
 * Modo mostrador: la vista del día ocupa toda la pantalla, para la tablet de
 * recepción. Pide al navegador la pantalla completa de todo el documento (no
 * solo de la rejilla), para que el alta y los avisos, que se abren fuera de
 * ella, se sigan viendo; la vista ya tapa la barra lateral por sí misma, así
 * que sin la Fullscreen API (iPhone, un iframe sin permiso) el modo funciona
 * igual, con las barras del navegador a la vista. Se sale con el botón o con
 * Esc; también al irse de la página.
 */
function useCounterMode() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!on) return;
    // En pantalla completa, Esc la cierra el navegador: el modo se va con ella
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setOn(false);
    };
    // Sin pantalla completa, Esc no lo atiende nadie más
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setOn(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
      // Al salir del modo (con el botón o yéndose de la página), sin pantalla completa huérfana
      if (document.fullscreenElement) void document.exitFullscreen();
    };
  }, [on]);

  const enter = () => {
    setOn(true);
    const root = document.documentElement;
    if (document.fullscreenEnabled && typeof root.requestFullscreen === "function") {
      // Si el navegador la niega, el modo sigue sin ella: la vista ya tapa la barra lateral
      root.requestFullscreen().catch(() => undefined);
    }
  };

  return { on, enter, exit: () => setOn(false) };
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
