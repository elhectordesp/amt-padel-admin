"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { ErrorState } from "@/components/admin/error-state";
import { adminService } from "@/lib/services/admin";
import { useRestoreTournament } from "@/lib/use-restore-tournament";
import { TOURNAMENT_STATUS_LABEL } from "@/lib/constants";
import { formatDateRange } from "@/lib/utils/formatDateRange";
import { formatInTimeZone, DEFAULT_TIME_ZONE } from "@/lib/utils/time-zone";

export const DELETED_TOURNAMENTS_QK = ["tournaments", "deleted"] as const;

/**
 * Los torneos borrados, con «Restaurar» (decisión D12): borrar es lógico y el
 * aviso de borrar dice que se puede deshacer, pero el panel no tenía dónde.
 * Solo AMT (el back solo deja restaurar a AMT). Se cargan al abrir la sección.
 */
export function DeletedTournaments() {
  const [open, setOpen] = useState(false);

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: DELETED_TOURNAMENTS_QK,
    queryFn:  adminService.tournaments.deleted,
    enabled:  open,
  });

  const restore = useRestoreTournament();

  return (
    <details
      className="bg-card border border-border rounded-lg overflow-hidden"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
        <Trash2 size={14} /> Eliminados
      </summary>
      <div className="border-t border-border">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
        {isError && <ErrorState message="No se pudieron cargar los torneos eliminados." onRetry={() => void refetch()} />}
        {!isLoading && !isError && data.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay torneos eliminados.</p>
        )}
        {data.length > 0 && (
          <ul className="divide-y divide-border">
            {data.map((t) => (
              <li key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.club.name} · {formatDateRange(t.startDate, t.endDate)} · {TOURNAMENT_STATUS_LABEL[t.status] ?? t.status}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {/* El instante del borrado, en hora de España como el resto del historial */}
                    Eliminado el {formatInTimeZone(t.deletedAt, DEFAULT_TIME_ZONE, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restore.mutate(t.id)}
                  disabled={restore.isPending}
                  className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                >
                  {restore.isPending && restore.variables === t.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RotateCcw size={12} />}
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
