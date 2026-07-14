"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { Clock, RotateCcw, X, Plus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { phaseLabel, GENDER_LABEL, CATEGORY_LABEL_SHORT } from "@/lib/constants";
import type { MatchResult, Gender, CategoryLevel } from "@/types";

const ROW_H = 64; // px per 30-min slot

export interface ScheduleTarget {
  /** "YYYY-MM-DDTHH:MM" (hora local, mismo formato que el editor inline). */
  date:  string;
  court: string;
}

interface Props {
  matches:        MatchResult[];
  duration:       number;
  tournament:     any;
  onMatchClick:   (m: MatchResult) => void;
  onCorrectClick: (m: MatchResult) => void;
  // Fase 2 — interactividad (opcionales; si no se pasan, la rejilla es de solo lectura).
  onMove?:        (m: MatchResult, target: ScheduleTarget) => void;
  onDelete?:      (m: MatchResult) => void;
  onCreateAt?:    (target: ScheduleTarget) => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function catLabel(tournament: any, categoryId: string): string {
  const cat = tournament?.categories?.find((c: any) => c.id === categoryId);
  if (!cat) return "";
  return `${GENDER_LABEL[cat.gender as Gender]?.short ?? cat.gender} ${CATEGORY_LABEL_SHORT[cat.level as CategoryLevel] ?? cat.level}`;
}

/** "09:00" -> 540 (minutos). null si no es una hora válida. */
function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** 540 -> "09:00" */
function fmtHHMM(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

// Opciones para los selectores de "horario visible" (cada 30 min, 06:00–24:00).
const HOUR_OPTIONS: number[] = [];
for (let t = 6 * 60; t <= 24 * 60; t += 30) HOUR_OPTIONS.push(t);

/** Contenido interno de la tarjeta de un partido (compartido con el DragOverlay). */
function MatchCardInner({
  m, tournament, isFinished, hasSets, onCorrectClick, onDelete, overlay,
}: {
  m:              MatchResult;
  tournament:     any;
  isFinished:     boolean;
  hasSets:        boolean;
  onCorrectClick: (m: MatchResult) => void;
  onDelete?:      (m: MatchResult) => void;
  overlay?:       boolean;
}) {
  const catLbl = catLabel(tournament, (m as any).categoryId ?? "");
  return (
    <div
      className={`h-full w-full rounded border flex flex-col gap-0.5 px-2 py-1.5 overflow-hidden text-[10px] transition-colors ${
        isFinished
          ? "bg-green-500/5 border-green-500/20"
          : "bg-[rgba(212,175,55,0.07)] border-[rgba(212,175,55,0.2)]"
      } ${overlay ? "shadow-lg" : ""}`}
    >
      {/* Phase + category + acciones */}
      <div className="flex items-center gap-1 min-w-0">
        <span className={`font-semibold shrink-0 ${isFinished ? "text-green-400" : "text-[#D4AF37]"}`}>
          {phaseLabel(m.phase)}
        </span>
        {catLbl && <span className="text-muted-foreground/60 truncate">{catLbl}</span>}
        {!overlay && (
          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            {isFinished && (
              <button
                onClick={(e) => { e.stopPropagation(); onCorrectClick(m); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-0.5 rounded text-muted-foreground/60 hover:text-amber-400 transition-colors"
                title="Corregir resultado"
              >
                <RotateCcw size={9} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(m); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-0.5 rounded text-muted-foreground/60 hover:text-red-400 transition-colors"
                title="Borrar partido"
              >
                <X size={9} />
              </button>
            )}
          </div>
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
  );
}

/** Tarjeta de partido posicionada en la rejilla, arrastrable si `draggable`. */
function DraggableMatch({
  m, tournament, colIdx, rowStart, rowSpan, draggable, onMatchClick, onCorrectClick, onDelete,
}: {
  m:              MatchResult;
  tournament:     any;
  colIdx:         number;
  rowStart:       number;
  rowSpan:        number;
  draggable:      boolean;
  onMatchClick:   (m: MatchResult) => void;
  onCorrectClick: (m: MatchResult) => void;
  onDelete?:      (m: MatchResult) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: m.id,
    data: { match: m },
    disabled: !draggable,
  });

  const isFinished = !!(m as any).isResult;
  const hasSets    = isFinished && (m as any).sets1 && (m as any).sets2;

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      onClick={() => !isFinished && onMatchClick(m)}
      className={`p-0.5 ${!isFinished ? "cursor-pointer" : ""}`}
      style={{
        gridColumn: colIdx + 2,
        gridRow: `${rowStart} / span ${rowSpan}`,
        zIndex: 10,
        opacity: isDragging ? 0.35 : 1,
        touchAction: draggable ? "none" : undefined,
      }}
    >
      <MatchCardInner
        m={m}
        tournament={tournament}
        isFinished={isFinished}
        hasSets={hasSets}
        onCorrectClick={onCorrectClick}
        onDelete={onDelete}
      />
    </div>
  );
}

/** Celda de fondo: destino de drop y (si `canCreate`) click para crear partido. */
function DroppableCell({
  slotMin, court, colIdx, rowIdx, borderClass, canCreate, onCreate,
}: {
  slotMin:     number;
  court:       string;
  colIdx:      number;
  rowIdx:      number;
  borderClass: string;
  canCreate:   boolean;
  onCreate:    (slotMin: number, court: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${slotMin}-${colIdx}`,
    data: { slotMin, court },
  });
  return (
    <div
      ref={setNodeRef}
      onClick={canCreate ? () => onCreate(slotMin, court) : undefined}
      className={`group border-r border-border ${borderClass} ${
        isOver ? "bg-[rgba(212,175,55,0.15)]" : canCreate ? "cursor-pointer hover:bg-secondary/40" : ""
      }`}
      style={{ gridColumn: colIdx + 2, gridRow: rowIdx + 2 }}
      title={canCreate ? "Crear partido aquí" : undefined}
    >
      {canCreate && (
        <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus size={14} className="text-[#D4AF37]/60" />
        </div>
      )}
    </div>
  );
}

export function ScheduleGrid({
  matches, duration, tournament, onMatchClick, onCorrectClick, onMove, onDelete, onCreateAt,
}: Props) {
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

  // Filas (pistas): todas las pistas configuradas del torneo primero (en su
  // orden), y luego cualquier pista que aparezca en un partido pero no esté en
  // la config. Así se ven TODAS las pistas, no solo las que ya tienen partido.
  const courts = useMemo(() => {
    const fromMatches = new Set<string>();
    for (const m of dayMatches) {
      const c = (m as any).court;
      if (c) fromMatches.add(c);
    }
    const configured: string[] = Array.isArray(tournament?.courts)
      ? tournament.courts.filter(Boolean)
      : [];
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const c of configured) if (!seen.has(c)) { seen.add(c); ordered.push(c); }
    for (const c of [...fromMatches].sort()) if (!seen.has(c)) { seen.add(c); ordered.push(c); }
    return ordered;
  }, [dayMatches, tournament]);

  const hasNoCourt = dayMatches.some((m) => !(m as any).court);
  const columns = hasNoCourt ? [...courts, "Sin pista"] : courts;

  // Horas configuradas del torneo (schedule[].slots). Si alguna jornada tiene
  // fecha que coincide con el día visible, se usan sus slots; si no, la unión
  // de todas las jornadas. Así la rejilla muestra TODO el rango horario del
  // torneo aunque no haya partido a esas horas.
  const scheduleMinutes = useMemo(() => {
    const days: any[] = Array.isArray(tournament?.schedule) ? tournament.schedule : [];
    if (days.length === 0) return [] as number[];
    let relevant = days;
    if (effectiveDate) {
      const matched = days.filter((d) => {
        const dd = d?.date;
        if (!dd) return false;
        return new Date(dd).toISOString().split("T")[0] === effectiveDate;
      });
      if (matched.length > 0) relevant = matched;
    }
    const mins: number[] = [];
    for (const d of relevant) {
      for (const s of (d?.slots ?? [])) {
        const mm = parseHHMM(s);
        if (mm != null) mins.push(mm);
      }
    }
    return mins;
  }, [tournament, effectiveDate]);

  // Rango por defecto del día: (1) horas configuradas del torneo si existen;
  // (2) si no, deducido de los partidos; (3) si no hay nada, 09:00–23:00.
  const defaultRange = useMemo(() => {
    const round = (lo: number, hi: number) => ({
      from: Math.floor(lo / 30) * 30,
      to: Math.ceil(hi / 30) * 30,
    });
    if (scheduleMinutes.length > 0) {
      return round(Math.min(...scheduleMinutes), Math.max(...scheduleMinutes) + duration);
    }
    const mt: number[] = [];
    for (const m of dayMatches) {
      const d = new Date((m as any).date);
      mt.push(d.getHours() * 60 + d.getMinutes());
    }
    if (mt.length > 0) return round(Math.min(...mt), Math.max(...mt) + duration);
    return { from: 9 * 60, to: 23 * 60 };
  }, [scheduleMinutes, dayMatches, duration]);

  // El usuario puede ajustar el rango visible; se resetea al cambiar de día.
  const [rangeOverride, setRangeOverride] = useState<{ from: number; to: number } | null>(null);
  useEffect(() => { setRangeOverride(null); }, [effectiveDate]);
  const range = rangeOverride ?? defaultRange;

  const { minMin, slots } = useMemo(() => {
    let lo = range.from, hi = range.to;
    // Nunca ocultar partidos: ensancha el rango para incluir cualquiera que
    // caiga fuera del horario visible.
    for (const m of dayMatches) {
      const d = new Date((m as any).date);
      const t = d.getHours() * 60 + d.getMinutes();
      lo = Math.min(lo, t);
      hi = Math.max(hi, t + duration);
    }
    lo = Math.floor(lo / 30) * 30;
    hi = Math.ceil(hi / 30) * 30;
    if (hi <= lo) return { minMin: lo, slots: [] };
    const s: number[] = [];
    for (let t = lo; t < hi; t += 30) s.push(t);
    return { minMin: lo, slots: s };
  }, [range, dayMatches, duration]);

  const unscheduled = matches.filter((m) => !(m as any).date);

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const canMove   = !!onMove;
  const canCreate = !!onCreateAt;
  const interactive = canMove || canCreate;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [activeMatch, setActiveMatch] = useState<MatchResult | null>(null);

  function handleDragStart(e: DragStartEvent) {
    const m = (e.active?.data?.current as any)?.match as MatchResult | undefined;
    setActiveMatch(m ?? null);
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveMatch(null);
    const m = (e.active?.data?.current as any)?.match as MatchResult | undefined;
    const over = e.over?.data?.current as { slotMin: number; court: string } | undefined;
    if (!m || !over || !onMove) return;
    if (over.court === "Sin pista") return;
    // Construye la fecha destino conservando el día del partido y cambiando
    // solo la hora — mismo formato "datetime-local" que el editor inline, para
    // no tener problemas de zona horaria.
    const base = new Date((m as any).date);
    const curMin = base.getHours() * 60 + base.getMinutes();
    const sameCourt = ((m as any).court ?? "Sin pista") === over.court;
    if (curMin === over.slotMin && sameCourt) return; // sin cambios
    base.setHours(Math.floor(over.slotMin / 60), over.slotMin % 60, 0, 0);
    const date = `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}T${pad2(base.getHours())}:${pad2(base.getMinutes())}`;
    onMove(m, { date, court: over.court });
  }

  function handleCreate(slotMin: number, court: string) {
    if (!onCreateAt || !effectiveDate) return;
    const date = `${effectiveDate}T${pad2(Math.floor(slotMin / 60))}:${pad2(slotMin % 60)}`;
    onCreateAt({ date, court });
  }

  if (dates.length === 0 && unscheduled.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center gap-3">
        <Clock size={36} className="text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No hay partidos programados aún</p>
      </div>
    );
  }

  const activeFinished = activeMatch ? !!(activeMatch as any).isResult : false;
  const activeHasSets  = activeFinished && (activeMatch as any)?.sets1 && (activeMatch as any)?.sets2;

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

      {/* Control de horario visible */}
      {effectiveDate && columns.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <Clock size={12} className="text-muted-foreground/60" />
          <span>Horario visible:</span>
          <select
            value={range.from}
            onChange={(e) => setRangeOverride({ from: +e.target.value, to: range.to })}
            className="bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground font-mono"
          >
            {HOUR_OPTIONS.filter((t) => t < range.to).map((t) => (
              <option key={t} value={t}>{fmtHHMM(t)}</option>
            ))}
          </select>
          <span>–</span>
          <select
            value={range.to}
            onChange={(e) => setRangeOverride({ from: range.from, to: +e.target.value })}
            className="bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground font-mono"
          >
            {HOUR_OPTIONS.filter((t) => t > range.from).map((t) => (
              <option key={t} value={t}>{fmtHHMM(t)}</option>
            ))}
          </select>
          {rangeOverride && (
            <button
              onClick={() => setRangeOverride(null)}
              className="ml-1 text-muted-foreground/60 hover:text-foreground underline underline-offset-2"
            >
              Restablecer
            </button>
          )}
          {interactive && (
            <span className="ml-auto text-[11px] text-muted-foreground/50">
              Arrastra para mover · click en hueco para crear
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      {effectiveDate && columns.length > 0 && slots.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
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
                  ...columns.map((col, ci) =>
                    interactive ? (
                      <DroppableCell
                        key={`cell-${slotMin}-${ci}`}
                        slotMin={slotMin}
                        court={col}
                        colIdx={ci}
                        rowIdx={si}
                        borderClass={borderClass}
                        canCreate={canCreate && col !== "Sin pista"}
                        onCreate={handleCreate}
                      />
                    ) : (
                      <div
                        key={`cell-${slotMin}-${ci}`}
                        className={`border-r border-border ${borderClass}`}
                        style={{ gridColumn: ci + 2, gridRow: si + 2 }}
                      />
                    ),
                  ),
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

                return (
                  <DraggableMatch
                    key={m.id}
                    m={m}
                    tournament={tournament}
                    colIdx={colIdx}
                    rowStart={rowStart}
                    rowSpan={rowSpan}
                    draggable={canMove && !isFinished}
                    onMatchClick={onMatchClick}
                    onCorrectClick={onCorrectClick}
                    onDelete={onDelete}
                  />
                );
              })}
            </div>
          </div>

          {/* Preview flotante mientras se arrastra */}
          <DragOverlay dropAnimation={null}>
            {activeMatch ? (
              <div style={{ width: 148 }} className="p-0.5">
                <MatchCardInner
                  m={activeMatch}
                  tournament={tournament}
                  isFinished={activeFinished}
                  hasSets={!!activeHasSets}
                  onCorrectClick={onCorrectClick}
                  overlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
