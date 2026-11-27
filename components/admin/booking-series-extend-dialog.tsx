"use client";

/**
 * «Ampliar» una reserva fija: la nueva fecha de fin, las fechas nuevas con su
 * estado (sin crear nada) y, al confirmar, se crean. Mismo cliente, pista, hora
 * y duración. Se monta solo mientras está abierto.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SeriesPreviewPanel } from "@/components/admin/booking-series-preview";
import { SeriesDialogShell } from "@/components/admin/booking-series-shell";
import { Button } from "@/components/ui/button";
import { bookingSeriesQK, bookingSeriesService, type SeriesPreview, type SeriesView } from "@/lib/services/booking-series";
import {
  createButtonLabel,
  createdCount,
  defaultExtendEndDate,
  extendEndDateError,
  extendMaxEndDate,
  extendedMessage,
  seriesErrorText,
  seriesRangeLabel,
  seriesSlotLabel,
} from "@/lib/utils/booking-series";
import { addDaysToKey } from "@/lib/utils/time-zone";

export function SeriesExtendDialog({
  clubId,
  series,
  today,
  onClose,
}: {
  clubId: string;
  series: SeriesView;
  /** Hoy en el club, «YYYY-MM-DD». */
  today: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [endDate, setEndDate] = useState(() => defaultExtendEndDate(series.endDate, today));
  const [preview, setPreview] = useState<SeriesPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateError = extendEndDateError(series.endDate, endDate, today);

  const previewMut = useMutation({
    mutationFn: () => bookingSeriesService.extendPreview(clubId, series.id, endDate),
    onSuccess: (result) => {
      setError(null);
      setPreview(result);
    },
    onError: (err: unknown) => setError(seriesErrorText(err)),
  });

  const extend = useMutation({
    mutationFn: () => bookingSeriesService.extend(clubId, series.id, endDate),
    onSuccess: (result) => {
      toast.success(extendedMessage(result.occurrences));
      void qc.invalidateQueries({ queryKey: ["bookings", "list"] });
      void qc.invalidateQueries({ queryKey: bookingSeriesQK.all(clubId) });
      onClose();
    },
    onError: (err: unknown) => setError(seriesErrorText(err)),
  });

  const title = `Ampliar la reserva fija de ${series.customerName ?? "cliente"}`;
  const busy = previewMut.isPending || extend.isPending;

  if (preview) {
    const n = createdCount(preview.totals);
    return (
      <SeriesDialogShell
        title="Ampliar la reserva fija"
        subtitle="Revisa las fechas nuevas antes de crearlas"
        busy={busy}
        onClose={onClose}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPreview(null);
                setError(null);
              }}
              disabled={extend.isPending}
            >
              Atrás
            </Button>
            <Button size="sm" onClick={() => extend.mutate()} disabled={n === 0 || extend.isPending}>
              {extend.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {createButtonLabel(n)}
            </Button>
          </>
        }
      >
        <div className="text-sm">
          <p className="font-medium">{series.customerName ?? "Cliente"}</p>
          <p className="text-muted-foreground">
            {seriesSlotLabel(series)} · {series.courtName}
          </p>
          <p className="text-muted-foreground">
            {seriesRangeLabel({ startDate: series.startDate, endDate })}
          </p>
        </div>
        <SeriesPreviewPanel
          preview={preview}
          emptyHint="Ninguna de las fechas nuevas está libre. Vuelve atrás y prueba con otra fecha de fin."
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </SeriesDialogShell>
    );
  }

  return (
    <SeriesDialogShell
      title={title}
      subtitle={`${seriesSlotLabel(series)} · ${series.courtName}`}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => previewMut.mutate()} disabled={!!dateError || busy}>
            {previewMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Ver fechas
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{seriesRangeLabel(series)}. ¿Hasta cuándo la alargas?</p>
      <label className="block">
        <span className="text-xs text-muted-foreground">Nueva fecha de fin</span>
        <input
          type="date"
          value={endDate}
          min={addDaysToKey(series.endDate, 1)}
          max={extendMaxEndDate(today)}
          onChange={(e) => {
            setEndDate(e.target.value);
            setError(null);
          }}
          aria-invalid={!!dateError}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground max-[1024px]:py-2.5"
        />
      </label>
      {(dateError || error) && (
        <p role="alert" className="text-sm text-destructive">
          {dateError ?? error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Se añaden las semanas que faltan, a la misma hora y en la misma pista. Antes de crearlas verás cuáles están libres.
      </p>
    </SeriesDialogShell>
  );
}
