"use client";

/**
 * «Terminar» una reserva fija desde un día: primero una confirmación que explica
 * qué se cancela (las reservas de ese día en adelante que no tienen cobros ni
 * deuda) y qué no; después, el resultado, con las que se quedan y su enlace para
 * resolverlas a mano. Se monta solo mientras está abierto.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { SeriesDialogShell } from "@/components/admin/booking-series-shell";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Button } from "@/components/ui/button";
import {
  bookingSeriesQK,
  bookingSeriesService,
  type SeriesEndResult,
  type SeriesView,
} from "@/lib/services/booking-series";
import {
  bookingDayLabel,
  endFromDateError,
  endSummary,
  seriesErrorText,
  seriesSlotLabel,
  shortDay,
} from "@/lib/utils/booking-series";
import { addDaysToKey } from "@/lib/utils/time-zone";

const REASON_MAX = 500;

export function SeriesEndDialog({
  clubId,
  series,
  timeZone,
  today,
  onClose,
}: {
  clubId: string;
  series: SeriesView;
  timeZone: string;
  /** Hoy en el club, «YYYY-MM-DD». */
  today: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [fromDate, setFromDate] = useState(today);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<SeriesEndResult | null>(null);

  const dateError = endFromDateError(fromDate, today, series.endDate);

  const end = useMutation({
    mutationFn: () =>
      bookingSeriesService.end(clubId, series.id, { fromDate, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: (data) => setResult(data),
    onError: (err: unknown) => toast.error(seriesErrorText(err)),
    // Aunque falle, las listas se ponen al día: puede haber cancelado a medias
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["bookings", "list"] });
      void qc.invalidateQueries({ queryKey: bookingSeriesQK.all(clubId) });
    },
  });

  const left =
    series.upcomingCount === 0
      ? ""
      : ` Ahora le ${series.upcomingCount === 1 ? "queda 1 reserva" : `quedan ${series.upcomingCount} reservas`} por delante.`;

  if (result) {
    return (
      <SeriesDialogShell
        title="Reserva fija terminada"
        subtitle={`${series.customerName ?? "Cliente"} · ${seriesSlotLabel(series)}`}
        onClose={onClose}
        footer={
          <Button size="sm" onClick={onClose}>
            Entendido
          </Button>
        }
      >
        <p role="status" className="text-sm font-medium">
          {endSummary(result.cancelled)}
        </p>
        {result.kept.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {result.kept.length === 1
                ? "Esta reserva se queda porque tiene cobros o deuda. Resuélvela a mano desde su ficha:"
                : `Estas ${result.kept.length} reservas se quedan porque tienen cobros o deuda. Resuélvelas a mano desde su ficha:`}
            </p>
            <ul aria-label="Reservas que se quedan" className="divide-y divide-border rounded-md border border-border bg-background text-sm">
              {result.kept.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="font-medium tabular-nums">{bookingDayLabel(k.startsAt, timeZone)}</span>
                  <Link
                    href={`/mi-club/reservas/bookings/${k.id}`}
                    aria-label={`Abrir la reserva ${k.shortCode}`}
                    className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs hover:bg-muted max-[1024px]:h-11"
                  >
                    Abrir {k.shortCode}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No se ha quedado ninguna reserva con cobros o deuda.</p>
        )}
      </SeriesDialogShell>
    );
  }

  return (
    <ConfirmModal
      open
      danger
      title={`¿Terminar la reserva fija de ${series.customerName ?? "este cliente"}?`}
      description={`Se cancelan, desde el día que elijas, sus reservas que aún no han empezado y no tienen cobros ni deuda. Las que sí los tienen se quedan, y al terminar verás cuáles son. No se puede deshacer.${left}`}
      confirmLabel="Sí, terminar"
      cancelLabel="No, volver"
      loading={end.isPending}
      confirmDisabled={!!dateError}
      onClose={onClose}
      onConfirm={() => end.mutate()}
    >
      <label className="block">
        <span className="text-xs text-muted-foreground">Terminar desde el día</span>
        <input
          type="date"
          value={fromDate}
          min={today}
          max={series.endDate}
          onChange={(e) => setFromDate(e.target.value)}
          aria-invalid={!!dateError}
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm max-[1024px]:py-2.5"
        />
      </label>
      {dateError && (
        <p role="alert" className="text-xs text-destructive">
          {dateError}
        </p>
      )}
      {!dateError && (
        <p className="text-xs text-muted-foreground">
          Su última fecha pasará a ser el {shortDay(addDaysToKey(fromDate, -1))}.
        </p>
      )}
      <input
        type="text"
        aria-label="Motivo de la cancelación"
        placeholder="Motivo (opcional; por defecto «Fin de la reserva fija»)"
        maxLength={REASON_MAX}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm max-[1024px]:py-2.5"
      />
    </ConfirmModal>
  );
}
