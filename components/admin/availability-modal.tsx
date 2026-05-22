"use client";

import { useQuery } from "@tanstack/react-query";
import { X, Loader2, CalendarDays } from "lucide-react";
import { adminService } from "@/lib/services/admin";

interface Props {
  registrationId: string;
  onClose: () => void;
}

export function AvailabilityModal({ registrationId, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["reg-availability", registrationId],
    queryFn:  () => adminService.tournaments.registrationAvailability(registrationId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
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
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.days.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Este jugador no ha indicado su disponibilidad.
            </p>
          ) : (
            data.days.map((day: any) => {
              const unavailable = new Set(day.unavailableSlots ?? []);
              const allUnavailable = !day.fullAvailability && day.allSlots.every((s: string) => unavailable.has(s));
              return (
                <div key={day.dayId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{day.label}</p>
                    {day.fullAvailability ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
                        Disponible todo el día
                      </span>
                    ) : allUnavailable ? (
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
                      const isUnavailable = !day.fullAvailability && unavailable.has(slot);
                      return (
                        <span
                          key={slot}
                          className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                            isUnavailable
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
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
