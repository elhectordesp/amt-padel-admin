/**
 * MatchEditPairsDialog — Cambiar las parejas de un partido ya creado (Punto 6+13).
 *
 * Elige las dos parejas (de las inscritas en la categoría) para un partido
 * existente y llama a editMatchPlayers. Si el partido ya está jugado, el backend
 * pide confirmación ("Confirma para…") y reintentamos con force (las stats no se
 * recalculan solas — se avisa).
 */

"use client";

import { useState } from "react";
import { Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";

export interface EditPairsPair {
  userId: string;
  partnerId: string | null;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  matchId: string;
  categoryLabel: string;
  pairs: EditPairsPair[];
  /** userIds de los jugadores actuales de cada equipo (para pre-seleccionar). */
  team1UserIds: string[];
  team2UserIds: string[];
  onSaved?: () => void;
}

export function MatchEditPairsDialog({
  open,
  onClose,
  matchId,
  categoryLabel,
  pairs,
  team1UserIds,
  team2UserIds,
  onSaved,
}: Props) {
  const findPair = (ids: string[]) =>
    pairs.find(
      (p) => ids.includes(p.userId) || (p.partnerId != null && ids.includes(p.partnerId)),
    )?.userId ?? "";

  const [team1, setTeam1] = useState(() => findPair(team1UserIds));
  const [team2, setTeam2] = useState(() => findPair(team2UserIds));
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const pairBy = (uid: string) => pairs.find((p) => p.userId === uid) ?? null;
  const sameTeam = team1 && team2 && team1 === team2;
  const bothSet = !!team1 && !!team2;

  const doSave = async (force: boolean) => {
    const t1 = pairBy(team1);
    const t2 = pairBy(team2);
    if (!t1 || !t2) return;
    await adminService.tournaments.editMatchPlayers(
      matchId,
      { userId: t1.userId, partnerId: t1.partnerId },
      { userId: t2.userId, partnerId: t2.partnerId },
      force,
    );
  };

  const submit = async () => {
    if (sameTeam || !bothSet) return;
    setSaving(true);
    try {
      await doSave(false);
      toast.success("Parejas actualizadas");
      onSaved?.();
      onClose();
    } catch (e: any) {
      const msg: string =
        e?.response?.data?.message ?? e?.message ?? "No se pudieron cambiar las parejas";
      if (/Confirma para/i.test(msg) && typeof window !== "undefined" && window.confirm(`${msg}\n\n¿Continuar de todas formas?`)) {
        try {
          await doSave(true);
          toast.success("Parejas actualizadas");
          onSaved?.();
          onClose();
        } catch (e2: any) {
          toast.error(e2?.response?.data?.message ?? e2?.message ?? "Error");
        }
      } else {
        toast.error(msg);
      }
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
            <Users className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Cambiar parejas del partido</h2>
              <p className="text-xs text-muted-foreground">{categoryLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Pareja 1</span>
            <select value={team1} onChange={(e) => setTeam1(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
              <option value="">— elegir pareja —</option>
              {pairs.map((p) => (
                <option key={p.userId} value={p.userId}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Pareja 2</span>
            <select value={team2} onChange={(e) => setTeam2(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
              <option value="">— elegir pareja —</option>
              {pairs.map((p) => (
                <option key={p.userId} value={p.userId}>{p.label}</option>
              ))}
            </select>
          </label>

          {sameTeam && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              Las dos parejas no pueden ser la misma.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={saving || !!sameTeam || !bothSet}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Guardar parejas
          </Button>
        </div>
      </div>
    </div>
  );
}
