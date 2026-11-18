"use client";

/**
 * Las pestañas de la ficha de una liga:
 * - Jornadas: los partidos de cada categoría por grupo y por jornada, con el
 *   resultado como en el resto de la ficha (el modal lo abre la página).
 * - Clasificación: la de cada grupo, la que calcula el back para los grupos
 *   de cualquier torneo (puntos, enfrentamiento directo, sets y juegos).
 * Una liga no tiene fecha ni pista por partido: la jornada es el número de
 * ronda y su fecha, orientativa, es una semana por jornada desde el inicio.
 */
import { useState } from "react";
import { CheckCircle, RotateCcw } from "lucide-react";
import { categoryLabel } from "@/lib/category-gender";
import { leagueRoundDate } from "@/lib/utils/league-days";
import { leagueRounds, type StandingsGroupLike } from "@/lib/utils/league-rounds";
import { formatDayKey } from "@/lib/utils/time-zone";
import type { MatchResult, TournamentCategory } from "@/types";

/** Una fila de la clasificación tal como la devuelve el back. */
export interface LeagueStandingRow {
  pos: number;
  userId: string;
  partnerId?: string | null;
  name: string;
  played: number;
  wins: number;
  points: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
}

export interface LeagueStandingsGroup extends StandingsGroupLike {
  rows: LeagueStandingRow[];
  /** Cuántos pasan de este grupo al cuadro final (2 si no se ha tocado). */
  qualifyCount?: number;
}

type CategoryRef = Pick<TournamentCategory, "id" | "gender" | "level">;

