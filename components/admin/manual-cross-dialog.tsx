/**
 * ManualCrossDialog — Editor de CRUCE MANUAL de eliminatoria (Frente 3).
 *
 * Permite al admin definir a mano los emparejamientos de 1ª ronda
 * (ej. 1º Grupo A vs 2º Grupo C). Cada fila = un partido de 1ª ronda;
 * cada lado apunta a una posición de un grupo (1º, 2º…) o a un BYE.
 *
 * El nº de partidos debe formar un cuadro potencia de 2 (1, 2, 4, 8, 16).
 * Las posiciones se resuelven con la clasificación actual de cada grupo
 * al generar (POST …/categories/:catId/elimination/manual).
 */

"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";

export interface ManualCrossGroup {
  /** Etiqueta visible del grupo (p.ej. "Grupo A"). El índice = groupIdx del backend. */
  label: string;
  /** Nº de parejas del grupo (define las posiciones seleccionables). */
  size: number;
}

type Side = { groupIdx: number; pos: number } | null; // null = BYE
type Cross = { a: Side; b: Side };

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  categoryId: string;
  categoryLabel: string;
  groups: ManualCrossGroup[];
  onGenerated?: () => void;
}

const POW2 = new Set([1, 2, 4, 8, 16]);
const ROUND_LABEL: Record<number, string> = {
  2: "Final",
  4: "Semifinales",
  8: "Cuartos de final",
  16: "Octavos (R16)",
  32: "Dieciseisavos (R32)",
};

const sideKey = (s: Side) => (s === null ? "bye" : `${s.groupIdx}:${s.pos}`);
const parseSide = (v: string): Side =>
  v === "bye" ? null : { groupIdx: Number(v.split(":")[0]), pos: Number(v.split(":")[1]) };

export function ManualCrossDialog({
  open,
  onClose,
  tournamentId,
  categoryId,
  categoryLabel,
  groups,
  onGenerated,
}: Props) {
  const [crosses, setCrosses] = useState<Cross[]>([
    { a: null, b: null },
    { a: null, b: null },
  ]);
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    groups.forEach((g, gi) => {
      for (let p = 0; p < g.size; p++) {
        opts.push({ value: `${gi}:${p}`, label: `${p + 1}º ${g.label}` });
      }
    });
    return opts;
  }, [groups]);

  const setSide = (row: number, which: "a" | "b", value: string) =>
    setCrosses((prev) =>
      prev.map((c, i) => (i === row ? { ...c, [which]: parseSide(value) } : c)),
    );

  const addRow = () => setCrosses((p) => [...p, { a: null, b: null }]);
  const removeRow = (i: number) =>
    setCrosses((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  // ── Validación ──
  const realSides = crosses.flatMap((c) => [c.a, c.b]).filter((s): s is NonNullable<Side> => s !== null);
  const dupKeys = (() => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const s of realSides) {
      const k = sideKey(s);
      if (seen.has(k)) dups.add(k);
      seen.add(k);
    }
    return dups;
  })();
  const bothByeRow = crosses.some((c) => c.a === null && c.b === null);
  const isPow2 = POW2.has(crosses.length);
  const bracketSize = crosses.length * 2;
  const error = !isPow2
    ? `El nº de partidos (${crosses.length}) debe ser 1, 2, 4, 8 o 16 para formar un cuadro.`
    : realSides.length < 2
      ? "Selecciona al menos 2 parejas."
      : dupKeys.size > 0
        ? "Una misma pareja está repetida en el cuadro."
        : bothByeRow
          ? "Un partido no puede tener dos BYE."
          : null;

  const submit = async () => {
    if (error) return;
    setSaving(true);
    try {
      await adminService.tournaments.generateEliminationManual(
        tournamentId,
        categoryId,
        crosses.map((c) => ({ a: c.a, b: c.b })),
      );
      toast.success("Eliminatoria generada con el cruce manual");
      onGenerated?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "No se pudo generar la eliminatoria");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Cruce manual de eliminatoria</h2>
              <p className="text-xs text-muted-foreground">{categoryLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {groups.length === 0 ? (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-500">
              No hay grupos en esta categoría. Genera primero la fase de grupos.
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Define cada partido de 1ª ronda. Las posiciones (1º, 2º…) se resuelven con
                la clasificación actual de cada grupo al generar.
              </p>

              <div className="space-y-2">
                {crosses.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-14 shrink-0">Partido {i + 1}</span>
                    <SideSelect value={sideKey(c.a)} options={options} onChange={(v) => setSide(i, "a", v)} />
                    <span className="text-xs text-muted-foreground shrink-0">vs</span>
                    <SideSelect value={sideKey(c.b)} options={options} onChange={(v) => setSide(i, "b", v)} />
                    <button
                      onClick={() => removeRow(i)}
                      disabled={crosses.length <= 1}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30"
                      aria-label="Quitar partido"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Añadir partido
              </button>

              <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                {crosses.length} partidos →{" "}
                <span className="text-foreground font-medium">
                  {ROUND_LABEL[bracketSize] ?? `Cuadro de ${bracketSize}`}
                </span>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit} disabled={!!error || saving || groups.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Generar eliminatoria
          </Button>
        </div>
      </div>
    </div>
  );
}

function SideSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
    >
      <option value="bye">— BYE —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
