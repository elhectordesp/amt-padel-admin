"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { phaseLabel, GENDER_LABEL, CATEGORY_LABEL_SHORT } from "@/lib/constants";
import type { MatchResult, Gender, CategoryLevel } from "@/types";

const ROW_H = 64; // px per 30-min slot

interface Props {
  matches:        MatchResult[];
  duration:       number;
  tournament:     any;
  onMatchClick:   (m: MatchResult) => void;
  onCorrectClick: (m: MatchResult) => void;
}

function catLabel(tournament: any, categoryId: string): string {
  const cat = tournament?.categories?.find((c: any) => c.id === categoryId);
  if (!cat) return "";
  return `${GENDER_LABEL[cat.gender as Gender]?.short ?? cat.gender} ${CATEGORY_LABEL_SHORT[cat.level as CategoryLevel] ?? cat.level}`;
}

export function ScheduleGrid({ matches, duration, tournament, onMatchClick, onCorrectClick }: Props) {
  const matchesByDate = useMemo(() => {
    const map: Record<string, MatchResult[]> = {};
    for (const m of matches) {
      const raw = (m as any).date;
      if (!raw) continue;
      const iso = new Date(raw).toISOString().split("T")[0];
      (map[iso] ??= []).push(m);
    }
    return map;
  }, [matches]);

  const dates = useMemo(() => Object.keys(matchesByDate).sort(), [matchesByDate]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const effectiveDate =
    selectedDate && matchesByDate[selectedDate] ? selectedDate : (dates[0] ?? null);
  const dayMatches = useMemo(
    () => effectiveDate ? (matchesByDate[effectiveDate] ?? []) : [],
    [effectiveDate, matchesByDate],
  );

  const courts = useMemo(() => {
    const s = new Set<string>();
    for (const m of dayMatches) {
      const c = (m as any).court;
      if (c) s.add(c);
    }
    return [...s].sort();
  }, [dayMatches]);

  const hasNoCourt = dayMatches.some((m) => !(m as any).court);
  const columns = hasNoCourt ? [...courts, "Sin pista"] : courts;

  const { minMin, slots } = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const m of dayMatches) {
      const d = new Date((m as any).date);
      const t = d.getHours() * 60 + d.getMinutes();
      lo = Math.min(lo, t);
      hi = Math.max(hi, t + duration);
    }
    if (!isFinite(lo)) return { minMin: 0, slots: [] };
    lo = Math.floor(lo / 30) * 30;
    hi = Math.ceil(hi / 30) * 30;
    const s: number[] = [];
    for (let t = lo; t < hi; t += 30) s.push(t);
    return { minMin: lo, slots: s };
  }, [dayMatches, duration]);

  const unscheduled = matches.filter((m) => !(m as any).date);

  if (dates.length === 0 && unscheduled.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center gap-3">
        <Clock size={36} className="text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No hay partidos programados aún</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Day tabs */}
      {dates.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                d === effectiveDate
                  ? "bg-[rgba(212,175,55,0.15)] border-[rgba(212,175,55,0.4)] text-[#D4AF37]"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-[rgba(212,175,55,0.3)]"
              }`}
            >
              {new Date(d + "T12:00:00").toLocaleDateString("es-ES", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              <span className="ml-1.5 text-[10px] opacity-60">({matchesByDate[d].length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {effectiveDate && columns.length > 0 && slots.length > 0 && (
        <div className="rounded-lg border border-border overflow-auto bg-card">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `44px repeat(${columns.length}, minmax(148px, 1fr))`,
              gridTemplateRows: `40px repeat(${slots.length}, ${ROW_H}px)`,
              minWidth: `${44 + columns.length * 148}px`,
            }}
          >
            {/* Top-left corner */}
            <div
              className="border-b border-r border-border bg-secondary/40"
              style={{ gridColumn: 1, gridRow: 1 }}
            />

            {/* Court header cells */}
            {columns.map((col, ci) => (
              <div
                key={col}
                className="flex items-center justify-center px-3 border-b border-r border-border bg-secondary/40 text-xs font-semibold text-foreground"
                style={{ gridColumn: ci + 2, gridRow: 1 }}
              >
                {col}
              </div>
            ))}

            {/* Time axis + background cells */}
            {slots.flatMap((slotMin, si) => {
              const isHour = slotMin % 60 === 0;
              const borderClass = isHour
                ? "border-t border-t-border/50"
                : "border-t border-t-border/10";
              return [
                <div
                  key={`t-${slotMin}`}
                  className={`flex items-start justify-end pr-1.5 pt-1 border-r border-border ${borderClass}`}
                  style={{ gridColumn: 1, gridRow: si + 2 }}
                >
                  {isHour && (
                    <span className="text-[10px] font-mono text-muted-foreground/60 leading-none">
                      {String(Math.floor(slotMin / 60)).padStart(2, "0")}:00
                    </span>
                  )}
                </div>,
                ...columns.map((_, ci) => (
                  <div
                    key={`cell-${slotMin}-${ci}`}
                    className={`border-r border-border ${borderClass}`}
                    style={{ gridColumn: ci + 2, gridRow: si + 2 }}
                  />
                )),
              ];
            })}

            {/* Match cards */}
            {dayMatches.map((m) => {
              const d        = new Date((m as any).date);
              const matchMin = d.getHours() * 60 + d.getMinutes();
              const rowStart = (matchMin - minMin) / 30 + 2;
              const rowSpan  = Math.max(1, Math.ceil(duration / 30));
              const court    = (m as any).court ?? "Sin pista";
              const colIdx   = columns.indexOf(court);
              if (colIdx < 0) return null;

              const isFinished = !!(m as any).isResult;
              const catLbl     = catLabel(tournament, (m as any).categoryId ?? "");
              const hasSets    = isFinished && (m as any).sets1 && (m as any).sets2;

              return (
                <div
                  key={m.id}
                  className="p-0.5"
                  style={{
                    gridColumn: colIdx + 2,
                    gridRow: `${rowStart} / span ${rowSpan}`,
                    zIndex: 10,
                  }}
                >
                  <div
                    onClick={() => !isFinished && onMatchClick(m)}
                    className={`h-full w-full rounded border flex flex-col gap-0.5 px-2 py-1.5 overflow-hidden text-[10px] transition-colors ${
                      isFinished
                        ? "bg-green-500/5 border-green-500/20"
                        : "bg-[rgba(212,175,55,0.07)] border-[rgba(212,175,55,0.2)] cursor-pointer hover:bg-[rgba(212,175,55,0.14)]"
                    }`}
                  >
                    {/* Phase + category + correction button */}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`font-semibold shrink-0 ${isFinished ? "text-green-400" : "text-[#D4AF37]"}`}>
                        {phaseLabel(m.phase)}
                      </span>
                      {catLbl && (
                        <span className="text-muted-foreground/60 truncate">{catLbl}</span>
                      )}
                      {isFinished && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCorrectClick(m); }}
                          className="ml-auto shrink-0 p-0.5 rounded text-muted-foreground/60 hover:text-amber-400 transition-colors"
                          title="Corregir resultado"
                        >
                          <RotateCcw size={9} />
                        </button>
                      )}
                    </div>

                    {/* Teams */}
                    <p className="truncate text-foreground/80 font-medium leading-tight">
                      {m.team1.join(" / ") || "Por definir"}
                    </p>
                    <p className="truncate text-foreground/80 font-medium leading-tight">
                      {m.team2.join(" / ") || "Por definir"}
                    </p>

                    {/* Score */}
                    {hasSets && (
                      <p className="font-mono text-green-400 text-[9px] leading-tight mt-0.5">
                        {(m as any).sets1.map((s: number, i: number) => `${s}-${(m as any).sets2[i]}`).join("  ")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Matches without date */}
      {unscheduled.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 bg-secondary/30 border-b border-border flex items-center gap-2">
            <Clock size={11} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">
              Sin programar · {unscheduled.length} partido(s)
            </span>
          </div>
          <div className="divide-y divide-border">
            {unscheduled.map((m) => (
              <div
                key={m.id}
                onClick={() => onMatchClick(m)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 cursor-pointer"
              >
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.2)] shrink-0">
                  {phaseLabel(m.phase)}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {catLabel(tournament, (m as any).categoryId ?? "")}
                </span>
                <span className="text-xs font-medium text-foreground truncate">
                  {m.team1.join(" / ") || "Por definir"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">vs</span>
                <span className="text-xs font-medium text-foreground truncate">
                  {m.team2.join(" / ") || "Por definir"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
