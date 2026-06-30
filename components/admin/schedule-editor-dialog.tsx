/**
 * ScheduleEditorDialog — Editar jornadas y tramos horarios de un torneo (Frente 1).
 *
 * Solo durante el MONTAJE (el backend bloquea si el torneo ya empezó). Reemplaza
 * todas las jornadas: cada una con fecha, tipo, si es final, máx. tramos no
 * disponibles, y uno o varios bloques horarios (de–a). Llama a updateSchedule.
 */

"use client";

import { useState } from "react";
import { CalendarDays, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";

export interface ScheduleEditorDay {
  date: string; // ISO o YYYY-MM-DD
  type?: string;
  isFinal?: boolean;
  slots?: string[];
  maxUnavailableHours?: number;
}

interface Block {
  start: string;
  end: string;
}
interface DayForm {
  date: string; // YYYY-MM-DD
  type: string;
  isFinal: boolean;
  maxUnavailableSlots: number;
  blocks: Block[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  initialDays: ScheduleEditorDay[];
  onSaved?: () => void;
}

const TYPES = [
  { value: "GRUPOS", label: "Solo grupos" },
  { value: "ELIMINATORIAS", label: "Solo eliminatorias" },
  { value: "AMBOS", label: "Ambos" },
];

const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const toLabel = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Reconstruye bloques (de–a) a partir de los slots de 30 min guardados. */
function slotsToBlocks(slots?: string[]): Block[] {
  if (!slots || slots.length === 0) return [{ start: "09:00", end: "11:00" }];
  const sorted = [...slots].sort();
  const blocks: Block[] = [];
  let start = toMin(sorted[0]);
  let prev = start;
  for (let i = 1; i < sorted.length; i++) {
    const cur = toMin(sorted[i]);
    if (cur === prev + 30) {
      prev = cur;
    } else {
      blocks.push({ start: toLabel(start), end: toLabel(prev + 30) });
      start = cur;
      prev = cur;
    }
  }
  blocks.push({ start: toLabel(start), end: toLabel(prev + 30) });
  return blocks;
}

const isoToDate = (iso: string) => (iso ? iso.split("T")[0] : "");

export function ScheduleEditorDialog({ open, onClose, tournamentId, initialDays, onSaved }: Props) {
  const [days, setDays] = useState<DayForm[]>(() =>
    (initialDays.length
      ? initialDays
      : [{ date: "", type: "AMBOS", isFinal: false, slots: [], maxUnavailableHours: 0 }]
    ).map((d) => ({
      date: isoToDate(d.date),
      type: d.type ?? "AMBOS",
      isFinal: d.isFinal ?? false,
      maxUnavailableSlots: d.maxUnavailableHours ?? 0,
      blocks: slotsToBlocks(d.slots),
    })),
  );
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const update = (i: number, patch: Partial<DayForm>) =>
    setDays((p) => p.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const addDay = () =>
    setDays((p) => [...p, { date: "", type: "AMBOS", isFinal: false, maxUnavailableSlots: 0, blocks: [{ start: "09:00", end: "11:00" }] }]);
  const removeDay = (i: number) => setDays((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
  const addBlock = (i: number) => update(i, { blocks: [...days[i].blocks, { start: "16:00", end: "21:00" }] });
  const setBlock = (i: number, bi: number, patch: Partial<Block>) =>
    update(i, { blocks: days[i].blocks.map((b, idx) => (idx === bi ? { ...b, ...patch } : b)) });
  const removeBlock = (i: number, bi: number) =>
    update(i, { blocks: days[i].blocks.length > 1 ? days[i].blocks.filter((_, idx) => idx !== bi) : days[i].blocks });

  // ── Validación ──
  const error = (() => {
    if (days.some((d) => !d.date)) return "Todas las jornadas necesitan fecha.";
    for (const d of days) {
      if (d.blocks.length === 0) return "Cada jornada necesita al menos un tramo horario.";
      if (d.blocks.some((b) => toMin(b.start) >= toMin(b.end))) return "En cada tramo, la hora de inicio debe ser anterior a la de fin.";
    }
    return null;
  })();

  const submit = async () => {
    if (error) return;
    setSaving(true);
    try {
      await adminService.tournaments.updateSchedule(
        tournamentId,
        days.map((d) => ({
          date: d.date,
          type: d.type,
          isFinal: d.isFinal,
          maxUnavailableSlots: d.maxUnavailableSlots,
          blocks: d.blocks,
        })),
      );
      toast.success("Jornadas y horarios actualizados");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "No se pudieron actualizar las jornadas");
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
            <h2 className="text-sm font-semibold text-foreground">Jornadas y horarios</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Define los días y tramos horarios. Solo se puede editar mientras el torneo no haya empezado.
          </p>

          {days.map((d, i) => (
            <div key={i} className="rounded-lg border border-border bg-background p-3 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={d.date}
                  onChange={(e) => update(i, { date: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
                <select
                  value={d.type}
                  onChange={(e) => update(i, { type: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                  <input type="checkbox" checked={d.isFinal} onChange={(e) => update(i, { isFinal: e.target.checked })} className="accent-[#D4AF37]" />
                  Final
                </label>
                <button onClick={() => removeDay(i)} disabled={days.length <= 1} className="ml-auto p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30" aria-label="Quitar jornada">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                {d.blocks.map((b, bi) => (
                  <div key={bi} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12">Tramo</span>
                    <input type="time" value={b.start} onChange={(e) => setBlock(i, bi, { start: e.target.value })} className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground" />
                    <span className="text-xs text-muted-foreground">a</span>
                    <input type="time" value={b.end} onChange={(e) => setBlock(i, bi, { end: e.target.value })} className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground" />
                    <button onClick={() => removeBlock(i, bi)} disabled={d.blocks.length <= 1} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30" aria-label="Quitar tramo">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => addBlock(i)} className="flex items-center gap-1 text-xs text-[#D4AF37] hover:underline">
                  <Plus className="h-3 w-3" /> Añadir tramo
                </button>
              </div>

              {!d.isFinal && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Máx. tramos no disponibles por jugador:
                  <input
                    type="number"
                    min={0}
                    value={d.maxUnavailableSlots}
                    onChange={(e) => update(i, { maxUnavailableSlots: Number(e.target.value) || 0 })}
                    className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  />
                </label>
              )}
            </div>
          ))}

          <button onClick={addDay} className="flex items-center gap-1.5 text-sm text-[#D4AF37] hover:underline">
            <Plus className="h-4 w-4" /> Añadir jornada
          </button>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={saving || !!error}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Guardar jornadas
          </Button>
        </div>
      </div>
    </div>
  );
}
