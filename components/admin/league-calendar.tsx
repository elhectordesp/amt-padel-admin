/**
 * El calendario de una liga: qué se juega cada día y en qué pista.
 * - Lista por fecha: los partidos de cada día por hora y, aparte, los que aún
 *   no tienen fecha. Desde cada partido se pone o cambia su fecha, hora y pista.
 * - Tablero por pista: un día, con sus pistas en columnas (la rejilla del
 *   programador de torneos); un partido se mueve arrastrándolo.
 * La ocupación de la pista (bloqueos, reservas y otros partidos) la comprueba
 * el back: si choca, el aviso dice con qué.
 */
"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { LeagueMatchScheduleDialog, type LeagueScheduleChange } from "@/components/admin/league-match-schedule-dialog";
import { ScheduleGrid, type ScheduleTarget } from "@/components/admin/schedule-grid";
import { scoreText } from "@/components/admin/league-tabs";
import { categoryLabel } from "@/lib/category-gender";
import { adminService } from "@/lib/services/admin";
import { leagueCalendar, leagueMatchTitle } from "@/lib/utils/league-calendar";
import { formatDayKey, tournamentTimeZone, zonedDateTimeToIso, zonedTime } from "@/lib/utils/time-zone";
import type { MatchResult, Tournament, TournamentCourt } from "@/types";

type View = "lista" | "tablero";

const VIEWS: { key: View; label: string }[] = [
  { key: "lista", label: "Lista por fecha" },
  { key: "tablero", label: "Tablero por pista" },
];

const ALL = "all";

interface Props {
  tournamentId: string;
  tournament: Tournament;
  /** Todos los partidos de la liga. */
  matches: readonly MatchResult[];
  /** Sin permiso para cambiar los torneos, el calendario solo se ve. */
  canWrite: boolean;
  /** Corregir el resultado de un partido ya jugado (lo abre la ficha). Sin él, no sale el botón. */
  onCorrectResult?: (match: MatchResult) => void;
}

const chip = (on: boolean) =>
  `text-xs font-medium rounded-md px-3 py-1.5 border transition-colors ${
    on
      ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10"
      : "border-border text-muted-foreground hover:text-foreground"
  }`;

