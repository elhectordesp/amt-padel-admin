"use client";

/**
 * «Editar jornadas» de una liga: sus días de juego, que son de la semana (no
 * hay una jornada por fecha como en un torneo). Reemplaza todos los días, como
 * el editor de jornadas de los torneos, y solo se puede durante el montaje (el
 * back lo impide con la liga empezada).
 */
import { useState } from "react";
import { CalendarDays, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LeagueDaysEditor } from "@/components/admin/league-days-editor";
import { slotsToBlocks } from "@/components/admin/schedule-editor-dialog";
import { adminService } from "@/lib/services/admin";
import { DEFAULT_TOURNAMENT_DEFAULTS } from "@/lib/utils/tournament-options";
import { leagueDaysIssue, leagueDaysPayload, sortLeagueDays, type LeagueDayForm } from "@/lib/utils/league-days";
import type { TournamentScheduleDay } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  /** Los días guardados de la liga (los que no son semanales se ignoran). */
  initialDays: Pick<TournamentScheduleDay, "weekday" | "slots" | "maxUnavailableHours">[];
  onSaved?: () => void;
}

export function LeagueDaysDialog({ open, onClose, tournamentId, initialDays, onSaved }: Props) {
  const [days, setDays] = useState<LeagueDayForm[]>(() =>
    sortLeagueDays(
      initialDays
        .filter((d): d is typeof d & { weekday: number } => typeof d.weekday === "number")
        .map((d) => ({
          weekday: d.weekday,
          blocks: slotsToBlocks(d.slots),
          maxUnavailableSlots: d.maxUnavailableHours ?? 0,
        })),
    ),
  );
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const error = leagueDaysIssue(days);

  const submit = async () => {
    if (error) return;
    setSaving(true);
    try {
      await adminService.tournaments.updateSchedule(tournamentId, leagueDaysPayload(days));
      toast.success("Días de juego actualizados");
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "No se pudieron actualizar los días de juego");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#D4AF37]" />
            <h2 className="text-sm font-semibold text-foreground">Días de juego de la liga</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Elige los días de la semana en que se juega y a qué horas. Solo se puede editar mientras la liga no haya empezado.
            Al guardar se borra la disponibilidad que los jugadores hubieran indicado.
          </p>

          <LeagueDaysEditor
            days={days}
            onChange={setDays}
            newDayBlock={() => ({
              start: DEFAULT_TOURNAMENT_DEFAULTS.dayStartTime,
              end: DEFAULT_TOURNAMENT_DEFAULTS.dayEndTime,
            })}
          />

          {error && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={saving || !!error}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Guardar días
          </Button>
        </div>
      </div>
    </div>
  );
}