/** La categoría elegida (la primera por defecto) y los botones para cambiarla si hay varias. */
function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: readonly CategoryRef[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (categories.length < 2) return null;
  return (
    <div role="group" aria-label="Categoría" className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
          className={`text-xs font-medium rounded-md px-3 py-1.5 border transition-colors ${
            value === c.id
              ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {categoryLabel(c)}
        </button>
      ))}
    </div>
  );
}

export const scoreText = (m: MatchResult) =>
  m.isWalkover
    ? "W.O."
    : m.isResult && m.sets1 && m.sets2
      ? m.sets1.map((s, i) => `${s}-${m.sets2![i]}`).join(" / ")
      : "vs";

// ── Jornadas ──────────────────────────────────────────────────────────────

interface RoundsProps {
  /** Inicio de la liga («YYYY-MM-DD»): la semana de la jornada 1. */
  startDate: string;
  categories: readonly CategoryRef[];
  /** Todos los partidos de la liga. */
  matches: readonly MatchResult[];
  /** La clasificación de los grupos de cada categoría (por id). */
  standings: Record<string, LeagueStandingsGroup[] | undefined>;
  onEnterResult: (match: MatchResult) => void;
  onCorrectResult: (match: MatchResult) => void;
  /** Sin permiso para meter resultados, las jornadas solo se ven (por defecto, sí). */
  canWrite?: boolean;
}

export function LeagueRoundsTab({ startDate, categories, matches, standings, onEnterResult, onCorrectResult, canWrite = true }: RoundsProps) {
  const [picked, setPicked] = useState("");
  const categoryId = categories.some((c) => c.id === picked) ? picked : (categories[0]?.id ?? "");
  const groups = leagueRounds(
    matches.filter((m) => m.categoryId === categoryId),
    standings[categoryId] ?? [],
  );

  return (
    <div className="space-y-4">
      <CategoryPicker categories={categories} value={categoryId} onChange={setPicked} />

      {groups.length === 0 ? (
        <div className="bg-card border border-border rounded-lg py-12 px-4 text-center text-sm text-muted-foreground">
          Esta categoría aún no tiene jornadas. Se crean al sortear sus grupos, en la pestaña «Grupos».
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map((group) => (
            <section key={group.name} aria-label={group.name} className="bg-card border border-border rounded-lg overflow-hidden">
              <h3 className="px-4 py-2.5 bg-secondary/60 border-b border-border text-sm font-semibold text-[#D4AF37]">
                {group.name}
              </h3>
              <div className="divide-y divide-border">
                {group.rounds.map((round) => {
                  const played = round.matches.filter((m) => m.isResult).length;
                  const weekOf = formatDayKey(leagueRoundDate(startDate, round.round), { day: "numeric", month: "short" });
                  return (
                    <div key={round.round} className="p-4 space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          Jornada {round.round}
                        </h4>
                        <span className="text-[11px] text-muted-foreground">
                          Semana del {weekOf} · {played}/{round.matches.length} jugados
                        </span>
                      </div>

                      {round.matches.map((m) => (
                        <div key={m.id} className="bg-secondary/40 border border-border rounded-md px-3 py-2 space-y-1">
                          <div className="flex flex-col sm:grid text-xs sm:items-center gap-0.5 sm:gap-1" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                            <span className={`truncate sm:text-left ${m.winner === "team1" ? "text-[#D4AF37] font-semibold" : "text-muted-foreground"}`}>
                              {m.team1.join(" / ") || "Por definir"}
                            </span>
                            <span className="text-[10px] font-mono text-foreground text-center whitespace-nowrap sm:px-1">{scoreText(m)}</span>
                            <span className={`truncate sm:text-right ${m.winner === "team2" ? "text-[#D4AF37] font-semibold" : "text-muted-foreground"}`}>
                              {m.team2.join(" / ") || "Por definir"}
                            </span>
                          </div>
                          <div className="flex justify-end">
                            {!canWrite ? null : m.isResult ? (
                              <button
                                type="button"
                                onClick={() => onCorrectResult(m)}
                                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-amber-400 transition-colors"
                                title="Corregir resultado"
                              >
                                <RotateCcw size={9} /> Corregir
                              </button>
                            ) : m.team1.length > 0 && m.team2.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => onEnterResult(m)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] font-medium text-[#D4AF37] hover:bg-[#D4AF37]/20 hover:border-[#D4AF37] transition-colors"
                                title="Introducir resultado"
                              >
                                <CheckCircle size={10} /> Meter resultado
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      {round.resting.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Descansa: <span className="text-foreground">{round.resting.join(", ")}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Clasificación ─────────────────────────────────────────────────────────

interface StandingsProps {
  categories: readonly CategoryRef[];
  /** La clasificación de los grupos de cada categoría (por id); sin cargar, undefined. */
  standings: Record<string, LeagueStandingsGroup[] | undefined>;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const diffClass = (n: number) => (n > 0 ? "text-green-400" : n < 0 ? "text-red-400" : "text-muted-foreground");

export function LeagueStandingsTab({ categories, standings }: StandingsProps) {
  const [picked, setPicked] = useState("");
  const categoryId = categories.some((c) => c.id === picked) ? picked : (categories[0]?.id ?? "");
  const groups = standings[categoryId];

  return (
    <div className="space-y-4">
      <CategoryPicker categories={categories} value={categoryId} onChange={setPicked} />

      {!groups ? (
        <p className="text-xs text-muted-foreground py-2">Cargando clasificación...</p>
      ) : groups.length === 0 ? (
        <div className="bg-card border border-border rounded-lg py-12 px-4 text-center text-sm text-muted-foreground">
          Esta categoría aún no tiene clasificación. Se crea al sortear sus grupos, en la pestaña «Grupos».
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map((group) => (
            <div key={group.id} className="bg-card border border-border rounded-lg overflow-hidden">
              <h3 className="px-4 py-2.5 bg-secondary/60 border-b border-border text-sm font-semibold text-[#D4AF37]">
                {group.label}
              </h3>
              <div className="overflow-x-auto">
                <table aria-label={`Clasificación ${group.label}`} className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-1.5 text-left font-medium w-5">#</th>
                      <th className="px-2 py-1.5 text-left font-medium">Pareja</th>
                      <th className="px-2 py-1.5 text-center font-medium w-6" title="Partidos jugados">PJ</th>
                      <th className="px-2 py-1.5 text-center font-medium w-6" title="Partidos ganados">PG</th>
                      <th className="px-2 py-1.5 text-center font-medium w-8" title="Sets ganados">S+</th>
                      <th className="px-2 py-1.5 text-center font-medium w-8" title="Sets perdidos">S-</th>
                      <th className="px-2 py-1.5 text-center font-medium w-8" title="Diferencia de sets">DS</th>
                      <th className="px-2 py-1.5 text-center font-medium w-8" title="Juegos ganados">J+</th>
                      <th className="px-2 py-1.5 text-center font-medium w-8" title="Juegos perdidos">J-</th>
                      <th className="px-2 py-1.5 text-center font-medium w-8" title="Diferencia de juegos">DJ</th>
                      <th className="px-2 py-1.5 text-center font-medium w-7" title="Puntos">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.userId} className="border-b border-border last:border-0">
                        <td className="px-2 py-1.5 font-bold text-muted-foreground">{row.pos}</td>
                        <td className="px-2 py-1.5 text-foreground max-w-[160px]">
                          <span className="block truncate">{row.name}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.played}</td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.wins}</td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.setsWon}</td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.setsLost}</td>
                        <td className={`px-2 py-1.5 text-center font-semibold ${diffClass(row.setDiff)}`}>{signed(row.setDiff)}</td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.gamesWon}</td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.gamesLost}</td>
                        <td className={`px-2 py-1.5 text-center font-semibold ${diffClass(row.gameDiff)}`}>{signed(row.gameDiff)}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-foreground">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
