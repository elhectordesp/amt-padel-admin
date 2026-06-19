"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, CalendarDays, Save, Check } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";

interface Props {
  registrationId: string;
  onClose: () => void;
  /** Abre en modo edición directamente (ej: desde post-enroll toast) */
  editMode?: boolean;
}

interface DayState {
  dayId:            string;
  label:            string;
  date:             string;
  allSlots:         string[];
  fullAvailability: boolean;
  unavailableSlots: Set<string>;
}

interface AvailabilityDay {
  dayId: string; label: string; date: string;
  allSlots: string[]; fullAvailability: boolean; unavailableSlots?: string[];
}

function buildDayState(day: AvailabilityDay): DayState {
  return {
    dayId:            day.dayId,
    label:            day.label,
    date:             day.date,
    allSlots:         day.allSlots,
    fullAvailability: day.fullAvailability,
    unavailableSlots: new Set(day.unavailableSlots ?? []),
  };
}

export function AvailabilityModal({ registrationId, onClose, editMode = false }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(editMode);
  const [days,    setDays]    = useState<DayState[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["reg-availability", registrationId],
    queryFn:  () => adminService.tournaments.registrationAvailability(registrationId),
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data?.days) setDays((data.days as AvailabilityDay[]).map(buildDayState));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      adminService.tournaments.updateAvailability(
        registrationId,
        days.map((d) => ({
          dayId:            d.dayId,
          fullAvailability: d.fullAvailability,
          unavailableSlots: d.fullAvailability ? [] : [...d.unavailableSlots],
        })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reg-availability", registrationId] });
      toast.success("Disponibilidad guardada");
      setEditing(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => toast.error(err?.response?.data?.message ?? "Error al guardar"),
  });

  const toggleSlot = (dayIdx: number, slot: string) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIdx) return d;
        const next = new Set(d.unavailableSlots);
        if (next.has(slot)) { next.delete(slot); } else { next.add(slot); }
        return { ...d, unavailableSlots: next };
      }),
    );
  };

  const toggleFullDay = (dayIdx: number) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i !== dayIdx ? d : { ...d, fullAvailability: !d.fullAvailability, unavailableSlots: new Set() },
      ),
    );
  };

  const hasDays  = (data?.days?.length ?? 0) > 0;
  // True only when local state actually differs from server data —
  // prevents enabling Save on a noop click.
  const hasUnsavedChanges = (() => {
    if (!editing || !data?.days || days.length === 0) return false;
    const original = (data.days as AvailabilityDay[]);
    if (original.length !== days.length) return true;
    return days.some((d, i) => {
      const o = original[i];
      if (!o) return true;
      if (!!o.fullAvailability !== !!d.fullAvailability) return true;
      const oSlots = new Set(o.unavailableSlots ?? []);
      if (oSlots.size !== d.unavailableSlots.size) return true;
      for (const s of d.unavailableSlots) if (!oSlots.has(s)) return true;
      return false;
    });
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[#D4AF37]" />
            <h3 className="font-heading text-sm text-foreground">Disponibilidad</h3>
            {data && (
              <span className="text-xs text-muted-foreground">
                — {data.player1}{data.player2 ? ` / ${data.player2}` : ""}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : !hasDays && !editing ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-muted-foreground">Este jugador no ha indicado su disponibilidad.</p>
              {data?.days !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {data.days.length === 0 && "El torneo no tiene horario definido, o la disponibilidad está vacía."}
                </p>
              )}
            </div>
          ) : editing ? (
            /* ── Modo edición ── */
            days.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Este torneo no tiene días de horario configurados.
              </p>
            ) : (
              days.map((day, idx) => (
                <div key={day.dayId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{day.label}</p>
                    <button
                      onClick={() => toggleFullDay(idx)}
                      className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border transition-colors ${
                        day.fullAvailability
                          ? "bg-green-400/10 border-green-400/30 text-green-400"
                          : "bg-secondary border-border text-muted-foreground hover:border-[#D4AF37] hover:text-[#D4AF37]"
                      }`}
                    >
                      {day.fullAvailability && <Check size={10} />}
                      Disponible todo el día
                    </button>
                  </div>

                  {!day.fullAvailability && (
                    <div className="flex flex-wrap gap-1.5">
                      {day.allSlots.map((slot) => {
                        const unavail = day.unavailableSlots.has(slot);
                        return (
                          <button
                            key={slot}
                            onClick={() => toggleSlot(idx, slot)}
                            title={unavail ? "No disponible — click para marcar disponible" : "Disponible — click para bloquear"}
                            className={`text-xs sm:text-[11px] font-mono min-w-[52px] px-2.5 py-2 sm:px-2 sm:py-1 rounded border transition-colors ${
                              unavail
                                ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
                                : "bg-green-400/10 border-green-400/20 text-green-400 hover:bg-green-400/20"
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            /* ── Modo lectura ── */
            (data!.days as AvailabilityDay[]).map((day) => {
              const unavailable   = new Set(day.unavailableSlots ?? []);
              const allUnavail    = !day.fullAvailability && day.allSlots.every((s: string) => unavailable.has(s));
              return (
                <div key={day.dayId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{day.label}</p>
                    {day.fullAvailability ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
                        Disponible todo el día
                      </span>
                    ) : allUnavail ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                        No disponible
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                        Disponibilidad parcial
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {day.allSlots.map((slot: string) => {
                      const isUnavail = !day.fullAvailability && unavailable.has(slot);
                      return (
                        <span
                          key={slot}
                          className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                            isUnavail
                              ? "bg-destructive/10 border-destructive/30 text-destructive/70"
                              : "bg-green-400/10 border-green-400/20 text-green-400"
                          }`}
                        >
                          {slot}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between shrink-0">
          {!editing ? (
            <>
              <button
                onClick={() => { setEditing(true); if (data?.days) setDays(data.days.map(buildDayState)); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-medium text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
              >
                <CalendarDays size={12} />
                Editar disponibilidad
              </button>
              <button onClick={onClose} className="px-4 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                Cerrar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !hasUnsavedChanges}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#c09b2a] disabled:opacity-50 text-black text-xs font-semibold transition-colors"
              >
                {saveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Guardar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
