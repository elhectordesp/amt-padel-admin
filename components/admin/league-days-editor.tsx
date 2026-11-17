"use client";

/**
 * Los días de juego de una liga: se eligen los días de la semana en que se
 * juega y, para cada uno, sus franjas horarias. No hay una jornada por fecha
 * (como en un torneo): las jornadas de la liga salen del sorteo y cada una
 * cae en una semana. Es controlado: lo usan el asistente de Nueva liga y
 * «Editar jornadas».
 */
import { Plus, Trash2 } from "lucide-react";
import { WEEKDAYS, sortLeagueDays, type LeagueDayForm } from "@/lib/utils/league-days";
import { nextFreeBlock, type TimeBlock } from "@/lib/utils/schedule-windows";

interface Props {
  days: LeagueDayForm[];
  onChange: (days: LeagueDayForm[]) => void;
  /** La franja de un día recién elegido (la de apertura del club), al elegirlo. */
  newDayBlock: () => TimeBlock;
}

const TIME_INPUT =
  "flex-1 h-8 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors";

export function LeagueDaysEditor({ days, onChange, newDayBlock }: Props) {
  const chosen = new Set(days.map((d) => d.weekday));

  const toggle = (weekday: number) => {
    if (chosen.has(weekday)) {
      onChange(days.filter((d) => d.weekday !== weekday));
      return;
    }
    onChange(
      sortLeagueDays([...days, { weekday, blocks: [newDayBlock()], maxUnavailableSlots: 0 }]),
    );
  };

  const update = (weekday: number, patch: Partial<LeagueDayForm>) =>
    onChange(days.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  const setBlock = (day: LeagueDayForm, index: number, patch: Partial<TimeBlock>) =>
    update(day.weekday, { blocks: day.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) });

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Días de la semana" className="flex flex-wrap gap-2">
        {WEEKDAYS.map(({ value, label }) => {
          const on = chosen.has(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(value)}
              className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                on
                  ? "bg-[#D4AF37]/20 border-[#D4AF37]/60 text-[#D4AF37]"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {days.length === 0 && (
        <p className="text-xs text-muted-foreground">Elige al menos un día de la semana.</p>
      )}

      <div className="space-y-3">
        {days.map((day) => {
          const label = WEEKDAYS.find((w) => w.value === day.weekday)!.label;
          const newBlock = nextFreeBlock(day.blocks);
          return (
            <div key={day.weekday} className="p-4 bg-secondary/30 rounded-lg border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <button
                  type="button"
                  disabled={!newBlock}
                  title={newBlock ? undefined : "No queda hueco libre en el día"}
                  onClick={() => newBlock && update(day.weekday, { blocks: [...day.blocks, newBlock] })}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#D4AF37] uppercase hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  <Plus size={10} /> Añadir franja
                </button>
              </div>

              <div className="space-y-2">
                {day.blocks.map((block, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">Inicio</span>
                      <input
                        type="time"
                        aria-label={`Inicio de la franja del ${label.toLowerCase()}`}
                        value={block.start}
                        onChange={(e) => setBlock(day, index, { start: e.target.value })}
                        className={TIME_INPUT}
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">Fin</span>
                      <input
                        type="time"
                        aria-label={`Fin de la franja del ${label.toLowerCase()}`}
                        value={block.end}
                        onChange={(e) => setBlock(day, index, { end: e.target.value })}
                        className={TIME_INPUT}
                      />
                    </div>
                    {day.blocks.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Quitar franja del ${label.toLowerCase()}`}
                        onClick={() => update(day.weekday, { blocks: day.blocks.filter((_, i) => i !== index) })}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Franjas bloqueables:</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Auto"
                  aria-label={`Franjas bloqueables del ${label.toLowerCase()}`}
                  value={day.maxUnavailableSlots || ""}
                  onChange={(e) => update(day.weekday, { maxUnavailableSlots: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-16 h-7 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                />
                <span className="text-[10px] text-muted-foreground">(0 = automático · 1 franja = 30 min)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
