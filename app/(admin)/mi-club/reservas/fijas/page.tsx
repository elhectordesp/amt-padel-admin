/**
 * /mi-club/reservas/fijas — las reservas fijas del club: el mismo hueco cada
 * semana para un cliente. Lista de las activas o las terminadas, con quién, qué
 * día y hora, en qué pista, de cuándo a cuándo y cuántas quedan. Cada una se
 * puede ver (con todas sus reservas), ampliar (más semanas) o terminar (cancela
 * las que quedan sin cobros). Se crean desde el calendario: «Repetir cada semana».
 *
 * El enlace de la ficha de una reserva llega con `?serie=<id>`: abre su detalle.
 */

"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, CalendarRange, Loader2, Repeat } from "lucide-react";
import { SeriesDetailDialog } from "@/components/admin/booking-series-detail-dialog";
import { SeriesEndDialog } from "@/components/admin/booking-series-end-dialog";
import { SeriesExtendDialog } from "@/components/admin/booking-series-extend-dialog";
import { ErrorState } from "@/components/admin/error-state";
import { ReservasPage } from "@/components/admin/reservas-page";
import { Button } from "@/components/ui/button";
import { bookingSeriesQK, bookingSeriesService, type SeriesView } from "@/lib/services/booking-series";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useRole, isClub } from "@/lib/use-role";
import {
  SERIES_STATE_LABEL,
  bookingDayLabel,
  canEndSeries,
  canExtendSeries,
  seriesErrorText,
  seriesRangeLabel,
  seriesSlotLabel,
  seriesState,
  upcomingText,
} from "@/lib/utils/booking-series";
import { zonedDayKey } from "@/lib/utils/time-zone";

const HOME = "/mi-club/reservas/fijas";

type Filter = "active" | "ended";

export default function ReservasFijasPage() {
  // El detalle se abre con ?serie= (useSearchParams): sin Suspense, el build no prerenderiza la página
  return (
    <Suspense fallback={<Loader2 className="m-6 h-5 w-5 animate-spin text-muted-foreground" />}>
      <ReservasFijas />
    </Suspense>
  );
}

function ReservasFijas() {
  const { role, clubId } = useRole();
  const router = useRouter();
  // Ampliar y terminar escriben reservas: son de quien escribe; quien solo lee ve la lista
  const canWrite = useClubAccess().can("bookings", "write");
  const clubTimeZone = useClubTimeZone(clubId, isClub(role));
  const timeZone = clubTimeZone.timeZone;
  const [filter, setFilter] = useState<Filter>("active");
  const searchParams = useSearchParams();
  const [viewId, setViewId] = useState<string | null>(searchParams.get("serie"));
  const [extending, setExtending] = useState<SeriesView | null>(null);
  const [ending, setEnding] = useState<SeriesView | null>(null);

  const query = useQuery({
    queryKey: bookingSeriesQK.list(clubId ?? "", filter),
    queryFn: () => bookingSeriesService.list(clubId!, filter),
    enabled: !!clubId && isClub(role),
  });

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isClub(role) || !clubId) {
    return (
      <ReservasPage title="Reservas fijas">
        <p className="mt-6 text-sm text-muted-foreground">Requiere usuario CLUB con club asignado.</p>
      </ReservasPage>
    );
  }
  // Sin la zona del club no se pinta ninguna fecha ni hora
  if (!timeZone) {
    return (
      <ReservasPage title="Reservas fijas">
        {clubTimeZone.isError ? (
          <ErrorState message="No se pudieron cargar los datos del club." onRetry={() => void clubTimeZone.refetch()} />
        ) : (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </ReservasPage>
    );
  }

  const today = zonedDayKey(new Date(), timeZone);
  const items = query.data ?? [];

  const closeView = () => {
    setViewId(null);
    // Si se llegó con ?serie=, se quita para que recargar no lo vuelva a abrir
    if (searchParams.get("serie")) router.replace(HOME);
  };

  return (
    <ReservasPage title="Reservas fijas">
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
          El mismo hueco cada semana para un cliente del club.
          {canWrite && " Se crean desde el calendario: elige el hueco y marca «Repetir cada semana»."}
        </p>
        {canWrite && (
          <Link
            href="/mi-club/reservas/calendario"
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted max-[1024px]:h-11"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Ir al calendario
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtro">
        <TabButton active={filter === "active"} onClick={() => setFilter("active")}>
          Activas
        </TabButton>
        <TabButton active={filter === "ended"} onClick={() => setFilter("ended")}>
          Terminadas
        </TabButton>
      </div>

      <div className="mt-3">
        {query.isError ? (
          <ErrorState
            message={seriesErrorText(query.error) || "No se pudieron cargar las reservas fijas."}
            onRetry={() => void query.refetch()}
          />
        ) : query.isLoading ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            <CalendarRange className="mx-auto mb-2 h-6 w-6 opacity-50" />
            {filter === "active"
              ? "Aún no hay reservas fijas. Créalas desde el calendario: elige el hueco y marca “Repetir cada semana”."
              : "No hay reservas fijas terminadas."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Titular</th>
                  <th className="px-3 py-2 font-medium">Día y hora</th>
                  <th className="px-3 py-2 font-medium">Pista</th>
                  <th className="px-3 py-2 font-medium">Fechas</th>
                  <th className="px-3 py-2 font-medium">Próximas</th>
                  <th className="px-3 py-2" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const state = seriesState(s, today);
                  return (
                    <tr key={s.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-2 align-top font-medium">{s.customerName ?? "—"}</td>
                      <td className="px-3 py-2 align-top tabular-nums">{seriesSlotLabel(s)}</td>
                      <td className="px-3 py-2 align-top">{s.courtName}</td>
                      <td className="px-3 py-2 align-top">
                        {seriesRangeLabel(s)}
                        {state !== "active" && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {SERIES_STATE_LABEL[state]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {upcomingText(s.upcomingCount)}
                        {s.nextStartsAt && (
                          <span className="block text-xs text-muted-foreground">
                            Siguiente: {bookingDayLabel(s.nextStartsAt, timeZone)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => setViewId(s.id)}>
                            Ver
                          </Button>
                          {canWrite && canExtendSeries(s, today) && (
                            <Button variant="outline" size="sm" onClick={() => setExtending(s)}>
                              <Repeat className="h-3.5 w-3.5" /> Ampliar
                            </Button>
                          )}
                          {canWrite && canEndSeries(s, today) && (
                            <Button variant="destructive" size="sm" onClick={() => setEnding(s)}>
                              Terminar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewId && (
        <SeriesDetailDialog clubId={clubId} seriesId={viewId} timeZone={timeZone} today={today} onClose={closeView} />
      )}
      {extending && (
        <SeriesExtendDialog clubId={clubId} series={extending} today={today} onClose={() => setExtending(null)} />
      )}
      {ending && (
        <SeriesEndDialog
          clubId={clubId}
          series={ending}
          timeZone={timeZone}
          today={today}
          onClose={() => setEnding(null)}
        />
      )}
    </ReservasPage>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-3 py-1.5 text-sm transition-colors max-[1024px]:py-2.5 ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
