"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { adminService } from "@/lib/services/admin";
import { CATEGORY_LABEL_SHORT, GENDER_LABEL } from "@/lib/constants";
import type { CategoryLevel, Gender } from "@/types";
import type { AvailabilityHeatmap as Heatmap, HeatLevel } from "@/types/preparation";

/**
 * Semáforo: etiqueta (y su forma corta, la que se ve en la celda junto al
 * número: el color nunca va solo), umbral y colores.
 */
export const HEAT_LEVEL: Record<HeatLevel, { label: string; short: string; range: string; cell: string; dot: string }> = {
  HIGH:     { label: "Buena",     short: "Buena",    range: "el 90 % o más",  cell: "bg-green-400/15 border-green-400/30",   dot: "bg-green-400"  },
  MEDIUM:   { label: "Aceptable", short: "Acept.",   range: "del 75 al 89 %", cell: "bg-yellow-400/15 border-yellow-400/30", dot: "bg-yellow-400" },
  LOW:      { label: "Justa",     short: "Justa",    range: "del 50 al 74 %", cell: "bg-orange-400/20 border-orange-400/40", dot: "bg-orange-400" },
  CRITICAL: { label: "Muy justa", short: "M. justa", range: "menos del 50 %", cell: "bg-red-400/25 border-red-400/50",       dot: "bg-red-400"    },
};

const LEVELS: HeatLevel[] = ["HIGH", "MEDIUM", "LOW", "CRITICAL"];

/** Las franjas de todas las jornadas, en orden de hora, sin repetir. */
export function slotColumns(days: Heatmap["days"]): string[] {
  return [...new Set(days.flatMap((d) => d.cells.map((c) => c.slot)))].sort();
}

/**
 * Mapa de calor de la disponibilidad: por jornada y franja, cuántas parejas
 * inscritas no pueden jugar, con un semáforo según la parte que sí puede.
 * Sirve para decidir horarios y pistas antes de programar.
 */
export function AvailabilityHeatmap({
  tournamentId,
  categories,
}: {
  tournamentId: string;
  categories: { id: string; gender: string; level: string }[];
}) {
  const [categoryId, setCategoryId] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tournament", tournamentId, "availability-heatmap", categoryId || "all"],
    queryFn: () => adminService.tournaments.availabilityHeatmap(tournamentId, categoryId || undefined),
  });

  const columns = useMemo(() => (data ? slotColumns(data.days) : []), [data]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-start justify-between gap-4 flex-wrap px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Disponibilidad de las parejas</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            En cada franja, cuántas parejas inscritas han dicho que no pueden jugar.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Categoría
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {GENDER_LABEL[c.gender as Gender]?.short ?? c.gender} {CATEGORY_LABEL_SHORT[c.level as CategoryLevel] ?? c.level}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Cargando la disponibilidad…
        </div>
      ) : isError || !data ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">
          No se pudo cargar la disponibilidad.{" "}
          <button onClick={() => refetch()} className="underline">Reintentar</button>
        </div>
      ) : data.days.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          El torneo no tiene jornadas: añádelas al editar el torneo para ver la disponibilidad.
        </p>
      ) : data.totalPairs === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">Aún no hay parejas inscritas.</p>
      ) : (
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{data.totalPairs}</span> parejas inscritas ·{" "}
            <span className="text-foreground font-semibold">{data.pairsWithRestrictions}</span> con alguna franja no disponible
          </p>

          {data.criticalCells > 0 && (
            <p role="status" className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle size={13} />
              En {data.criticalCells} {data.criticalCells === 1 ? "franja" : "franjas"} puede jugar menos de la mitad de las parejas: evita programar ahí.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0.5 text-[11px]">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 bg-card px-2 py-1 text-left font-medium text-muted-foreground">
                    Jornada
                  </th>
                  {columns.map((slot) => (
                    <th key={slot} scope="col" className="px-1 py-1 font-medium text-muted-foreground tabular-nums">
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => {
                  const bySlot = new Map(day.cells.map((c) => [c.slot, c]));
                  return (
                    <tr key={day.dayId}>
                      <th scope="row" className="sticky left-0 bg-card px-2 py-1 text-left font-medium text-foreground whitespace-nowrap">
                        {day.label}
                      </th>
                      {columns.map((slot) => {
                        const cell = bySlot.get(slot);
                        if (!cell)
                          return (
                            <td key={slot}>
                              <span className="sr-only">Sin franja</span>
                            </td>
                          );
                        const level = HEAT_LEVEL[cell.level];
                        const help = `${day.label} ${slot}: ${cell.unavailablePairs} de ${data.totalPairs} parejas no pueden (${cell.availablePct} % puede) · ${level.label}`;
                        return (
                          <td
                            key={slot}
                            title={help}
                            className={`w-12 min-w-12 py-1 text-center border rounded tabular-nums text-foreground ${level.cell}`}
                          >
                            <span aria-hidden className="block text-xs font-semibold leading-tight">{cell.unavailablePairs}</span>
                            <span aria-hidden className="block text-[9px] leading-tight text-muted-foreground">{level.short}</span>
                            <span className="sr-only">{help}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Leyenda">
            {LEVELS.map((l) => (
              <li key={l} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${HEAT_LEVEL[l].dot}`} aria-hidden />
                <span className="text-foreground">{HEAT_LEVEL[l].label}</span>: puede jugar {HEAT_LEVEL[l].range} de las parejas
              </li>
            ))}
            <li>El número es cuántas parejas no pueden.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
