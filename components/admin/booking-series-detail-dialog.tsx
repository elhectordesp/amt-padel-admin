"use client";

/**
 * Una reserva fija con todas sus reservas, por fecha: la pista (si alguna cayó en
 * otra, se ve), cómo va el cobro y el enlace a la ficha de cada una. Solo mira:
 * ampliar y terminar se hacen desde la lista.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { SeriesDialogShell } from "@/components/admin/booking-series-shell";
import { ErrorState } from "@/components/admin/error-state";
import { Button } from "@/components/ui/button";
import { bookingSeriesQK, bookingSeriesService } from "@/lib/services/booking-series";
import {
  SERIES_STATE_LABEL,
  bookingDayLabel,
  seriesBookingState,
  seriesRangeLabel,
  seriesSlotLabel,
  seriesState,
  seriesErrorText,
} from "@/lib/utils/booking-series";

const TONE = {
  paid:   "text-green-600 dark:text-green-400",
  unpaid: "font-medium text-red-600 dark:text-red-400",
  money:  "text-orange-600 dark:text-orange-400",
  muted:  "text-muted-foreground",
} as const;

export function SeriesDetailDialog({
  clubId,
  seriesId,
  timeZone,
  today,
  onClose,
}: {
  clubId: string;
  seriesId: string;
  timeZone: string;
  /** Hoy en el club, «YYYY-MM-DD». */
  today: string;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: bookingSeriesQK.detail(clubId, seriesId),
    queryFn: () => bookingSeriesService.detail(clubId, seriesId),
  });
  const s = query.data;

  return (
    <SeriesDialogShell
      title="Reserva fija"
      subtitle={s ? `${s.customerName ?? "Cliente"} · ${seriesSlotLabel(s)}` : undefined}
      wide
      onClose={onClose}
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {query.isLoading ? (
        <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
      ) : query.isError || !s ? (
        <ErrorState
          message={query.error ? seriesErrorText(query.error) : "No se pudo cargar la reserva fija."}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {s.courtName} · {seriesRangeLabel(s)} · {SERIES_STATE_LABEL[seriesState(s, today)]}
          </p>
          {s.bookings.length === 0 ? (
            <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
              Esta reserva fija no tiene ninguna reserva.
            </p>
          ) : (
            <ul aria-label="Reservas de la reserva fija" className="divide-y divide-border rounded-md border border-border bg-background text-sm">
              {s.bookings.map((b) => {
                const state = seriesBookingState(b);
                return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                    <span className="min-w-[6.5rem] font-medium tabular-nums">{bookingDayLabel(b.startsAt, timeZone)}</span>
                    <span className={b.courtId === s.courtId ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}>
                      {b.courtName}
                    </span>
                    <span className={`flex-1 ${TONE[state.tone]}`}>{state.text}</span>
                    <Link
                      href={`/mi-club/reservas/bookings/${b.id}`}
                      aria-label={`Abrir la reserva ${b.shortCode}`}
                      className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs hover:bg-muted max-[1024px]:h-11"
                    >
                      Abrir
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </SeriesDialogShell>
  );
}
