/**
 * MatchCreateDialog — Crear un partido A MANO (Frente 2).
 *
 * Permite al admin crear un partido dentro de un grupo (fase GROUPS) o suelto
 * en una fase de eliminatoria, eligiendo opcionalmente las dos parejas, la hora
 * y la pista. Llama a createManualMatch.
 */

"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";

export interface MatchCreateGroup {
  id: string;
  label: string;
}
export interface MatchCreatePair {
  userId: string;
  partnerId: string | null;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  categoryId: string;
  categoryLabel: string;
  groups: MatchCreateGroup[];
  pairs: MatchCreatePair[];
  onCreated?: () => void;
  /** Prefill al crear desde un hueco de la rejilla ("YYYY-MM-DDTHH:MM" y nombre de pista). */
  initialDate?: string;
  initialCourt?: string;
}

const PHASES = [
  { value: "R32", label: "Dieciseisavos (R32)" },
  { value: "R16", label: "Octavos (R16)" },
  { value: "QF", label: "Cuartos" },
  { value: "SF", label: "Semifinal" },
  { value: "FINAL", label: "Final" },
  { value: "CONSOLATION", label: "Consolación" },
];

export function MatchCreateDialog({
  open,
  onClose,
  tournamentId,
  categoryId,
  categoryLabel,
  groups,
  pairs,
  onCreated,
  initialDate,
  initialCourt,
}: Props) {
  const [target, setTarget] = useState<string>(groups[0]?.id ?? "free"); // groupId | "free"
  const [phase, setPhase] = useState("QF");
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [date, setDate] = useState(initialDate ?? "");
  const [court, setCourt] = useState(initialCourt ?? "");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const pairBy = (uid: string) => pairs.find((p) => p.userId === uid) ?? null;
  const sameTeam = team1 && team2 && team1 === team2;

  const submit = async () => {
    if (sameTeam) return;
    setSaving(true);
    try {
      const t1 = pairBy(team1);
      const t2 = pairBy(team2);
      await adminService.tournaments.createManualMatch(tournamentId, {
        categoryId,
        ...(target === "free" ? { phase } : { groupId: target }),
        ...(t1 ? { team1: { userId: t1.userId, partnerId: t1.partnerId } } : {}),
        ...(t2 ? { team2: { userId: t2.userId, partnerId: t2.partnerId } } : {}),
        ...(date ? { date: new Date(date).toISOString() } : {}),
        ...(court.trim() ? { court: court.trim() } : {}),
      });
      toast.success("Partido creado");
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "No se pudo crear el partido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Crear partido a mano</h2>
              <p className="text-xs text-muted-foreground">{categoryLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Ubicación</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.label} (fase de grupos)</option>
              ))}
              <option value="free">Suelto (eliminatoria)</option>
            </select>
          </label>

          {target === "free" && (
            <label className="block">
              <span className="text-xs text-muted-foreground">Fase</span>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {PHASES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-1 gap-2">
            <label className="block">
              <span className="text-xs text-muted-foreground">Pareja 1 (opcional)</span>
              <select value={team1} onChange={(e) => setTeam1(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                <option value="">— sin asignar —</option>
                {pairs.map((p) => (
                  <option key={p.userId} value={p.userId}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Pareja 2 (opcional)</span>
              <select value={team2} onChange={(e) => setTeam2(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                <option value="">— sin asignar —</option>
                {pairs.map((p) => (
                  <option key={p.userId} value={p.userId}>{p.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-muted-foreground">Hora (opcional)</span>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Pista (opcional)</span>
              <input type="text" value={court} onChange={(e) => setCourt(e.target.value)} placeholder="Pista 1" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
            </label>
          </div>

          {sameTeam && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              Las dos parejas no pueden ser la misma.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={saving || !!sameTeam}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Crear partido
          </Button>
        </div>
      </div>
    </div>
  );
}
