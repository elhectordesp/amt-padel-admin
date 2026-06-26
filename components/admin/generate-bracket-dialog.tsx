/**
 * GenerateBracketDialog — Modal de generación del cuadro (Bloque 1).
 *
 * Permite al admin configurar todas las opciones antes de crear el bracket
 * (formato, nº de grupos o tamaño grupo, top N, ronda inicial elim, seeding)
 * y ver una vista previa en vivo que refleja los cambios.
 *
 * Cuando confirma, llama a generateBracket con los params elegidos.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  GitBranch,
  Loader2,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  adminService,
  type BracketGenerationOptions,
} from "@/lib/services/admin";

type Format = "grupos+eliminatoria" | "solo-eliminatoria";
type DistMode = "byCount" | "bySize";
type AutoOrNumber = "auto" | number;
type AutoOrRound = "auto" | "R16" | "QF" | "SF" | "F";

interface PreviewResp {
  isGroups: boolean;
  groups: { name: string; pairs: unknown[] }[];
  totalPairs: number;
  totalMatches: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  categoryId: string;
  categoryLabel: string;
  totalConfirmedPairs: number;
  /** True si la categoría ya tiene cuadro generado → usaremos regenerateBracket */
  alreadyHasBracket?: boolean;
  onGenerated?: () => void;
}

const ROUND_LABELS: Record<Exclude<AutoOrRound, "auto">, string> = {
  R16: "Octavos de final",
  QF: "Cuartos de final",
  SF: "Semifinales",
  F: "Final",
};
const ROUND_SIZES: Record<Exclude<AutoOrRound, "auto">, number> = {
  R16: 16,
  QF: 8,
  SF: 4,
  F: 2,
};

