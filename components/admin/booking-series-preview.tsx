"use client";

/**
 * Las fechas de una reserva fija antes de crearla (o de ampliarla): cada una con
 * su día, su estado y su precio, y debajo el resumen. Lo comparten el alta y
 * «Ampliar». Solo enseña: no escribe nada.
 */

import { CircleAlert } from "lucide-react";
import type { SeriesOccurrence, SeriesPreview } from "@/lib/services/booking-series";
import { createdCount, occurrenceDayLabel, occurrenceStatusText, previewSummary } from "@/lib/utils/booking-series";

const TONE: Record<SeriesOccurrence["status"], string> = {
  FREE:        "text-foreground",
  OTHER_COURT: "text-amber-700 dark:text-amber-400",
  UNAVAILABLE: "text-destructive",
};

export function SeriesPreviewPanel({ preview, emptyHint }: { preview: SeriesPreview; emptyHint: string }) {
  const n = createdCount(preview.totals);
  return (
    <div className="space-y-2">
      {preview.occurrences.length === 0 ? (
        <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          No hay ninguna fecha nueva entre esas dos fechas.
        </p>
      ) : (
        <ul aria-label="Fechas" className="divide-y divide-border rounded-md border border-border bg-background text-sm">
          {preview.occurrences.map((o) => (
            <li key={o.date} className="flex items-center justify-between gap-3 px-3 py-2.5 max-[1024px]:py-3">
              <span className="font-medium tabular-nums">{occurrenceDayLabel(o.date)}</span>
              <span className={`text-right ${TONE[o.status]}`}>{occurrenceStatusText(o)}</span>
            </li>
          ))}
        </ul>
      )}
      {preview.occurrences.length > 0 && (
        <p className="text-sm font-medium" aria-live="polite">
          {previewSummary(preview.totals)}
        </p>
      )}
      {preview.occurrences.length > 0 && n === 0 && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {emptyHint}
        </p>
      )}
    </div>
  );
}
