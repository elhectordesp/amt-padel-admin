"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { adminService } from "@/lib/services/admin";
import { CATEGORY_LABEL_SHORT, GENDER_LABEL } from "@/lib/constants";
import type { CategoryLevel, Gender } from "@/types";
import type { CategoryLevelSummary } from "@/types/preparation";

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/** «429-571» o «858 o más» (el nivel más alto no tiene techo). */
export function bandLabel(band: CategoryLevelSummary["band"]): string {
  if (!band) return "Sin banda";
  return band.max === null ? `${fmt(band.min)} o más` : `${fmt(band.min)}-${fmt(band.max)}`;
}

/**
 * Barra con la banda recomendada (dorada) y el rango de los inscritos (línea,
 * con un punto en la media), en la misma escala.
 */
function RangeBar({ s }: { s: CategoryLevelSummary }) {
  if (s.minSpa === null || s.maxSpa === null || s.avgSpa === null) return null;
  const top = s.band?.max ?? Math.max(s.maxSpa, (s.band?.min ?? 0) + 1);
  const lo = Math.min(s.minSpa, s.band?.min ?? s.minSpa);
  const hi = Math.max(s.maxSpa, top);
  const span = hi - lo || 1;
  const pct = (v: number) => `${((v - lo) / span) * 100}%`;
  const width = (a: number, b: number) => `${Math.max(((b - a) / span) * 100, 1)}%`;
  return (
    <div className="relative h-3 w-full rounded-full bg-secondary" aria-hidden>
      {s.band && (
        <div
          className="absolute inset-y-0 rounded-full bg-[#D4AF37]/30 border border-[#D4AF37]/50"
          style={{ left: pct(s.band.min), width: width(s.band.min, s.band.max ?? hi) }}
        />
      )}
      <div
        className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-foreground/70"
        style={{ left: pct(s.minSpa), width: width(s.minSpa, s.maxSpa) }}
      />
      <div
        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card"
        style={{ left: pct(s.avgSpa) }}
      />
    </div>
  );
}

/**
 * Nivel SPA de cada categoría: la banda recomendada para su nivel y el SPA
 * mínimo, medio y máximo de los jugadores inscritos, con cuántos quedan fuera.
 * Solo informa: no limita las inscripciones.
 */
export function CategoryLevelBands({ tournamentId }: { tournamentId: string }) {
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["tournament", tournamentId, "level-bands"],
    queryFn: () => adminService.tournaments.levelBands(tournamentId),
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Nivel SPA por categoría</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          La banda recomendada para cada nivel y el SPA de los jugadores inscritos. Solo informa: no limita las inscripciones.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Cargando el nivel…
        </div>
      ) : isError ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">
          No se pudo cargar el nivel de las categorías.{" "}
          <button onClick={() => refetch()} className="underline">Reintentar</button>
        </div>
      ) : data.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          El torneo aún no tiene categorías: añádelas para ver su nivel.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((s) => {
            const name = `${GENDER_LABEL[s.gender as Gender]?.short ?? s.gender} ${CATEGORY_LABEL_SHORT[s.level as CategoryLevel] ?? s.level}`;
            return (
              <li key={s.categoryId} className="px-5 py-3 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    Banda recomendada: <span className="text-foreground font-semibold tabular-nums">{bandLabel(s.band)}</span>
                  </span>
                </div>
                {s.players === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin jugadores inscritos.</p>
                ) : (
                  <>
                    <RangeBar s={s} />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                      <span>{s.players} {s.players === 1 ? "jugador" : "jugadores"}</span>
                      <span>Mín. <span className="text-foreground">{fmt(s.minSpa ?? 0)}</span></span>
                      <span>Media <span className="text-foreground font-semibold">{fmt(s.avgSpa ?? 0)}</span></span>
                      <span>Máx. <span className="text-foreground">{fmt(s.maxSpa ?? 0)}</span></span>
                    </div>
                    {(s.belowBand > 0 || s.aboveBand > 0 || s.lowReliability > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {s.belowBand > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-400/30 bg-blue-400/10 text-blue-300">
                            {s.belowBand} por debajo de la banda
                          </span>
                        )}
                        {s.aboveBand > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
                            {s.aboveBand} por encima de la banda
                          </span>
                        )}
                        {s.lowReliability > 0 && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground"
                            title="Han jugado pocos partidos: su SPA aún puede moverse mucho"
                          >
                            {s.lowReliability} con SPA poco fiable
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