export function GenerateBracketDialog({
  open,
  onClose,
  tournamentId,
  categoryId,
  categoryLabel,
  totalConfirmedPairs,
  alreadyHasBracket = false,
  onGenerated,
}: Props) {
  const [format, setFormat] = useState<Format>("grupos+eliminatoria");
  const [distMode, setDistMode] = useState<DistMode>("byCount");
  const [numGroups, setNumGroups] = useState<AutoOrNumber>("auto");
  const [groupSize, setGroupSize] = useState<number | "">("");
  const [topN, setTopN] = useState<1 | 2>(2);
  const [elimRound, setElimRound] = useState<AutoOrRound>("auto");
  const [useSeeding, setUseSeeding] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Convertir distMode → numGroups efectivo para enviar al backend ───
  const effectiveNumGroups: number | undefined = useMemo(() => {
    if (format !== "grupos+eliminatoria") return undefined;
    if (distMode === "byCount") {
      return numGroups === "auto" ? undefined : numGroups;
    }
    // bySize: solo enviamos si tenemos datos válidos (evita numGroups=0)
    if (typeof groupSize !== "number" || groupSize < 3) return undefined;
    if (totalConfirmedPairs < 3) return undefined;
    return Math.ceil(totalConfirmedPairs / groupSize);
  }, [format, distMode, numGroups, groupSize, totalConfirmedPairs]);

  // ── Debounce ──────────────────────────────────────────────────────────
  const [debouncedKey, setDebouncedKey] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKey((k) => k + 1), 400);
    return () => clearTimeout(t);
  }, [format, distMode, numGroups, groupSize, topN, elimRound]);

  const previewQuery = useQuery<PreviewResp>({
    queryKey: [
      "bracket-preview",
      tournamentId,
      categoryId,
      format,
      effectiveNumGroups,
      topN,
      elimRound,
      debouncedKey,
    ],
    queryFn: () =>
      adminService.tournaments.previewBracket(tournamentId, categoryId, format, {
        numGroups: effectiveNumGroups,
        topNPerGroup: topN,
        eliminationStartRound: elimRound === "auto" ? undefined : elimRound,
      }) as Promise<PreviewResp>,
    enabled: open && !!categoryId,
    retry: false,
    staleTime: 0,
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      const opts: BracketGenerationOptions = {
        numGroups: effectiveNumGroups,
        topNPerGroup: topN,
        eliminationStartRound: elimRound === "auto" ? undefined : elimRound,
      };
      // Si ya hay cuadro generado, usamos regenerateBracket (que pasa force=true
      // en el backend). Si no, generateBracket normal.
      return alreadyHasBracket
        ? adminService.tournaments.regenerateBracket(tournamentId, categoryId, opts)
        : adminService.tournaments.generateBracket(
            tournamentId,
            categoryId,
            undefined,
            format,
            opts,
          );
    },
    onSuccess: () => {
      toast.success("Cuadro generado correctamente");
      setSubmitError(null);
      onClose();
      onGenerated?.();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err as Error)?.message ??
        "Error al generar el cuadro";
      setSubmitError(msg);
      toast.error(msg);
    },
  });

  if (!open) return null;

  // ── Opciones disabled por coherencia ──────────────────────────────────
  // Si el admin tiene "Automático" en nº de grupos, usamos el preview actual
  // (el backend ya lo calculó). Si tiene nº de grupos manual, usamos ese.
  const effectiveGroupCount: number | undefined =
    effectiveNumGroups ?? previewQuery.data?.groups.length;

  const elimRoundDisabled = (round: Exclude<AutoOrRound, "auto">): string | null => {
    if (format !== "grupos+eliminatoria") return null;
    if (effectiveGroupCount === undefined) return null;
    const requiredSlots = ROUND_SIZES[round];
    const availableSlots = effectiveGroupCount * topN;
    if (availableSlots < requiredSlots) {
      return `${round} requiere ${requiredSlots} plazas (tienes ${availableSlots})`;
    }
    return null;
  };

  const previewError = (previewQuery.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (previewQuery.error as Error | undefined)?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-heading text-base text-foreground">
              Generar cuadro — {categoryLabel}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {alreadyHasBracket && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-500">
              ⚠️ Ya hay un cuadro generado en esta categoría. Generar de nuevo
              borrará todos los grupos, partidos y resultados.
              <span className="block mt-1 text-yellow-500/70">
                (Bloque 2 añadirá una confirmación más estricta.)
              </span>
            </div>
          )}

          {/* ── Formato ──────────────────────────────────────────── */}
          <Field label="Formato">
            <div className="space-y-1.5">
              <Radio
                checked={format === "grupos+eliminatoria"}
                onChange={() => setFormat("grupos+eliminatoria")}
                label="Grupos + Eliminatoria"
              />
              <Radio
                checked={format === "solo-eliminatoria"}
                onChange={() => setFormat("solo-eliminatoria")}
                label="Solo eliminatoria"
              />
            </div>
          </Field>

          {format === "grupos+eliminatoria" && (
            <>
              {/* ── Distribución de grupos ──────────────────────── */}
              <Field label="Distribución de grupos">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Radio
                      checked={distMode === "byCount"}
                      onChange={() => setDistMode("byCount")}
                      label="Por nº de grupos"
                    />
                    <select
                      disabled={distMode !== "byCount"}
                      value={numGroups === "auto" ? "auto" : String(numGroups)}
                      onChange={(e) =>
                        setNumGroups(e.target.value === "auto" ? "auto" : Number(e.target.value))
                      }
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-40"
                    >
                      <option value="auto">Automático</option>
                      {Array.from({ length: 15 }, (_, i) => i + 2).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <Radio
                      checked={distMode === "bySize"}
                      onChange={() => setDistMode("bySize")}
                      label="Por tamaño grupo"
                    />
                    <input
                      type="number"
                      min={3}
                      max={10}
                      disabled={distMode !== "bySize"}
                      value={groupSize}
                      onChange={(e) =>
                        setGroupSize(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="parejas"
                      className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-40"
                    />
                  </div>
                </div>
              </Field>

              {/* ── Top N ─────────────────────────────────────── */}
              <Field label="Pasan de cada grupo">
                <div className="flex gap-3">
                  {([1, 2] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTopN(n)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                        topN === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Top {n}
                    </button>
                  ))}
                </div>
              </Field>

              {/* ── Ronda inicial elim ────────────────────────── */}
              <Field label="Ronda inicial eliminatoria">
                <select
                  value={elimRound}
                  onChange={(e) => setElimRound(e.target.value as AutoOrRound)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="auto">Automático</option>
                  {(["R16", "QF", "SF", "F"] as const).map((r) => {
                    const reason = elimRoundDisabled(r);
                    return (
                      <option key={r} value={r} disabled={!!reason} title={reason ?? ""}>
                        {ROUND_LABELS[r]} {reason ? `(${reason})` : ""}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </>
          )}

          {/* ── Seeding ──────────────────────────────────────────── */}
          <Field label="Semillas">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useSeeding}
                onChange={(e) => setUseSeeding(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-xs text-foreground">
                Aplicar seeding por LSPA (parejas top distribuidas)
              </span>
            </label>
          </Field>

          {/* ── Preview ──────────────────────────────────────────── */}
          <div className="rounded-md border border-border bg-background p-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2 tracking-wide">
              Vista previa
            </h3>
            {previewQuery.isLoading || previewQuery.isFetching ? (
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            ) : previewError ? (
              <div className="text-xs text-destructive">
                <p className="font-medium">No se puede previsualizar</p>
                <p className="text-muted-foreground mt-0.5">{previewError}</p>
              </div>
            ) : previewQuery.data ? (
              <PreviewSummary
                preview={previewQuery.data}
                topN={topN}
                elimRound={elimRound}
              />
            ) : null}
          </div>

          {/* Inline error de submit (no cierra el modal) */}
          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-2 p-4 bg-card border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={generateMutation.isPending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSubmitError(null);
              generateMutation.mutate();
            }}
            disabled={generateMutation.isPending || !!previewError}
          >
            {generateMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <GitBranch size={14} />
            )}
            Generar cuadro
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Radio({
  checked, onChange, label,
}: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-primary"
      />
      <span className="text-xs text-foreground">{label}</span>
    </label>
  );
}

function PreviewSummary({
  preview, topN, elimRound,
}: { preview: PreviewResp; topN: 1 | 2; elimRound: AutoOrRound }) {
  if (!preview.isGroups) {
    return (
      <div className="space-y-1 text-xs">
        <p className="flex items-center gap-1.5 text-foreground">
          <Trophy size={11} className="text-primary" />
          {preview.totalPairs} parejas · Solo eliminatoria
        </p>
        <p className="text-muted-foreground">
          {preview.totalMatches} partidos en total
        </p>
      </div>
    );
  }

  const G = preview.groups.length;
  const sizes = preview.groups.map((g) => g.pairs.length);
  const sizeBreakdown = countBy(sizes)
    .map(([size, count]) => `${count} de ${size}`)
    .join(" + ");

  const elimPlaces = G * topN;
  const elimLabel =
    elimRound === "auto"
      ? autoElimRoundLabel(elimPlaces)
      : ROUND_LABELS[elimRound];

  return (
    <div className="space-y-1 text-xs">
      <p className="flex items-center gap-1.5 text-foreground">
        <Users size={11} className="text-primary" />
        {G} grupos ({sizeBreakdown}) · {preview.totalPairs} parejas
      </p>
      <p className="text-muted-foreground">
        {preview.totalMatches} partidos en fase de grupos
      </p>
      <p className="flex items-center gap-1.5 text-foreground">
        <Trophy size={11} className="text-primary" />
        Top {topN} × {G} = {elimPlaces} plazas → {elimLabel}
      </p>
    </div>
  );
}

function countBy(arr: number[]): [number, number][] {
  const map = new Map<number, number>();
  for (const n of arr) map.set(n, (map.get(n) ?? 0) + 1);
  return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
}

function autoElimRoundLabel(plazas: number): string {
  if (plazas >= 16) return "Octavos de final";
  if (plazas >= 8) return "Cuartos de final";
  if (plazas >= 4) return "Semifinales";
  return "Final";
}
