/**
 * El cuadro final de una liga: la eliminatoria con los N primeros de cada
 * grupo, según la clasificación. Nunca sale solo: lo pide el gestor, categoría
 * a categoría, cuando los grupos han acabado. Mientras quede algún partido de
 * grupos sin resultado el botón está desactivado y el motivo, a la vista.
 */
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LeagueStandingsGroup } from "@/components/admin/league-tabs";
import { categoryLabel } from "@/lib/category-gender";
import { adminService } from "@/lib/services/admin";
import { leagueFinalBlocker, leagueFinalState, maxQualifiersPerGroup } from "@/lib/utils/league-final";
import type { MatchResult, TournamentCategory } from "@/types";

type CategoryRef = Pick<TournamentCategory, "id" | "gender" | "level">;

interface Props {
  tournamentId: string;
  categories: readonly CategoryRef[];
  /** Todos los partidos de la liga. */
  matches: readonly MatchResult[];
  /** La clasificación de los grupos de cada categoría (por id). */
  standings: Record<string, LeagueStandingsGroup[] | undefined>;
  /** Sin permiso para cambiar los torneos, solo se ve cómo va. */
  canWrite: boolean;
}

function FinalCard({
  tournamentId,
  category,
  matches,
  groups,
  canWrite,
}: {
  tournamentId: string;
  category: CategoryRef;
  matches: readonly MatchResult[];
  groups: LeagueStandingsGroup[];
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const state = leagueFinalState(matches, category.id);
  const blocker = leagueFinalBlocker(state);

  // Cuántos pasan de cada grupo: lo que tengan los grupos (2 por defecto) sin pasar del grupo más pequeño
  const max = maxQualifiersPerGroup(groups.map((g) => g.rows.length));
  const [picked, setPicked] = useState<number | null>(null);
  const topN = Math.min(max, Math.max(1, picked ?? groups[0]?.qualifyCount ?? 2));
  const qualifiers = groups.reduce((sum, g) => sum + Math.min(topN, g.rows.length), 0);

  const generate = useMutation({
    mutationFn: () => adminService.tournaments.generateLeagueFinal(tournamentId, category.id, topN),
    onSuccess: (res) => {
      toast.success(`Cuadro final generado con ${res.qualifiers} parejas`);
      for (const key of ["bracket", "standings", "matches", "tournament"])
        void qc.invalidateQueries({ queryKey: [key, tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "No se pudo generar el cuadro final"),
  });

  const onGenerate = () => {
    if (
      state.hasFinal &&
      !window.confirm(
        "Se rehace el cuadro final con la clasificación de ahora. Los partidos conservan su fecha y su pista según su ronda y su posición en el cuadro. ¿Continuar?",
      )
    )
      return;
    generate.mutate();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{categoryLabel(category)}</h4>
          <p className="text-xs text-muted-foreground">
            {state.hasFinal
              ? "El cuadro final ya está generado (pestaña «Grupos»)."
              : "Todavía sin cuadro final."}
          </p>
        </div>

        {canWrite && state.hasGroups && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Pasan de cada grupo
              <select
                aria-label={`Pasan de cada grupo (${categoryLabel(category)})`}
                value={topN}
                onChange={(e) => setPicked(Number(e.target.value))}
                disabled={generate.isPending}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              >
                {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onGenerate}
              disabled={!!blocker || generate.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#C49F2A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generate.isPending ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
              {state.hasFinal ? "Rehacer cuadro final" : "Generar cuadro final"}
            </button>
          </div>
        )}
      </div>

      {blocker ? (
        <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          {blocker}
        </p>
      ) : (
        canWrite && (
          <p className="text-xs text-muted-foreground">
            Pasan los {topN} primeros de cada grupo: {qualifiers} parejas al cuadro.
          </p>
        )
      )}
    </div>
  );
}

export function LeagueFinalPanel({ tournamentId, categories, matches, standings, canWrite }: Props) {
  if (categories.length === 0) return null;
  return (
    <section aria-label="Cuadro final" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Cuadro final</h3>
        <p className="text-xs text-muted-foreground">
          La eliminatoria con los primeros de cada grupo según esta clasificación. No sale sola: se genera cuando acaban los grupos.
        </p>
      </div>
      {categories.map((c) => (
        <FinalCard
          key={c.id}
          tournamentId={tournamentId}
          category={c}
          matches={matches}
          groups={standings[c.id] ?? []}
          canWrite={canWrite}
        />
      ))}
    </section>
  );
}
