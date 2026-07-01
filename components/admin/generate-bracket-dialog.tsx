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
type AutoOrRound = "auto" | "R32" | "R16" | "QF" | "SF" | "F";
type GenerationMode = "auto" | "manual";

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
  /**
   * Bloque 2: si las inscripciones siguen abiertas, el dialog entra en
   * modo read-only. Permite explorar opciones pero el botón Generar queda
   * deshabilitado con motivo claro.
   */
  registrationsOpenReason?: string | null;
  onGenerated?: () => void;
}

const ROUND_LABELS: Record<Exclude<AutoOrRound, "auto">, string> = {
  R32: "Dieciseisavos de final",
  R16: "Octavos de final",
  QF: "Cuartos de final",
  SF: "Semifinales",
  F: "Final",
};
const ROUND_SIZES: Record<Exclude<AutoOrRound, "auto">, number> = {
  R32: 32,
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
  registrationsOpenReason = null,
  onGenerated,
}: Props) {
  const [genMode, setGenMode] = useState<GenerationMode>("auto"); // Bloque 3
  const [manualNumGroups, setManualNumGroups] = useState<number>(2);
  const [format, setFormat] = useState<Format>("grupos+eliminatoria");
  const [distMode, setDistMode] = useState<DistMode>("byCount");
  const [numGroups, setNumGroups] = useState<AutoOrNumber>("auto");
  const [groupSize, setGroupSize] = useState<number | "">("");
  const [topN, setTopN] = useState<1 | 2>(2);
  const [elimRound, setElimRound] = useState<AutoOrRound>("auto");
  const [useSeeding, setUseSeeding] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Bloque 2: input de confirmación REGENERAR cuando hay resultados
  const [regenerateConfirm, setRegenerateConfirm] = useState("");

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

  // Bloque 2: fetch de stats del cuadro existente (si lo hay) para decidir
  // si mostrar banner ámbar (sin resultados) o rojo (con resultados →
  // input REGENERAR obligatorio).
  const statsQuery = useQuery({
    queryKey: ["bracket-stats", tournamentId, categoryId],
    queryFn: () => adminService.tournaments.getBracketStats(tournamentId, categoryId),
    enabled: open && alreadyHasBracket,
    staleTime: 0,
  });

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
      // Bloque 3: modo manual → crea grupos vacíos y deja al admin asignar
      if (genMode === "manual") {
        return adminService.tournaments.initBracketManual(
          tournamentId,
          categoryId,
          manualNumGroups,
        );
      }
      // Modo auto: igual que antes (Bloques 1+2)
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
      toast.success(
        genMode === "manual"
          ? `${manualNumGroups} grupos vacíos creados. Asigna las parejas debajo.`
          : "Cuadro generado correctamente",
      );
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

  // ── Bloque 2: empty states + read-only ────────────────────────────────
  const hasZeroPairs = totalConfirmedPairs === 0;
  const tooFewPairs = totalConfirmedPairs > 0 && totalConfirmedPairs < 3;
  const isReadOnly = !!registrationsOpenReason;

  const stats = statsQuery.data;
  const needsRegenerateConfirm =
    alreadyHasBracket && (stats?.finishedMatches ?? 0) > 0;
  const regenerateConfirmOk =
    !needsRegenerateConfirm || regenerateConfirm.trim().toUpperCase() === "REGENERAR";

  // Validación inline tamaño grupo
  const groupSizeError =
    distMode === "bySize" && format === "grupos+eliminatoria"
      ? typeof groupSize !== "number"
        ? null
        : groupSize < 3
        ? "Mínimo 3 parejas por grupo"
        : groupSize > totalConfirmedPairs
        ? `Máximo ${totalConfirmedPairs} (total parejas)`
        : null
      : null;

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
          {/* Empty state: 0 parejas confirmadas */}
          {hasZeroPairs && (
            <EmptyState
              icon="🚫"
              title="No hay parejas inscritas todavía"
              body="Cierra inscripciones cuando estés listo y entonces podrás generar el cuadro."
            />
          )}

          {/* Empty state: menos de 3 parejas */}
          {tooFewPairs && (
            <EmptyState
              icon="🚫"
              title={`Solo tienes ${totalConfirmedPairs} pareja${totalConfirmedPairs === 1 ? "" : "s"} confirmada${totalConfirmedPairs === 1 ? "" : "s"}`}
              body="Se necesita un mínimo de 3 parejas para generar cualquier formato."
            />
          )}

          {/* Read-only por inscripciones abiertas */}
          {isReadOnly && !hasZeroPairs && !tooFewPairs && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-500">
              ⚠️ {registrationsOpenReason}
              <span className="block mt-1 text-yellow-500/70">
                Puedes explorar opciones aquí pero el botón Generar queda
                deshabilitado hasta que cierres inscripciones.
              </span>
            </div>
          )}

          {/* Banner regenerar (solo si ya hay cuadro y hay parejas) */}
          {alreadyHasBracket &&
            !hasZeroPairs &&
            !tooFewPairs &&
            (stats === undefined ? (
              <div className="h-10 rounded-md bg-muted animate-pulse" />
            ) : needsRegenerateConfirm ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <p className="text-xs font-medium text-destructive">
                  🛑 Esta categoría ya tiene partidos jugados
                </p>
                <p className="text-xs text-destructive/90">
                  Regenerar borrará {stats.totalMatches} partidos
                  ({stats.finishedMatches} con resultados registrados). Los
                  resultados se perderán y el ranking SPA NO se revierte
                  automáticamente.
                </p>
                <label className="block text-xs text-destructive/80">
                  Escribe REGENERAR para confirmar:
                </label>
                <input
                  type="text"
                  value={regenerateConfirm}
                  onChange={(e) => setRegenerateConfirm(e.target.value)}
                  placeholder="REGENERAR"
                  className="w-full rounded border border-destructive/30 bg-background px-2 py-1.5 text-xs text-foreground font-mono uppercase"
                />
              </div>
            ) : (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-500">
                ⚠️ Ya hay un cuadro generado en esta categoría. Regenerarlo
                borrará {stats.totalMatches} partidos (ninguno con resultado).
              </div>
            ))}

          {!hasZeroPairs && !tooFewPairs && (
          <>
          {/* ── Modo de generación (Bloque 3) ────────────────────── */}
          <Field label="Modo de generación">
            <div className="space-y-1.5">
              <Radio
                checked={genMode === "auto"}
                onChange={() => setGenMode("auto")}
                label="Automático con opciones"
              />
              <Radio
                checked={genMode === "manual"}
                onChange={() => setGenMode("manual")}
                label="Crear grupos vacíos y asignar a mano"
              />
            </div>
          </Field>

          {genMode === "manual" && (
            <>
              <Field label="Nº de grupos vacíos">
                <input
                  type="number"
                  min={2}
                  max={16}
                  value={manualNumGroups}
                  onChange={(e) =>
                    setManualNumGroups(
                      Math.max(2, Math.min(16, Number(e.target.value) || 2)),
                    )
                  }
                  className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </Field>
              <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                Se crearán <span className="font-medium text-foreground">{manualNumGroups} grupos vacíos</span>.
                Asignarás las parejas manualmente desde el editor de grupos
                que aparecerá tras crear.
              </div>
            </>
          )}

          {genMode === "auto" && (
          <>
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
                      className={`w-24 rounded-md border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-40 ${
                        groupSizeError
                          ? "border-destructive"
                          : "border-border"
                      }`}
                    />
                  </div>
                  {groupSizeError && (
                    <p className="text-xs text-destructive mt-1">
                      {groupSizeError}
                    </p>
                  )}
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
                  {(["R32", "R16", "QF", "SF", "F"] as const).map((r) => {
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

          </>
          )}

          {/* Inline error de submit (no cierra el modal) */}
          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              {submitError}
            </div>
          )}
          </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-2 p-4 bg-card border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={generateMutation.isPending}>
            Cancelar
          </Button>
          {!hasZeroPairs && !tooFewPairs && (
            <Button
              size="sm"
              onClick={() => {
                setSubmitError(null);
                generateMutation.mutate();
              }}
              disabled={
                generateMutation.isPending ||
                (genMode === "auto" && !!previewError) ||
                isReadOnly ||
                !regenerateConfirmOk ||
                (genMode === "auto" && !!groupSizeError)
              }
              title={
                isReadOnly
                  ? "Inscripciones aún abiertas"
                  : !regenerateConfirmOk
                  ? "Escribe REGENERAR para confirmar"
                  : undefined
              }
            >
              {generateMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <GitBranch size={14} />
              )}
              {genMode === "manual" ? "Crear grupos vacíos" : "Generar cuadro"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function EmptyState({
  icon, title, body,
}: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

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
