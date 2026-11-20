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
 * Las dos pintan, además de las reservas, lo que ocupa cada pista (mantenimiento,
 * clase, partido de torneo, liga, evento, otro) con su color y su leyenda.
 *
 * Días y horas en la zona del club (`Club.timezone`, como el back), no en la
 * del navegador. Mientras no se sabe, el calendario carga.
 */

"use client";

import { Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import { ErrorState } from "@/components/admin/error-state";
import { ReservasPage } from "@/components/admin/reservas-page";
import { Button } from "@/components/ui/button";
import { BookingCreateDialog, type BookingCreateInitial } from "@/components/admin/booking-create-dialog";
import { ReservasDayGrid } from "@/components/admin/reservas-day-grid";
import { ShopSellButton } from "@/components/admin/shop-day-sales";
import { adminService } from "@/lib/services/admin";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
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
import { occupationKindInfo } from "@/lib/utils/court-occupation";
import { OccupationLegendItems } from "@/components/admin/occupation-legend";
import {
  addDaysToKey,
  capitalizeFirst,
  formatDayKey,
  zonedDayKey,
  zonedMinutes,
  zonedTime,
} from "@/lib/utils/time-zone";
import type { Booking } from "@/types/bookings";
import type { CourtOccupation } from "@/types";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
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

// La URL guarda la franja y, si no es hoy, el día: al volver de la ficha de una
// reserva, el calendario está donde estaba
function calendarHref(period: DayPeriod, day: string | null): string {
  const params = [day && `fecha=${day}`, period !== "todo" && `franja=${period}`].filter(Boolean);
  return params.length === 0 ? CALENDAR_PATH : `${CALENDAR_PATH}?${params.join("&")}`;
}

/** El día de `?fecha=` si es una fecha válida (AAAA-MM-DD). */
function dayFromParam(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

export default function CalendarioPage() {
  const { role, clubId } = useRole();
  const [view, setView] = useState<View>("day");
  const clubTimeZone = useClubTimeZone(clubId, isClub(role));

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

      {/* Sin la zona del club no hay «hoy» ni horas que pintar: se carga.
          Si fallan las pistas es un fallo de carga, no un club «sin pistas»;
          si falla un refresco, se siguen usando las que llegaron, con un aviso */}
      {clubTimeZone.isError ? (
        <ErrorState
          message="No se pudieron cargar los datos del club."
          onRetry={() => void clubTimeZone.refetch()}
        />
      ) : !clubTimeZone.timeZone ? (
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />
      ) : view === "day" ? (
        // La franja sale de la URL (useSearchParams): sin Suspense, el build no prerenderiza la página
        <Suspense fallback={<Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />}>
          <DayView clubId={clubId} timeZone={clubTimeZone.timeZone} />
        </Suspense>
      ) : (
        <WeekView clubId={clubId} timeZone={clubTimeZone.timeZone} />
      )}
    </ReservasPage>
  );
}

/**
 * Las pistas del club, en su orden (el que da el back), con los bloqueos de los
 * días que enseña la vista: la escuela crea uno por clase de toda la
 * temporada, y sin el rango llegarían todos. Al pasar de día o de semana se
 * quedan las de antes mientras llegan las nuevas (las pistas no cambian).
 */
function useCalendarCourts(clubId: string, fromDay: string, toDay: string) {
  const query = useQuery({
    queryKey: ["admin-courts", clubId, fromDay, toDay],
    queryFn: () => adminService.courts.list(clubId, { from: fromDay, to: toDay }),
    placeholderData: keepPreviousData,
  });
  const courts = useMemo(() => (query.data ?? []).filter((c) => c.active), [query.data]);
  return {
    courts,
    courtsLoading: query.isLoading,
    courtsError: query.isLoadingError,
    courtsRefreshError: query.isRefetchError,
  };
}

// ── Vista DÍA ────────────────────────────────────────────────────────────────

function DayView({ clubId, timeZone }: { clubId: string; timeZone: string }) {
  const now = useNow(CLOCK_TICK_MS);
  const todayKey = zonedDayKey(now, timeZone);
  // null: hoy, y lo sigue siendo pasada la medianoche (la tablet de recepción se queda abierta)
  // La franja y el día (si no es hoy) van en la URL: recepción deja la franja
  // fija, sobrevive a recargar y la ficha de una reserva vuelve a este día.
  // Sin ir al servidor: Next sincroniza useSearchParams con replaceState
  const searchParams = useSearchParams();
  const period = parseDayPeriod(searchParams.get("franja"));
  const [pickedDay, setPickedDay] = useState<string | null>(() => {
    const fromUrl = dayFromParam(searchParams.get("fecha"));
    return fromUrl === todayKey ? null : fromUrl;
  });
  const dateStr = pickedDay ?? todayKey;
  const isToday = dateStr === todayKey;
  const showDay = (day: string | null) => {
    setPickedDay(day);
    window.history.replaceState(null, "", calendarHref(period, day));
  };
  const goToDay = (key: string) => showDay(key === todayKey ? null : key);
  const choosePeriod = (p: DayPeriod) => window.history.replaceState(null, "", calendarHref(p, pickedDay));

  // Quien solo lee las reservas no crea: ni botón, ni huecos que pulsar, ni alta
  const canCreate = useClubAccess().can("bookings", "write");

  // Abierto: con qué se abre el alta (null: cerrado)
  // «Nueva reserva» de la portada llega con ?nueva=1: el alta se abre sola
  const [openedInitial, setCreateInitial] = useState<BookingCreateInitial | null>(() =>
    searchParams.get("nueva") === "1" ? {} : null,
  );
  const createInitial = canCreate ? openedInitial : null;

  // La vista del día y el botón que abre y cierra el modo mostrador (el foco va y vuelve)
  const viewRef = useRef<HTMLDivElement>(null);
  const counterButtonRef = useRef<HTMLButtonElement>(null);
  const counter = useCounterMode(viewRef, counterButtonRef, createInitial !== null);
  // Modo mostrador: botones de 44 px, lo mínimo para el dedo
  const tapIcon = counter.on ? "size-11" : undefined;
  const tapText = counter.on ? "h-11 px-4" : undefined;

  const range = useMemo(() => dayRangeIso(dateStr, dateStr, timeZone), [dateStr, timeZone]);
  const { courts, courtsLoading, courtsError, courtsRefreshError } = useCalendarCourts(clubId, dateStr, dateStr);

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

  // Bloqueos y partidos de torneo del día, para que se vea todo lo que ocupa cada pista
  const occupationsQuery = useQuery({
    queryKey: bookingsQK.occupations(clubId, range.fromDate, range.toDate),
    queryFn: () => bookingsService.occupations.list(clubId, { from: range.fromDate, to: range.toDate }),
    refetchInterval: REFRESH_MS,
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
    bookingsQuery.isLoading ||
    occupationsQuery.isLoading;
  // Si falla un refresco (la tablet vuelve del reposo sin red), se sigue
  // viendo lo último que llegó, con un aviso, en vez de cambiar la rejilla
  // por un error: el error es solo para lo que no llegó a cargar
  const failed =
    courtsError ||
    hoursQuery.isLoadingError ||
    exceptionsQuery.isLoadingError ||
    bookingsQuery.isLoadingError ||
    occupationsQuery.isLoadingError;
  const refreshFailed =
    courtsRefreshError ||
    hoursQuery.isRefetchError ||
    exceptionsQuery.isRefetchError ||
    bookingsQuery.isRefetchError ||
    occupationsQuery.isRefetchError;

  return (
    // En modo mostrador, la vista del día tapa todo (también la barra
    // lateral) y es un diálogo modal: el foco entra en ella al abrirlo
    <div
      ref={viewRef}
      role={counter.on ? "dialog" : undefined}
      aria-modal={counter.on ? true : undefined}
      aria-label={counter.on ? "Modo mostrador" : undefined}
      tabIndex={counter.on ? -1 : undefined}
      className={
        counter.on
          ? "fixed inset-0 z-50 flex flex-col gap-3 bg-background p-3 outline-none sm:p-4"
          : undefined
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
            <Button variant="ghost" size="sm" className={tapText} onClick={() => showDay(null)}>
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
          {canCreate && (
            <Button size="sm" className={tapText} onClick={() => setCreateInitial({ date: dateStr })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Nueva reserva
            </Button>
          )}
          <ShopSellButton clubId={clubId} className={tapText} />
          <Button
            ref={counterButtonRef}
            variant="outline"
            size="sm"
            className={tapText}
            onClick={counter.on ? counter.exit : counter.enter}
          >
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
            timeZone={timeZone}
            courts={courts}
            bookings={bookingsQuery.data ?? []}
            occupations={occupationsQuery.data ?? []}
            window={dayWindow}
            onSlotClick={
              canCreate
                ? ({ courtId, startsAtISO }) => setCreateInitial({ courtId, date: dateStr, startsAt: startsAtISO })
                : undefined
            }
            period={period}
            nowMinutes={isToday ? zonedMinutes(now, timeZone) : null}
            touch={counter.on}
          />
        )}
      </div>

      {/* Se monta al abrir: cada alta empieza con lo elegido en la rejilla.
          Va dentro de la vista: en modo mostrador, lo que queda fuera del
          diálogo modal no lo alcanza un lector de pantalla */}
      {createInitial && (
        <BookingCreateDialog
          open
          onClose={() => {
            setCreateInitial(null);
            // Sin ?nueva=1: recargar no vuelve a abrir el alta
            if (searchParams.get("nueva") === "1") window.history.replaceState(null, "", calendarHref(period, pickedDay));
          }}
          clubId={clubId}
          timeZone={timeZone}
          initial={createInitial}
        />
      )}
    </div>
  );
}

// ── Vista SEMANA (resumen) ───────────────────────────────────────────────────

function WeekView({ clubId, timeZone }: { clubId: string; timeZone: string }) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Lunes a domingo de la semana, en días del club
  const weekKeys = useMemo(
    () => weekDayKeys(zonedDayKey(new Date(), timeZone), weekOffset),
    [weekOffset, timeZone],
  );
  const range = useMemo(() => dayRangeIso(weekKeys[0], weekKeys[6], timeZone), [weekKeys, timeZone]);
  const { courts, courtsLoading, courtsError, courtsRefreshError } = useCalendarCourts(clubId, weekKeys[0], weekKeys[6]);

  const bookingsFilters = { clubId, ...range };
  const bookingsQuery = useQuery({
    queryKey: bookingsQK.bookingsAll(bookingsFilters),
    queryFn: () => bookingsService.bookings.listAll(bookingsFilters),
  });

  const occupationsQuery = useQuery({
    queryKey: bookingsQK.occupations(clubId, range.fromDate, range.toDate),
    queryFn: () => bookingsService.occupations.list(clubId, { from: range.fromDate, to: range.toDate }),
  });

  const bookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  // Pista → día → lo que la ocupa sin ser una reserva, por hora de inicio
  const occupationsGrid = useMemo(
    () => occupationsByCourtAndDay(occupationsQuery.data ?? [], timeZone),
    [occupationsQuery.data, timeZone],
  );
  // Las canceladas se ven tachadas, pero no cuentan como reservas de la semana
  const liveCount = bookings.filter((b) => b.status !== "CANCELLED").length;

  // Pista → día → reservas, por hora de inicio
  const grid = useMemo(() => bookingsByCourtAndDay(bookings, timeZone), [bookings, timeZone]);

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
      {(courtsRefreshError || bookingsQuery.isRefetchError || occupationsQuery.isRefetchError) && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          No se pudo actualizar la semana; se ve lo último que llegó.
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        {courtsLoading || bookingsQuery.isLoading || occupationsQuery.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : courtsError || bookingsQuery.isLoadingError || occupationsQuery.isLoadingError ? (
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
                    const dayOccupations = occupationsGrid[c.id]?.[key] ?? [];
                    return (
                      <td key={key} className="border-t border-l border-border align-top p-1.5">
                        <div className="space-y-1">
                          {dayOccupations.map((o) => (
                            <WeekOccupationBlock key={`${o.source}-${o.refId}-${o.startsAt}`} occupation={o} timeZone={timeZone} />
                          ))}
                          {dayBookings.map((b) => (
                            <WeekBookingBlock key={b.id} booking={b} timeZone={timeZone} />
                          ))}
                          {dayBookings.length === 0 && dayOccupations.length === 0 && (
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
      <ul aria-label="Leyenda" className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm border border-blue-500/40 bg-blue-500/15" /> Reserva
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm border border-amber-500/40 bg-amber-500/15" /> Reserva abierta
        </li>
        <OccupationLegendItems />
      </ul>
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
 *
 * Es un diálogo modal: al entrar, el foco va a la vista (`viewRef`) y, al
 * salir, vuelve al botón que lo abre y lo cierra (`buttonRef`). Los dos
 * los monta quien llama al hook.
 *
 * `dialogOpen`: el alta está abierta encima, y Esc es suyo.
 */
function useCounterMode(
  viewRef: React.RefObject<HTMLDivElement | null>,
  buttonRef: React.RefObject<HTMLButtonElement | null>,
  dialogOpen: boolean,
) {
  const [on, setOn] = useState(false);

  // Sin pantalla completa, Esc saca del modo salvo que sea de otro: ya
  // atendido, con el alta abierta o en un campo (p. ej. el selector de
  // fecha). Se lee al pulsar: rehacer el efecto saldría de la pantalla completa
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape" || document.fullscreenElement || e.defaultPrevented) return;
    if (dialogOpen || isEditableField(e.target)) return;
    setOn(false);
  });
  // Si se sale con el alta abierta (Esc cierra la pantalla completa), el foco se queda en ella
  const returnFocus = useEffectEvent((button: HTMLButtonElement) => {
    if (!dialogOpen) button.focus();
  });

  useEffect(() => {
    if (!on) return;
    // Siempre montados con la vista del día. El botón se guarda ya: al irse
    // de la página, su ref está vacía cuando se limpia el efecto
    const button = buttonRef.current!;
    viewRef.current!.focus();
    // En pantalla completa, Esc la cierra el navegador: el modo se va con ella
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setOn(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
      // Al salir del modo (con el botón o yéndose de la página), sin pantalla completa huérfana
      if (document.fullscreenElement) void document.exitFullscreen();
      returnFocus(button);
    };
  }, [on, viewRef, buttonRef]);

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

/** Un campo en el que se escribe o se elige: ahí Esc es del campo. */
function isEditableField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, select"))
  );
}

function EmptyCourts() {
  // Las pistas se crean en la configuración del club: quien no la escribe no tiene a dónde ir
  const canCreateCourts = useClubAccess().can("settings", "write");
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      Sin pistas activas.
      {canCreateCourts && (
        <>
          {" "}Crea pistas en{" "}
          <Link href="/mi-club" className="text-primary underline">
            Mi club
          </Link>
          .
        </>
      )}
    </div>
  );
}

/** Las ocupaciones por pista y por día del club, cada día por hora de inicio. */
function occupationsByCourtAndDay(
  occupations: CourtOccupation[],
  timeZone: string,
): Record<string, Record<string, CourtOccupation[]>> {
  const map: Record<string, Record<string, CourtOccupation[]>> = {};
  for (const o of [...occupations].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
    ((map[o.courtId] ??= {})[zonedDayKey(o.startsAt, timeZone)] ??= []).push(o);
  }
  return map;
}

function WeekOccupationBlock({ occupation: o, timeZone }: { occupation: CourtOccupation; timeZone: string }) {
  const info = occupationKindInfo(o.kind);
  const hours = `${zonedTime(o.startsAt, timeZone)}–${zonedTime(o.endsAt, timeZone)}`;
  const body = (
    <>
      <div className="font-medium tabular-nums">{hours}</div>
      <div className="truncate opacity-80">
        {info.label} · {o.label}
      </div>
    </>
  );
  const className = `block rounded px-2 py-1 text-xs ${info.className}`;
  const title = `${info.label} · ${o.label} · ${hours}`;
  return o.source === "MATCH" && o.tournamentId ? (
    <Link href={`/torneos/${o.tournamentId}`} className={`${className} transition-opacity hover:opacity-80`} title={title}>
      {body}
    </Link>
  ) : (
    <div className={className} title={title}>
      {body}
    </div>
  );
}

function WeekBookingBlock({ booking: b, timeZone }: { booking: Booking; timeZone: string }) {
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
      <div className="font-medium">{zonedTime(b.startsAt, timeZone)}</div>
      <div className="truncate opacity-70">
        {isOpen ? `${players}/${bookingCapacity(b)}` : `${players} jug.`}{" "}
        · {b.shortCode}
      </div>
    </Link>
  );
}
