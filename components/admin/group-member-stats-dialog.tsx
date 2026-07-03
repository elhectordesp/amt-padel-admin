/**
 * GroupMemberStatsDialog — Override manual de las stats de una pareja en un grupo
 * (Punto 11 — sanciones/ajustes). El admin fija los valores directamente; NO se
 * recalculan desde los resultados. Llama a overrideGroupMemberStats.
 */

"use client";

import { useState } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";

export interface GroupStatsInitial {
  played: number;
  wins: number;
  points: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  categoryId: string;
  groupId: string;
  userId: string;
  pairLabel: string;
  initial: GroupStatsInitial;
  onSaved?: () => void;
}

const FIELDS: { key: keyof GroupStatsInitial; label: string; min: number }[] = [
  { key: "played", label: "PJ (jugados)", min: 0 },
  { key: "wins", label: "PG (ganados)", min: 0 },
  { key: "points", label: "Puntos", min: -999 }, // permite negativos (sanciones)
  { key: "setsWon", label: "Sets ganados", min: 0 },
  { key: "setsLost", label: "Sets perdidos", min: 0 },
  { key: "gamesWon", label: "Juegos ganados", min: 0 },
  { key: "gamesLost", label: "Juegos perdidos", min: 0 },
];

export function GroupMemberStatsDialog({
  open,
  onClose,
  tournamentId,
  categoryId,
  groupId,
  userId,
  pairLabel,
  initial,
  onSaved,
}: Props) {
  const [values, setValues] = useState<GroupStatsInitial>(initial);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await adminService.tournaments.overrideGroupMemberStats(
        tournamentId,
        categoryId,
        groupId,
        userId,
        values,
      );
      toast.success("Estadísticas actualizadas");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? "No se pudieron guardar las estadísticas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Editar estadísticas</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[240px]">{pairLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-md border border-yellow-400/30 bg-yellow-400/5 p-2.5 text-[11px] text-yellow-300/90 mb-3">
            Ajuste manual (sanciones/correcciones). Estos valores NO se recalculan desde los resultados.
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <input
                  type="number"
                  min={f.min}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