export function LeagueCalendarTab({ tournamentId, tournament, matches, canWrite, onCorrectResult }: Props) {
  const qc = useQueryClient();
  const tz = tournamentTimeZone(tournament);
  const [view, setView] = useState<View>("lista");
  const [categoryId, setCategoryId] = useState(ALL);
  const [editing, setEditing] = useState<MatchResult | null>(null);

  const { data: tournamentCourts = [] } = useQuery<TournamentCourt[]>({
    queryKey: ["tournament-courts", tournamentId],
    queryFn: () => adminService.tournamentCourts.list(tournamentId),
  });
  const courts = useMemo(() => tournamentCourts.map((tc) => tc.court.name), [tournamentCourts]);

  const visible = useMemo(
    () => (categoryId === ALL ? [...matches] : matches.filter((m) => m.categoryId === categoryId)),
    [matches, categoryId],
  );
  const { days, unscheduled } = useMemo(() => leagueCalendar(visible, tz), [visible, tz]);
  const dated = useMemo(() => days.flatMap((d) => d.matches), [days]);

  const categoryOf = (m: MatchResult) => {
    const cat = tournament.categories.find((c) => c.id === m.categoryId);
    return cat ? categoryLabel(cat) : "";
  };

  const schedule = useMutation({
    mutationFn: ({ matchId, change, force }: { matchId: string; change: LeagueScheduleChange; force?: boolean }) =>
      adminService.matches.scheduleLeagueMatch(matchId, force ? { ...change, force: true } : change),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bracket", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["matches", tournamentId] });
    },
  });

  // Convención «Confirma para…»: si el back avisa de algo que se puede confirmar
  // (un día en que la liga no juega), se pregunta y se repite con force. Lo que
  // no se puede confirmar (pista ocupada, un jugador con otro partido) llega
  // como error
  const scheduleConfirmed = async (matchId: string, change: LeagueScheduleChange) => {
    try {
      await schedule.mutateAsync({ matchId, change });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/Confirma para/i.test(msg) && window.confirm(`${msg}\n\n¿Programarlo de todas formas?`)) {
        await schedule.mutateAsync({ matchId, change, force: true });
        return;
      }
      throw e;
    }
  };

  const save = async (matchId: string, change: LeagueScheduleChange) => {
    await scheduleConfirmed(matchId, change);
    toast.success(change.date ? "Partido programado" : "Partido sin fecha");
  };

  // Arrastrar en el tablero: la misma petición; si la pista está ocupada, el aviso del back
  const move = (m: MatchResult, target: ScheduleTarget) => {
    scheduleConfirmed(m.id, { date: zonedDateTimeToIso(target.date, tz) ?? null, court: target.court }).then(
      () => toast.success("Partido movido"),
      (e: unknown) => toast.error(e instanceof Error && e.message ? e.message : "No se pudo mover el partido"),
    );
  };

  const matchRow = (m: MatchResult, action: "edit" | "schedule") => (
    <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
      {m.date && (
        <span className="w-12 shrink-0 font-mono text-foreground">{zonedTime(m.date, tz)}</span>
      )}
      {m.date && (
        <span className={`w-24 shrink-0 truncate ${m.court ? "text-foreground" : "text-amber-400"}`}>
          {m.court ?? "Sin pista"}
        </span>
      )}
      <span className="shrink-0 text-[#D4AF37]">{leagueMatchTitle(m)}</span>
      {categoryOf(m) && <span className="shrink-0 text-muted-foreground">{categoryOf(m)}</span>}
      <span className="min-w-0 flex-1 truncate text-foreground">
        {m.team1.join(" / ") || "Por definir"}
        <span className="mx-1.5 font-mono text-muted-foreground">{scoreText(m)}</span>
        {m.team2.join(" / ") || "Por definir"}
      </span>
      {m.isResult && (
        <span className="inline-flex items-center gap-1 text-green-400">
          <CheckCircle size={11} /> Jugado
        </span>
      )}
      {canWrite && !m.isResult && (
        <button
          type="button"
          onClick={() => setEditing(m)}
          className="inline-flex items-center gap-1 rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] font-medium text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors"
        >
          {action === "edit" ? <Pencil size={10} /> : <CalendarClock size={10} />}
          {action === "edit" ? "Editar" : "Programar"}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Vista del calendario" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setView(v.key)} className={chip(view === v.key)}>
              {v.label}
            </button>
          ))}
        </div>
        {tournament.categories.length > 1 && (
          <select
            aria-label="Categoría"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="ml-auto h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value={ALL}>Todas las categorías</option>
            {tournament.categories.map((c) => (
              <option key={c.id} value={c.id}>{categoryLabel(c)}</option>
            ))}
          </select>
        )}
      </div>

      {view === "lista" ? (
        <>
          {days.length === 0 ? (
            <div className="bg-card border border-border rounded-lg py-10 px-4 text-center text-sm text-muted-foreground">
              Ningún partido tiene fecha todavía. Pon la de cada uno desde «Sin fecha», cuando las parejas te digan cuándo juegan.
            </div>
          ) : (
            days.map((day) => (
              <section key={day.dayKey} aria-label={day.dayKey} className="bg-card border border-border rounded-lg overflow-hidden">
                <h3 className="flex items-center justify-between px-4 py-2.5 bg-secondary/60 border-b border-border text-sm font-semibold text-[#D4AF37] capitalize">
                  {formatDayKey(day.dayKey, { weekday: "long", day: "numeric", month: "long" })}
                  <span className="text-[11px] font-normal text-muted-foreground normal-case">
                    {day.matches.length} partido{day.matches.length === 1 ? "" : "s"}
                  </span>
                </h3>
                <div className="divide-y divide-border">{day.matches.map((m) => matchRow(m, "edit"))}</div>
              </section>
            ))
          )}

          <section aria-label="Sin fecha" className="bg-card border border-border rounded-lg overflow-hidden">
            <h3 className="flex items-center gap-2 px-4 py-2.5 bg-secondary/60 border-b border-border text-sm font-semibold text-foreground">
              <Clock size={13} className="text-muted-foreground" />
              Sin fecha · {unscheduled.length} partido{unscheduled.length === 1 ? "" : "s"}
            </h3>
            {unscheduled.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Todos los partidos tienen fecha.</p>
            ) : (
              <div className="divide-y divide-border">{unscheduled.map((m) => matchRow(m, "schedule"))}</div>
            )}
          </section>
        </>
      ) : (
        <ScheduleGrid
          matches={dated}
          duration={tournament.matchDuration ?? 60}
          tournament={{ ...tournament, courts }}
          onMatchClick={(m) => canWrite && setEditing(m)}
          onCorrectClick={onCorrectResult}
          onMove={canWrite ? move : undefined}
        />
      )}

      {editing && (
        <LeagueMatchScheduleDialog
          match={editing}
          timeZone={tz}
          courts={courts}
          onSave={(change) => save(editing.id, change)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
