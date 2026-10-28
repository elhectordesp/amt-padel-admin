"use client";

/**
 * Resultado de una reserva en el panel del club (R2-7): el marcador, qué
 * jugadores forman cada equipo y, hasta 30 días después del partido, poner o
 * corregir el resultado. Lo que pone el club queda firme: los jugadores ya
 * no lo cambian.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import {
  clubCanEditResult,
  formatScore,
  parseScoreDraft,
  scoreDraftFrom,
  teamNames,
  type ScoreDraft,
} from "@/lib/utils/booking-result";
import { DEFAULT_TIME_ZONE, formatInTimeZone } from "@/lib/utils/time-zone";
import type { Booking } from "@/types/bookings";

const when = (iso: string) =>
  formatInTimeZone(iso, DEFAULT_TIME_ZONE, { dateStyle: "short", timeStyle: "short" });

export function BookingResultPanel({ booking: b }: { booking: Booking }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ScoreDraft | null>(null);
  const result = b.result ?? null;
  const team1 = teamNames(b, 1);
  const team2 = teamNames(b, 2);
  const canEdit = clubCanEditResult(b);

  const save = useMutation({
    mutationFn: (d: ScoreDraft) => {
      const parsed = parseScoreDraft(d);
      if ("error" in parsed) throw new Error(parsed.error);
      return bookingsService.bookings.setResult(b.id, parsed.payload);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: bookingsQK.bookingDetail(b.id) }),
        qc.invalidateQueries({ queryKey: ["bookings", "list"] }),
      ]);
      setDraft(null);
      toast.success("Resultado guardado");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "No se pudo guardar el resultado";
      toast.error(msg);
    },
  });

  return (
    <div className="space-y-3 text-sm">
      {team1.length > 0 && team2.length > 0 ? (
        <div className="space-y-0.5">
          <p><span className="text-muted-foreground">Equipo 1:</span> {team1.join(" y ")}</p>
          <p><span className="text-muted-foreground">Equipo 2:</span> {team2.join(" y ")}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Los equipos salen cuando hay 2 (individual) o 4 (dobles) jugadores con cuenta confirmados.
        </p>
      )}

      {result ? (
        <div className="space-y-1">
          <p className="text-base font-semibold tabular-nums">{formatScore(result)}</p>
          {result.winnerTeam && <p>Gana el equipo {result.winnerTeam}</p>}
          <p className="text-xs text-muted-foreground">
            {result.finalizedAt
              ? "Resultado firme: los jugadores ya no lo pueden cambiar."
              : b.resultEntryDeadlineAt
                ? `Los jugadores lo pueden cambiar hasta el ${when(b.resultEntryDeadlineAt)}.`
                : "Aún sin cerrar."}
            {result.processedLspaAt && " El SPA ya se calculó con este resultado."}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground">Sin resultado.</p>
      )}

      {canEdit && !draft && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDraft(scoreDraftFrom(result))}>
            <Pencil className="h-3.5 w-3.5" /> {result ? "Corregir resultado" : "Poner resultado"}
          </Button>
          {b.resultAdminDeadlineAt && (
            <span className="text-xs text-muted-foreground">
              Hasta el {when(b.resultAdminDeadlineAt)}
            </span>
          )}
        </div>
      )}

      {draft && (
        <form
          className="space-y-3 rounded-md border border-border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          {result?.processedLspaAt && (
            <p role="note" className="rounded bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
              El SPA ya se calculó con el resultado anterior: corregirlo no lo cambia hasta un recálculo.
            </p>
          )}
          <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2">
            <span />
            <span className="text-xs text-muted-foreground">Equipo 1</span>
            <span className="text-xs text-muted-foreground">Equipo 2</span>
            {([1, 2, 3] as const).map((n) => (
              <SetRow key={n} n={n} draft={draft} onChange={setDraft} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            El tercer set solo si van 1-1 (set normal o súper tie-break a 10).
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDraft(null)} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar resultado
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function SetRow({
  n,
  draft,
  onChange,
}: {
  n: 1 | 2 | 3;
  draft: ScoreDraft;
  onChange: (d: ScoreDraft) => void;
}) {
  const home = `set${n}Home` as const;
  const away = `set${n}Away` as const;
  const input = (key: keyof ScoreDraft, team: 1 | 2) => (
    <input
      type="text"
      inputMode="numeric"
      value={draft[key]}
      onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
      aria-label={`Set ${n}, juegos del equipo ${team}`}
      className="w-16 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums"
    />
  );
  return (
    <>
      <span className="text-xs text-muted-foreground">Set {n}</span>
      {input(home, 1)}
      {input(away, 2)}
    </>
  );
}
