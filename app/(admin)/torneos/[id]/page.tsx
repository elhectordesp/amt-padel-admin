"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy, Calendar, ChevronLeft, MapPin,
  Check, X, Clock, Download, Search, Loader2,
  GitBranch, CheckCircle, Copy, Trash2, ChevronRight,
  Square, CheckSquare, Lock, RefreshCw, CalendarDays, Printer, Tv2,
  LayoutGrid, Star, Power, PowerOff, Plus, Ban, CalendarOff, AlarmClock,
  Pencil, Send, EyeOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { AvailabilityModal } from "@/components/admin/availability-modal";
import { ResultModal } from "@/components/admin/result-modal";
import { BracketEditor, type PreviewGroup } from "@/components/admin/bracket-editor";
import { ErrorState } from "@/components/admin/error-state";
import { CustomSelect } from "@/components/admin/form";
import { adminService, type ScheduleConflict, type ConflictType } from "@/lib/services/admin";
import { downloadCsv } from "@/lib/utils/csv";
import { printRegistrations } from "@/lib/utils/print";
import {
  CATEGORY_LABEL_SHORT, GENDER_LABEL,
  TOURNAMENT_STATUS_LABEL, TOURNAMENT_STATUS_COLOR,
  resolveTier, phaseLabel,
} from "@/lib/constants";
import type { AdminRegistration, RegistrationStatus, MatchResult, TournamentStatus, TournamentCourt, CourtUnavailability, Gender, CategoryLevel } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

const STATUS_CONFIG: Record<RegistrationStatus, { label: string; color: string; icon: React.ElementType }> = {
  CONFIRMED: { label: "Confirmado", color: "text-green-400 bg-green-400/10 border-green-400/30",    icon: Check },
  PENDING:   { label: "Pendiente",  color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30", icon: Clock },
  WAITLIST:  { label: "En espera",  color: "text-blue-400 bg-blue-400/10 border-blue-400/30",       icon: Clock },
  CANCELLED: { label: "Cancelado",  color: "text-red-400 bg-red-400/10 border-red-400/30",          icon: Clock },
};

// ── Sub-components ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: RegistrationStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

// ── Pair grouping (1 fila por pareja+categoría) ───────────────────────────
interface PairReg {
  pairKey: string;
  ids:     string[];
  primary: AdminRegistration;
  status:  RegistrationStatus;
}

function groupByPair(regs: AdminRegistration[]): PairReg[] {
  const seen: Set<string> = new Set();
  const result: PairReg[] = [];
  for (const reg of regs) {
    const sorted = [reg.userId, reg.partnerId ?? ""].sort().join(":");
    const key    = `${sorted}::${reg.categoryId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const partnerReg = reg.partnerId
      ? regs.find((r) => r.userId === reg.partnerId && r.categoryId === reg.categoryId)
      : null;
    result.push({ pairKey: key, ids: partnerReg ? [reg.id, partnerReg.id] : [reg.id], primary: reg, status: reg.status });
  }
  return result;
}

// ── Conflict labels ───────────────────────────────────────────────────────────
const CONFLICT_LABEL: Record<ConflictType, string> = {
  MISSING_ASSIGNMENT:   "Sin horario",
  COURT_OVERLAP:        "Pista solapada",
  PLAYER_DOUBLE_BOOKED: "Jugador doblado",
};
const CONFLICT_COLOR: Record<ConflictType, string> = {
  MISSING_ASSIGNMENT:   "text-destructive",
  COURT_OVERLAP:        "text-yellow-400",
  PLAYER_DOUBLE_BOOKED: "text-orange-400",
};

// ── ConflictModal ─────────────────────────────────────────────────────────────
function ConflictModal({
  conflicts, forcing, onClose, onForce,
}: {
  conflicts: ScheduleConflict[];
  forcing:   boolean;
  onClose:   () => void;
  onForce:   () => void;
}) {
  const blocking = conflicts.filter((c) => c.type === "MISSING_ASSIGNMENT");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Conflictos de horario</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-2 max-h-72 overflow-y-auto">
          {conflicts.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`text-[10px] font-bold uppercase shrink-0 mt-0.5 ${CONFLICT_COLOR[c.type]}`}>
                {CONFLICT_LABEL[c.type]}
              </span>
              <span className="text-xs text-muted-foreground">{c.description}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          {blocking.length === 0 && (
            <button
              onClick={onForce}
              disabled={forcing}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-yellow-400/10 border border-yellow-400/30 text-sm text-yellow-400 font-semibold hover:bg-yellow-400/15 disabled:opacity-50 transition-colors"
            >
              {forcing && <Loader2 size={13} className="animate-spin" />}
              Publicar igualmente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CalendarTab ───────────────────────────────────────────────────────────────
function CalendarTab({
  matches, loading, isError, refetch, autoSchedule, onMatchClick, tournament, tournamentId,
}: {
  matches:      MatchResult[];
  loading:      boolean;
  isError:      boolean;
  refetch:      () => void;
  autoSchedule: { mutate: (force?: boolean) => void; isPending: boolean };
  onMatchClick: (m: MatchResult) => void;
  tournament:   any;
  tournamentId: string;
}) {
  const qc = useQueryClient();

  // Publish state
  const [publishCatId,    setPublishCatId]    = useState<string | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<ScheduleConflict[]>([]);
  const [showConflicts,   setShowConflicts]   = useState(false);
  const [unpublishCatId,  setUnpublishCatId]  = useState<string | null>(null);

  // Inline match edit state
  const [editMatchId,  setEditMatchId]  = useState<string | null>(null);
  const [editDate,     setEditDate]     = useState("");
  const [editCourt,    setEditCourt]    = useState("");
  const [editConflicts,setEditConflicts]= useState<ScheduleConflict[]>([]);

  // Courts for inline edit select
  const { data: courts = [] } = useQuery<TournamentCourt[]>({
    queryKey: ["tournament-courts", tournamentId],
    queryFn:  () => adminService.tournamentCourts.list(tournamentId),
  });

  // Group matches by category then by date
  const byCat = useMemo(() => {
    const map: Record<string, MatchResult[]> = {};
    for (const m of (Array.isArray(matches) ? matches : [])) {
      const key = (m as any).categoryId ?? "unknown";
      (map[key] ??= []).push(m);
    }
    return map;
  }, [matches]);

  // ── Publish mutation ────────────────────────────────────────────────────────
  const publishMut = useMutation({
    mutationFn: ({ catId, force }: { catId: string; force?: boolean }) =>
      adminService.schedule.publish(tournamentId, catId, force),
    onSuccess: (res, { catId }) => {
      if (!res.published) {
        setPendingConflicts(res.conflicts);
        setPublishCatId(catId);
        setShowConflicts(true);
      } else {
        const w = res.conflicts.length;
        toast.success(w > 0
          ? `Horario publicado con ${w} advertencia(s)`
          : "Horario publicado. Jugadores notificados.");
        setShowConflicts(false);
        setPublishCatId(null);
        qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Unpublish mutation ──────────────────────────────────────────────────────
  const unpublishMut = useMutation({
    mutationFn: (catId: string) => adminService.schedule.unpublish(tournamentId, catId),
    onSuccess: () => {
      toast.success("Horario despublicado. Los jugadores ya no verán el horario.");
      setUnpublishCatId(null);
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Patch match mutation ────────────────────────────────────────────────────
  const patchMut = useMutation({
    mutationFn: ({ matchId, data }: { matchId: string; data: { date?: string; court?: string; force?: boolean } }) =>
      adminService.schedule.patchMatch(matchId, data),
    onSuccess: (res, { data }) => {
      if (res.conflicts?.length > 0 && !data.force) {
        setEditConflicts(res.conflicts);
      } else {
        toast.success("Partido actualizado");
        setEditMatchId(null);
        setEditConflicts([]);
        qc.invalidateQueries({ queryKey: ["matches", tournamentId] });
        qc.invalidateQueries({ queryKey: ["bracket", tournamentId] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (m: MatchResult) => {
    setEditMatchId(m.id);
    const d = (m as any).date ? new Date((m as any).date) : null;
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditDate(d
      ? `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      : "");
    setEditCourt((m as any).court ?? "");
    setEditConflicts([]);
  };

  const cancelEdit = () => { setEditMatchId(null); setEditDate(""); setEditCourt(""); setEditConflicts([]); };

  const saveEdit = (matchId: string, force = false) => {
    patchMut.mutate({ matchId, data: { date: editDate || undefined, court: editCourt.trim() || undefined, force } });
  };

  const exportCsv = () => {
    const catMap = Object.fromEntries(
      (tournament?.categories ?? []).map((c: any) => [
        c.id,
        `${GENDER_LABEL[c.gender as Gender]?.short ?? c.gender} ${CATEGORY_LABEL_SHORT[c.level as CategoryLevel] ?? c.level}`,
      ]),
    );

    const rows = [...matches]
      .filter((m) => !!(m as any).date)
      .sort((a, b) => new Date((a as any).date).getTime() - new Date((b as any).date).getTime())
      .map((m) => {
        const d = new Date((m as any).date);
        return {
          Fecha:      d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
          Hora:       d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          Pista:      (m as any).court ?? "—",
          Categoría:  catMap[(m as any).categoryId ?? ""] ?? "—",
          Fase:       phaseLabel(m.phase),
          "Equipo 1": m.team1.join(" / "),
          "Equipo 2": m.team2.join(" / "),
          Estado:     m.status === "finished" ? "Finalizado" : "Pendiente",
        };
      });

    const name = tournament?.name
      ? `horario_${tournament.name.replace(/\s+/g, "_").toLowerCase()}`
      : "horario";
    downloadCsv(name, rows);
  };

  // TODO Fix #18: añadir toggle Lista/Grid — grid con eje X=pistas, eje Y=horas por día (tipo Google Calendar)

  return (
    <div className="space-y-4">
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Calendar size={14} className="text-[#D4AF37]" />
          Partidos ({matches.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={matches.filter((m) => !!(m as any).date).length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-yellow-400/50 transition-colors disabled:opacity-50"
            title="Exportar horario como CSV"
          >
            <Download size={11} />
            Exportar CSV
          </button>
          <button
            onClick={() => autoSchedule.mutate(false)}
            disabled={autoSchedule.isPending || matches.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.3)] text-xs text-[#D4AF37] font-semibold hover:bg-[rgba(212,175,55,0.2)] transition-colors disabled:opacity-50"
          >
            {autoSchedule.isPending ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
            Asignar horarios
          </button>
          <button
            onClick={() => autoSchedule.mutate(true)}
            disabled={autoSchedule.isPending || matches.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-yellow-400/50 transition-colors disabled:opacity-50"
            title="Borra todos los horarios no jugados y los recalcula desde cero"
          >
            <RefreshCw size={11} />
            Reprogramar todo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-card border border-border rounded-lg">
          <ErrorState message="No se pudieron cargar los partidos." onRetry={refetch} />
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center gap-3">
          <Calendar size={36} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay partidos registrados aún</p>
        </div>
      ) : (
        // Per-category sections
        tournament.categories.map((cat: any) => {
          const catMatches = byCat[cat.id] ?? [];
          if (catMatches.length === 0) return null;

          const isPublished   = !!cat.schedulePublishedAt;
          const publishedDate = cat.schedulePublishedAt
            ? new Date(cat.schedulePublishedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
            : null;
          const isPublishing  = publishMut.isPending && publishCatId === cat.id;

          const byDate = catMatches.reduce<Record<string, MatchResult[]>>((acc, m) => {
            const raw  = (m as any).date;
            const str  = raw ? (typeof raw === "string" ? raw : String(raw)) : null;
            const date = str ? (str.includes("T") ? str.split("T")[0] : str) : "sin-fecha";
            (acc[date] ??= []).push(m);
            return acc;
          }, {});

          return (
            <div key={cat.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Category header */}
              <div className="flex items-center justify-between px-5 py-3 bg-secondary/50 border-b border-border">
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-semibold text-foreground">
                    {GENDER_LABEL[cat.gender as Gender]?.short ?? cat.gender} {CATEGORY_LABEL_SHORT[cat.level as CategoryLevel] ?? cat.level}
                  </h4>
                  {isPublished ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-green-400/30 text-green-400 bg-green-400/10">
                      <CheckCircle size={9} /> Publicado · {publishedDate}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border text-muted-foreground">
                      <Clock size={9} /> Sin publicar
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isPublished && (
                    <button
                      onClick={() => setUnpublishCatId(cat.id)}
                      disabled={unpublishMut.isPending && unpublishCatId === cat.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {unpublishMut.isPending && unpublishCatId === cat.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <EyeOff size={11} />}
                      Despublicar
                    </button>
                  )}
                  <button
                    onClick={() => { setPublishCatId(cat.id); publishMut.mutate({ catId: cat.id }); }}
                    disabled={isPublishing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.3)] text-xs text-[#D4AF37] font-semibold hover:bg-[rgba(212,175,55,0.2)] transition-colors disabled:opacity-50"
                  >
                    {isPublishing ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                    {isPublished ? "Republicar" : "Publicar horario"}
                  </button>
                </div>
              </div>

              {/* Matches grouped by date */}
              {Object.entries(byDate).map(([date, dayMatches]) => {
                const label    = date === "sin-fecha"
                  ? "Sin fecha asignada"
                  : new Date(date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
                const pending  = dayMatches.filter((m) => !(m as any).isResult).length;
                const finished = dayMatches.filter((m) =>  (m as any).isResult).length;

                return (
                  <div key={date}>
                    <div className="flex items-center justify-between px-5 py-2 bg-secondary/20 border-b border-border">
                      <p className="text-xs font-semibold text-foreground capitalize">{label}</p>
                      <div className="flex items-center gap-3 text-xs">
                        {finished > 0 && <span className="flex items-center gap-1 text-green-400"><CheckCircle size={11} /> {finished}</span>}
                        {pending  > 0 && <span className="flex items-center gap-1 text-yellow-400"><Clock size={11} /> {pending} pendientes</span>}
                      </div>
                    </div>

                    <div className="divide-y divide-border">
                      {dayMatches.map((m) => {
                        const time      = (m as any).date
                          ? new Date((m as any).date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
                          : "—";
                        const isEditing = editMatchId === m.id;

                        return (
                          <div key={m.id}>
                            {/* Match row */}
                            <div
                              className={`flex items-center gap-4 px-5 py-3 hover:bg-secondary/30 transition-colors ${!(m as any).isResult && !isEditing ? "cursor-pointer" : ""}`}
                              onClick={() => !(m as any).isResult && !isEditing && onMatchClick(m)}
                            >
                              <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{time}</span>
                              <span className="text-xs text-muted-foreground w-16 shrink-0 truncate">{(m as any).court || "—"}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.2)] shrink-0">
                                {phaseLabel(m.phase)}
                              </span>
                              <div className="flex-1 flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-foreground truncate">{((m as any).team1 ?? []).join(" / ") || "Por definir"}</span>
                                <span className="text-xs text-muted-foreground shrink-0">vs</span>
                                <span className="text-sm font-medium text-foreground truncate">{((m as any).team2 ?? []).join(" / ") || "Por definir"}</span>
                              </div>
                              {(m as any).isResult && (m as any).sets1 && (m as any).sets2 ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <CheckCircle size={13} className="text-green-400" />
                                  <span className="text-xs font-mono text-foreground">
                                    {(m as any).sets1.map((s: number, i: number) => `${s}-${(m as any).sets2[i]}`).join(" / ")}
                                  </span>
                                </div>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-yellow-400 shrink-0">
                                  <Clock size={12} /> Pendiente
                                </span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); isEditing ? cancelEdit() : startEdit(m); }}
                                className={`p-1.5 rounded-md border transition-colors shrink-0 ${
                                  isEditing
                                    ? "border-[rgba(212,175,55,0.4)] text-[#D4AF37] bg-[rgba(212,175,55,0.1)]"
                                    : "border-border text-muted-foreground hover:text-[#D4AF37] hover:border-[rgba(212,175,55,0.4)]"
                                }`}
                                title="Editar fecha y pista"
                              >
                                <Pencil size={11} />
                              </button>
                            </div>

                            {/* Inline edit form */}
                            {isEditing && (
                              <div className="px-5 pb-4 pt-3 bg-[rgba(212,175,55,0.03)] border-b border-[rgba(212,175,55,0.15)] space-y-3">
                                <div className="flex items-end gap-3 flex-wrap">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fecha y hora</label>
                                    <input
                                      type="datetime-local"
                                      value={editDate}
                                      onChange={(e) => { setEditDate(e.target.value); setEditConflicts([]); }}
                                      className="h-8 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Pista</label>
                                    <select
                                      value={editCourt}
                                      onChange={(e) => { setEditCourt(e.target.value); setEditConflicts([]); }}
                                      className="h-8 w-36 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                                    >
                                      <option value="">— Sin pista —</option>
                                      {courts.filter((c) => c.isAvailable).map((c) => (
                                        <option key={c.court.name} value={c.court.name}>{c.court.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-2 pb-0.5">
                                    <button
                                      onClick={() => saveEdit(m.id)}
                                      disabled={patchMut.isPending}
                                      className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-xs font-semibold hover:bg-[#C9A227] disabled:opacity-50"
                                    >
                                      {patchMut.isPending && !editConflicts.length ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                      Guardar
                                    </button>
                                    <button onClick={cancelEdit} className="h-8 px-3 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                                      Cancelar
                                    </button>
                                  </div>
                                </div>

                                {editConflicts.length > 0 && (
                                  <div className="rounded-md bg-yellow-400/5 border border-yellow-400/20 p-3 space-y-2">
                                    <p className="text-xs font-semibold text-yellow-400">Conflictos detectados:</p>
                                    {editConflicts.map((c, i) => (
                                      <p key={i} className="text-xs text-muted-foreground">{c.description}</p>
                                    ))}
                                    <button
                                      onClick={() => saveEdit(m.id, true)}
                                      disabled={patchMut.isPending}
                                      className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-yellow-400/10 border border-yellow-400/30 text-xs text-yellow-400 font-semibold hover:bg-yellow-400/15 disabled:opacity-50"
                                    >
                                      {patchMut.isPending ? <Loader2 size={11} className="animate-spin" /> : null}
                                      Guardar igualmente
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }).filter(Boolean)
      )}

      {showConflicts && (
        <ConflictModal
          conflicts={pendingConflicts}
          forcing={publishMut.isPending}
          onClose={() => { setShowConflicts(false); setPublishCatId(null); }}
          onForce={() => publishCatId && publishMut.mutate({ catId: publishCatId, force: true })}
        />
      )}

      <ConfirmModal
        open={!!unpublishCatId}
        title="Despublicar horario"
        description="Los jugadores dejarán de ver el horario de esta categoría en la app. Podrás volver a publicarlo cuando lo corrijas."
        confirmLabel="Despublicar"
        danger
        loading={unpublishMut.isPending}
        onClose={() => setUnpublishCatId(null)}
        onConfirm={() => unpublishCatId && unpublishMut.mutate(unpublishCatId)}
      />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
// ── PistasTab ──────────────────────────────────────────────────────────────

const UNAV_LABEL: Record<string, string> = {
  TOURNAMENT: "Todo el torneo",
  DAY:        "Día completo",
  SLOT:       "Franja horaria",
};
const UNAV_ICON: Record<string, React.ElementType> = {
  TOURNAMENT: Ban,
  DAY:        CalendarOff,
  SLOT:       AlarmClock,
};

function UnavailabilityRow({
  u, tournamentId, courtId, onRemoved,
}: { u: CourtUnavailability; tournamentId: string; courtId: string; onRemoved: () => void }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => adminService.tournamentCourts.removeUnavailability(tournamentId, courtId, u.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["tournament-courts", tournamentId] }); onRemoved(); toast.success("Bloqueo eliminado"); },
    onError:    (e: Error) => toast.error(e.message),
  });
  const Icon = UNAV_ICON[u.type] ?? Ban;
  const dateStr = u.date ? new Date(u.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "";
  const timeStr = u.startTime && u.endTime
    ? `${new Date(u.startTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} – ${new Date(u.endTime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
    : "";

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-destructive/5 border border-destructive/15 group">
      <Icon size={11} className="text-destructive shrink-0" />
      <div className="flex-1 min-w-0 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{UNAV_LABEL[u.type]}</span>
        {dateStr && <span> · {dateStr}</span>}
        {timeStr && <span> · {timeStr}</span>}
        {u.reason && <span> · {u.reason}</span>}
      </div>
      <button
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/15 text-destructive transition-opacity"
      >
        {remove.isPending ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
      </button>
    </div>
  );
}

function AddUnavailabilityForm({
  tournamentId, courtId, onAdded,
}: { tournamentId: string; courtId: string; onAdded: () => void }) {
  const qc = useQueryClient();
  const [type,      setType]      = useState<"TOURNAMENT" | "DAY" | "SLOT">("DAY");
  const [date,      setDate]      = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime,   setEndTime]   = useState("");
  const [reason,    setReason]    = useState("");

  const add = useMutation({
    mutationFn: () => adminService.tournamentCourts.addUnavailability(tournamentId, courtId, {
      type,
      date:      date      || undefined,
      startTime: startTime ? `${date}T${startTime}:00` : undefined,
      endTime:   endTime   ? `${date}T${endTime}:00`   : undefined,
      reason:    reason.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournament-courts", tournamentId] });
      setDate(""); setStartTime(""); setEndTime(""); setReason("");
      onAdded();
      toast.success("Bloqueo añadido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Añadir bloqueo</p>
      <div className="grid grid-cols-3 gap-1">
        {(["TOURNAMENT", "DAY", "SLOT"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`py-1 text-[11px] rounded border transition-colors ${type === t ? "border-[#D4AF37] text-[#D4AF37] bg-[rgba(212,175,55,0.08)]" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {UNAV_LABEL[t]}
          </button>
        ))}
      </div>
      {(type === "DAY" || type === "SLOT") && (
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
      )}
      {type === "SLOT" && (
        <div className="grid grid-cols-2 gap-1">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none" />
          <input type="time" value={endTime}   onChange={(e) => setEndTime(e.target.value)}   className="h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none" />
        </div>
      )}
      <input
        value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (opcional)"
        className="w-full h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
      />
      <button
        onClick={() => add.mutate()}
        disabled={add.isPending}
        className="w-full py-1.5 text-xs rounded bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-50 flex items-center justify-center gap-1"
      >
        {add.isPending && <Loader2 size={11} className="animate-spin" />} Añadir bloqueo
      </button>
    </div>
  );
}

function TournamentCourtCard({ tc, tournamentId }: { tc: TournamentCourt; tournamentId: string }) {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const toggleAvail = useMutation({
    mutationFn: () => adminService.tournamentCourts.setAvailability(tournamentId, tc.courtId, !tc.isAvailable),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["tournament-courts", tournamentId] }),
    onError:    (e: Error) => toast.error(e.message),
  });

  return (
    <div className={`bg-card border rounded-lg p-4 space-y-3 ${!tc.isAvailable ? "opacity-60" : ""}`}>
      {/* Court header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {tc.court.isCentral && <Star size={13} className="text-[#D4AF37] fill-[#D4AF37] shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{tc.court.name}</p>
            {(tc.court.surface || tc.court.isIndoor) && (
              <p className="text-[10px] text-muted-foreground">
                {tc.court.surface ?? ""}
                {tc.court.isIndoor ? " · Cubierta" : ""}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => toggleAvail.mutate()}
          disabled={toggleAvail.isPending}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${tc.isAvailable ? "border-green-400/30 text-green-400 bg-green-400/5 hover:bg-green-400/10" : "border-red-400/30 text-red-400 bg-red-400/5 hover:bg-red-400/10"}`}
          title={tc.isAvailable ? "Marcar como no disponible" : "Marcar como disponible"}
        >
          {toggleAvail.isPending
            ? <Loader2 size={10} className="animate-spin" />
            : tc.isAvailable ? <Power size={10} /> : <PowerOff size={10} />
          }
          {tc.isAvailable ? "Disponible" : "No disponible"}
        </button>
      </div>

      {/* Unavailability blocks */}
      {tc.unavailabilities.length > 0 && (
        <div className="space-y-1">
          {tc.unavailabilities.map((u) => (
            <UnavailabilityRow
              key={u.id}
              u={u}
              tournamentId={tournamentId}
              courtId={tc.courtId}
              onRemoved={() => {}}
            />
          ))}
        </div>
      )}

      {/* Add unavailability */}
      {tc.isAvailable && (
        showAddForm ? (
          <AddUnavailabilityForm
            tournamentId={tournamentId}
            courtId={tc.courtId}
            onAdded={() => setShowAddForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-1 py-1 text-[11px] rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#D4AF37]/40 transition-colors"
          >
            <Plus size={10} /> Añadir bloqueo
          </button>
        )
      )}
    </div>
  );
}

function PistasTab({ tournamentId }: { tournamentId: string }) {
  const { data: courts = [], isLoading } = useQuery({
    queryKey: ["tournament-courts", tournamentId],
    queryFn:  () => adminService.tournamentCourts.list(tournamentId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <LayoutGrid size={36} className="text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No hay pistas asociadas a este torneo.</p>
        <p className="text-xs text-muted-foreground/60">Las pistas se añaden automáticamente al crear el torneo desde el club.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {courts.filter((c) => c.isAvailable).length} de {courts.length} pistas disponibles
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courts.map((tc) => (
          <TournamentCourtCard key={tc.id} tc={tc} tournamentId={tournamentId} />
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

type Tab = "resumen" | "inscripciones" | "calendario" | "cuadro" | "pistas";

export default function TorneoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();

  const [tab,             setTab]           = useState<Tab>("resumen");
  const [regFilter,       setRegFilter]     = useState<"all" | RegistrationStatus>("all");
  const [regCatFilter,    setRegCatFilter]  = useState<string>("all");
  const [regSearch,       setRegSearch]     = useState("");
  const [regPage,         setRegPage]       = useState(0);
  const [selectedKeys,    setSelectedKeys]  = useState<Set<string>>(new Set());
  const [updatingIds,     setUpdatingIds]   = useState<Set<string>>(new Set());
  const [bracketCatId,       setBracketCatId]       = useState("");
  const [showDeleteModal,    setShowDeleteModal]    = useState(false);
  const [bracketPreview,     setBracketPreview]     = useState<{ groups: PreviewGroup[]; totalMatches: number; isGroups: boolean } | null>(null);
  const [loadingPreview,     setLoadingPreview]     = useState(false);
  const [regenCatId,         setRegenCatId]         = useState<string | null>(null);
  const [regenElimCatId,     setRegenElimCatId]     = useState<string | null>(null);
  const [availRegId,         setAvailRegId]         = useState<string | null>(null);
  const [resultMatch,        setResultMatch]        = useState<any | null>(null);
  const [savingResultId,     setSavingResultId]     = useState<string | null>(null);
  const [showStandingsCatId, setShowStandingsCatId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const {
    data: tournament, isLoading, isError: isErrorTournament, refetch: refetchTournament,
  } = useQuery({
    queryKey: ["tournament", id],
    queryFn:  () => adminService.tournaments.detail(id),
  });

  const {
    data: registrations = [], isLoading: loadingRegs, isError: isErrorRegs, refetch: refetchRegs,
  } = useQuery({
    queryKey:  ["registrations", id],
    queryFn:   () => adminService.registrations.list(id),
    enabled:   tab === "inscripciones",
    staleTime: 60_000,
  });

  const {
    data: matches = [], isLoading: loadingMatches, isError: isErrorMatches, refetch: refetchMatches,
  } = useQuery({
    queryKey: ["matches", id],
    queryFn:  () => adminService.matches.list(id),
    enabled:  tab === "calendario",
  });

  const {
    data: bracketMatches = [],
  } = useQuery({
    queryKey: ["bracket", id],
    queryFn:  () => adminService.matches.list(id),
  });

  // Standings — carga todas las categorías que hayan pasado por grupos
  const { data: allStandings = {} } = useQuery({
    queryKey: ["standings", id],
    queryFn:  async () => {
      if (!tournament) return {};
      // Todas las categorías (en cualquier fase) pueden tener grupos
      const results = await Promise.all(
        tournament.categories.map((c) =>
          adminService.tournaments.groups(id, c.id)
            .then((data) => ({ catId: c.id, data }))
            .catch(() => ({ catId: c.id, data: [] }))
        )
      );
      return Object.fromEntries(results.map(({ catId, data }) => [catId, data]));
    },
    enabled: !!tournament,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const bulkStatus = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      adminService.registrations.bulkStatus(ids, status),
    onSuccess: (res: any, { ids }) => {
      qc.invalidateQueries({ queryKey: ["registrations", id] });
      setSelectedKeys(new Set());
      setUpdatingIds(new Set());
      const updated = res?.count ?? res?.updated ?? ids.length;
      toast.success(`${updated} inscripción(es) actualizadas`);
    },
    onError: (err: Error) => { toast.error(err.message); setUpdatingIds(new Set()); },
  });

  const duplicate = useMutation({
    mutationFn: () => adminService.tournaments.duplicate(id),
    onSuccess:  (t) => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Torneo duplicado");
      router.push(`/torneos/${t.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTournament = useMutation({
    mutationFn: () => adminService.tournaments.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Torneo eliminado");
      router.push("/torneos");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const invalidateBracket = () => {
    qc.invalidateQueries({ queryKey: ["tournament", id] });
    qc.invalidateQueries({ queryKey: ["matches", id] });
    qc.invalidateQueries({ queryKey: ["bracket", id] });
    qc.invalidateQueries({ queryKey: ["standings", id] });
    refetchTournament();
    setTab("cuadro");
  };

  const generateBracket = useMutation({
    mutationFn: (customGroups?: string[][]) => adminService.tournaments.generateBracket(id, bracketCatId, customGroups),
    onSuccess:  (res: any) => {
      if (res?.scheduleWarning) {
        toast.success("Cuadro generado correctamente");
        toast.warning(res.scheduleWarning, { duration: 6000 });
      } else if (res?.scheduled) {
        toast.success("Cuadro generado y horarios programados automáticamente");
      } else {
        toast.success("Cuadro generado correctamente");
      }
      setBracketPreview(null);
      setBracketCatId("");
      invalidateBracket();
    },
    onError: (err: Error) => { toast.error(err.message); setBracketPreview(null); },
  });

  const regenerateBracket = useMutation({
    mutationFn: (categoryId: string) => adminService.tournaments.regenerateBracket(id, categoryId),
    onSuccess:  () => {
      toast.success("Cuadro regenerado correctamente");
      setRegenCatId(null);
      invalidateBracket();
    },
    onError: (err: Error) => { toast.error(err.message); setRegenCatId(null); },
  });

  const regenerateElimination = useMutation({
    mutationFn: (categoryId: string) => adminService.tournaments.regenerateElimination(id, categoryId),
    onSuccess:  () => {
      toast.success("Eliminatorias regeneradas correctamente");
      setRegenElimCatId(null);
      invalidateBracket();
    },
    onError: (err: Error) => { toast.error(err.message); setRegenElimCatId(null); },
  });

  const saveResult = async (sets1: number[], sets2: number[]) => {
    if (!resultMatch) return;
    setSavingResultId(resultMatch.id);
    try {
      await adminService.matches.setResult(resultMatch.id, sets1, sets2);
      toast.success("Resultado guardado");
      setResultMatch(null);
      qc.invalidateQueries({ queryKey: ["matches", id] });
      qc.invalidateQueries({ queryKey: ["bracket", id] });
      qc.invalidateQueries({ queryKey: ["standings", id] });
      qc.invalidateQueries({ queryKey: ["tournament", id] });
    } catch (err: any) {
      toast.error(err.message ?? "Error al guardar resultado");
    } finally {
      setSavingResultId(null);
    }
  };

  const handlePreviewBracket = async () => {
    if (!bracketCatId) return;
    setLoadingPreview(true);
    try {
      const preview = await adminService.tournaments.previewBracket(id, bracketCatId) as any;
      setBracketPreview({ groups: preview.groups, totalMatches: preview.totalMatches, isGroups: preview.isGroups });
    } catch (err: any) {
      toast.error(err.message ?? "Error al generar la previsualización");
    } finally {
      setLoadingPreview(false);
    }
  };

  const autoSchedule = useMutation({
    mutationFn: (force?: boolean) => adminService.tournaments.autoSchedule(id, force),
    onSuccess:  (res) => {
      const msg = res.failures?.length
        ? `${res.count} partidos programados. Sin hueco: ${res.failures.join(", ")}`
        : `Se han asignado horarios a ${res.count} partidos`;
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["matches", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePairStatus = (pair: PairReg, status: string) => {
    setUpdatingIds(new Set(pair.ids));
    bulkStatus.mutate({ ids: pair.ids, status });
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const pairs = useMemo(() => groupByPair(registrations), [registrations]);

  const filteredPairs = useMemo(() =>
    pairs
      .filter((p) => regFilter === "all" || p.status === regFilter)
      .filter((p) => regCatFilter === "all" || p.primary.categoryId === regCatFilter)
      .filter((p) => {
        if (!regSearch.trim()) return true;
        const q = regSearch.toLowerCase();
        return p.primary.user.name.toLowerCase().includes(q) ||
               (p.primary.partner?.name ?? "").toLowerCase().includes(q);
      }),
  [pairs, regFilter, regCatFilter, regSearch]);

  const totalPages = Math.ceil(filteredPairs.length / PAGE_SIZE);
  const pagedPairs = filteredPairs.slice(regPage * PAGE_SIZE, (regPage + 1) * PAGE_SIZE);

  const regCounts = useMemo(() => ({
    all:       pairs.length,
    confirmed: pairs.filter((p) => p.status === "CONFIRMED").length,
    pending:   pairs.filter((p) => p.status === "PENDING").length,
    waitlist:  pairs.filter((p) => p.status === "WAITLIST").length,
  }), [pairs]);

  const allPageSelected = pagedPairs.length > 0 && pagedPairs.every((p) => selectedKeys.has(p.pairKey));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        pagedPairs.forEach((p) => next.delete(p.pairKey));
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        pagedPairs.forEach((p) => next.add(p.pairKey));
        return next;
      });
    }
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleBulkAction = (status: string) => {
    const allIds = pairs.filter((p) => selectedKeys.has(p.pairKey)).flatMap((p) => p.ids);
    bulkStatus.mutate({ ids: allIds, status });
  };

  // Reset page when filter/search changes
  const handleFilterChange = (f: "all" | RegistrationStatus) => {
    setRegFilter(f);
    setRegPage(0);
    setSelectedKeys(new Set());
  };
  const handleSearchChange = (v: string) => {
    setRegSearch(v);
    setRegPage(0);
    setSelectedKeys(new Set());
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Torneo" />
        <div className="flex-1 p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-card animate-pulse border border-border" />
          ))}
        </div>
      </div>
    );
  }

  if (isErrorTournament || !tournament) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Torneo" />
        <ErrorState
          message="No se pudo cargar el torneo."
          onRetry={refetchTournament}
        />
      </div>
    );
  }

  const totalSpots      = tournament.categories.reduce((s, c) => s + c.totalSpots, 0);
  const totalRegistered = tournament.categories.reduce((s, c) => s + c.registeredCount, 0);
  const fillPct         = totalSpots > 0 ? Math.round((totalRegistered / totalSpots) * 100) : 0;
  const tierDisplay     = resolveTier(tournament.spaTier, tournament.tier);

  const catOptions = [
    { value: "", label: "Seleccionar categoría..." },
    ...tournament.categories.map((cat) => ({
      value: cat.id,
      label: `${GENDER_LABEL[cat.gender].short} ${CATEGORY_LABEL_SHORT[cat.level]}`,
    })),
  ];

  return (
    <>
    <div className="flex flex-col min-h-full">
      <Header title={tournament.name} />

      <div className="flex-1 p-6 space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/torneos" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ChevronLeft size={14} /> Torneos
          </Link>
          <span>/</span>
          <span className="text-foreground">{tournament.name}</span>
        </div>

        {/* Tournament header card */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-heading text-xl text-foreground">{tournament.name}</h2>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${TOURNAMENT_STATUS_COLOR[tournament.status as TournamentStatus]}`}>
                  {TOURNAMENT_STATUS_LABEL[tournament.status as TournamentStatus]}
                </span>
                {tierDisplay && (
                  <span
                    className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    style={{ color: tierDisplay.color, backgroundColor: tierDisplay.color + "22", borderColor: tierDisplay.color + "55" }}
                  >
                    {tierDisplay.label.toUpperCase()}
                  </span>
                )}
                {tournament.registrationDeadline && (() => {
                  const closed = new Date() > new Date(tournament.registrationDeadline);
                  const label  = new Date(tournament.registrationDeadline).toLocaleString("es-ES", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      closed
                        ? "text-destructive bg-destructive/10 border-destructive/30"
                        : "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
                    }`}>
                      <Lock size={9} />
                      {closed ? `Insc. cerradas · ${label}` : `Cierre · ${label}`}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-[#D4AF37]" />
                  {tournament.dates}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#D4AF37]" />
                  {tournament.club?.name ?? ""}
                </span>
                {tournament.prize && (
                  <span className="flex items-center gap-1.5">
                    <Trophy size={14} className="text-[#D4AF37]" />
                    {tournament.prize}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => duplicate.mutate()}
                disabled={duplicate.isPending}
                title="Duplicar torneo"
                aria-label="Duplicar torneo"
                className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
              >
                {duplicate.isPending ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                title="Eliminar torneo"
                aria-label="Eliminar torneo"
                className="p-2 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
              >
                <Trash2 size={15} />
              </button>
              <Link
                href={`/torneo/${id}/live`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir widget de resultados en vivo (para TV o pantalla grande)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-[#D4AF37] hover:border-[rgba(212,175,55,0.4)] transition-colors"
              >
                <Tv2 size={14} />
                Widget TV
              </Link>
              <Link
                href={`/torneos/${id}/editar`}
                className="px-4 py-2 rounded-md border border-border text-sm text-foreground hover:bg-secondary transition-colors"
              >
                Editar
              </Link>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-heading text-[#D4AF37]">{totalRegistered}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Parejas inscritas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-heading text-foreground">{totalSpots}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Plazas totales</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-heading text-foreground">{tournament.categories.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Categorías</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-heading text-foreground">{fillPct}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ocupación</p>
              <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-[#D4AF37] rounded-full" style={{ width: `${fillPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="overflow-x-auto no-scrollbar border-b border-border">
          <div className="flex items-center gap-0 w-max min-w-full">
            {([
              { key: "resumen",       label: "Resumen"        },
              { key: "inscripciones", label: `Inscripciones (${pairs.length || registrations.length || "…"})` },
              { key: "calendario",    label: "Calendario"     },
              { key: "cuadro",        label: "Cuadro"         },
              { key: "pistas",        label: "Pistas"         },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`whitespace-nowrap px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === key
                    ? "border-[#D4AF37] text-[#D4AF37]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── RESUMEN TAB ── */}
        {tab === "resumen" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Categorías</h3>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    {["Categoría", "Plazas (parejas)", "Parejas inscritas", "Ocupación"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tournament.categories.map((cat) => {
                    const pairSpots = cat.totalSpots;
                    const pairCount = cat.registeredCount;
                    const pct = pairSpots > 0 ? Math.round((pairCount / pairSpots) * 100) : 0;
                    return (
                      <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {GENDER_LABEL[cat.gender].short} {CATEGORY_LABEL_SHORT[cat.level]}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{pairSpots}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{pairCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : "bg-[#D4AF37]"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Fase actual por categoría</h3>
              <div className="space-y-3">
                {tournament.categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">
                      {GENDER_LABEL[cat.gender].short} {CATEGORY_LABEL_SHORT[cat.level]}
                    </span>
                    <div className="flex-1 h-1 bg-secondary rounded-full" />
                    <span className="text-xs text-[#D4AF37] w-32 text-right shrink-0">
                      {cat.currentPhaseLabel ?? cat.currentPhase}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INSCRIPCIONES TAB ── */}
        {tab === "inscripciones" && (
          <div className="space-y-4">
            {/* Filters + search */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 bg-secondary rounded-lg p-1">
                {([
                  { key: "all",        label: `Todos (${regCounts.all})`            },
                  { key: "CONFIRMED",  label: `Confirmados (${regCounts.confirmed})` },
                  { key: "PENDING",    label: `Pendientes (${regCounts.pending})`    },
                  { key: "WAITLIST",   label: `En espera (${regCounts.waitlist})`    },
                ] as { key: "all" | RegistrationStatus; label: string }[]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => handleFilterChange(f.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      regFilter === f.key
                        ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {tournament.categories.length > 1 && (
                  <select
                    value={regCatFilter}
                    onChange={(e) => { setRegCatFilter(e.target.value); setRegPage(0); }}
                    className="h-9 px-2 rounded-md bg-secondary border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="all">Todas las categorías</option>
                    {tournament.categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.gender === "M" ? "Masc." : "Fem."} {c.level}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-border">
                  <Search size={14} className="text-muted-foreground shrink-0" />
                  <input
                    value={regSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Buscar pareja o jugador..."
                    className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-48"
                  />
                </div>
                <button
                  onClick={() => {
                    const rows = filteredPairs.map((p) => ({
                      Jugador1:   p.primary.user.name,
                      "Email J1": p.primary.user.email ?? "",
                      "Nivel J1": p.primary.user.categoryLevel ?? "",
                      "SPA J1":   p.primary.user.spaPoints ?? "",
                      Jugador2:   p.primary.partner?.name ?? "",
                      "Email J2": p.primary.partner?.email ?? "",
                      "Nivel J2": p.primary.partner?.categoryLevel ?? "",
                      "SPA J2":   p.primary.partner?.spaPoints ?? "",
                      Categoría:  `${p.primary.category.gender === "M" ? "Masc." : "Fem."} ${p.primary.category.level}`,
                      Estado:     p.status,
                      Pago:       p.primary.paid ? "Sí" : "No",
                      Fecha:      p.primary.createdAt,
                    }));
                    downloadCsv(`inscripciones-${id}`, rows);
                  }}
                  disabled={filteredPairs.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#D4AF37] transition-colors disabled:opacity-40"
                >
                  <Download size={13} />
                  CSV
                </button>
                <button
                  onClick={() => tournament && printRegistrations(tournament, pairs)}
                  disabled={pairs.length === 0}
                  title="Abrir lista de impresión en nueva pestaña"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#D4AF37] transition-colors disabled:opacity-40"
                >
                  <Printer size={13} />
                  Imprimir
                </button>
              </div>
            </div>

            {/* Bulk action bar */}
            {selectedKeys.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.25)]">
                <span className="text-xs font-medium text-[#D4AF37]">{selectedKeys.size} pareja(s) seleccionada(s)</span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => handleBulkAction("CONFIRMED")}
                    disabled={bulkStatus.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-400/10 border border-green-400/30 text-xs text-green-400 font-medium hover:bg-green-400/20 transition-colors disabled:opacity-50"
                  >
                    {bulkStatus.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Confirmar
                  </button>
                  <button
                    onClick={() => handleBulkAction("WAITLIST")}
                    disabled={bulkStatus.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-400/10 border border-blue-400/30 text-xs text-blue-400 font-medium hover:bg-blue-400/20 transition-colors disabled:opacity-50"
                  >
                    <Clock size={11} /> En espera
                  </button>
                  <button
                    onClick={() => handleBulkAction("CANCELLED")}
                    disabled={bulkStatus.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  >
                    <X size={11} /> Rechazar
                  </button>
                  <button
                    onClick={() => setSelectedKeys(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {loadingRegs ? (
                <div className="space-y-0">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 px-5 py-4 border-b border-border">
                      <div className="h-4 w-40 rounded bg-secondary animate-pulse" />
                      <div className="h-4 w-24 rounded bg-secondary animate-pulse" />
                      <div className="h-4 w-20 rounded bg-secondary animate-pulse ml-auto" />
                    </div>
                  ))}
                </div>
              ) : isErrorRegs ? (
                <ErrorState message="No se pudieron cargar las inscripciones." onRetry={refetchRegs} />
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 w-10">
                        <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground transition-colors">
                          {allPageSelected
                            ? <CheckSquare size={15} className="text-[#D4AF37]" />
                            : <Square size={15} />
                          }
                        </button>
                      </th>
                      {["Pareja / Jugador", "Nivel SPA", "Categoría", "Estado", "Pago", "Acciones"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPairs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                          No hay inscripciones
                        </td>
                      </tr>
                    ) : pagedPairs.map((pair) => {
                      const reg        = pair.primary;
                      const isSelected = selectedKeys.has(pair.pairKey);
                      const isUpdating = pair.ids.some((id) => updatingIds.has(id));
                      return (
                        <tr
                          key={pair.pairKey}
                          className={`border-b border-border last:border-0 transition-colors ${isSelected ? "bg-[rgba(212,175,55,0.04)]" : "hover:bg-secondary/30"}`}
                        >
                          <td className="px-4 py-3.5">
                            <button onClick={() => toggleSelect(pair.pairKey)} className="text-muted-foreground hover:text-foreground transition-colors">
                              {isSelected
                                ? <CheckSquare size={15} className="text-[#D4AF37]" />
                                : <Square size={15} />
                              }
                            </button>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-medium text-foreground">{reg.user.name}</p>
                            {reg.partner?.name
                              ? <p className="text-xs text-muted-foreground">{reg.partner.name}</p>
                              : <p className="text-xs text-muted-foreground italic">Sin pareja</p>
                            }
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-foreground">{reg.user.categoryLevel ?? "—"}</span>
                                {reg.user.spaPoints != null && (
                                  <span className="text-[10px] text-muted-foreground">({Math.round(Number(reg.user.spaPoints))} SPA)</span>
                                )}
                              </div>
                              {reg.partner && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground">{reg.partner.categoryLevel ?? "—"}</span>
                                  {reg.partner.spaPoints != null && (
                                    <span className="text-[10px] text-muted-foreground">({Math.round(Number(reg.partner.spaPoints))} SPA)</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs text-muted-foreground">{`${reg.category.gender === "M" ? "Masc." : "Fem."} ${reg.category.level}`}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={pair.status} />
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs font-medium ${reg.paid ? "text-green-400" : "text-yellow-400"}`}>
                              {reg.paid ? "Pagado" : "Pendiente"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setAvailRegId(pair.primary.id)}
                                title="Ver disponibilidad"
                                className="p-1.5 rounded-md hover:bg-[rgba(212,175,55,0.1)] text-muted-foreground hover:text-[#D4AF37] transition-colors"
                              >
                                <CalendarDays size={14} />
                              </button>
                              {pair.status !== "CONFIRMED" && (
                                <button
                                  onClick={() => handlePairStatus(pair, "CONFIRMED")}
                                  disabled={isUpdating}
                                  className="p-1.5 rounded-md hover:bg-green-400/10 text-muted-foreground hover:text-green-400 transition-colors disabled:opacity-50"
                                  title="Confirmar pareja"
                                >
                                  <Check size={14} />
                                </button>
                              )}
                              {pair.status !== "WAITLIST" && (
                                <button
                                  onClick={() => handlePairStatus(pair, "WAITLIST")}
                                  disabled={isUpdating}
                                  className="p-1.5 rounded-md hover:bg-blue-400/10 text-muted-foreground hover:text-blue-400 transition-colors disabled:opacity-50"
                                  title="Mover a espera"
                                >
                                  <Clock size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handlePairStatus(pair, "CANCELLED")}
                                disabled={isUpdating}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                                title="Cancelar pareja"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{filteredPairs.length} parejas · página {regPage + 1} de {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setRegPage((p) => p - 1)}
                    disabled={regPage === 0}
                    className="p-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    onClick={() => setRegPage((p) => p + 1)}
                    disabled={regPage >= totalPages - 1}
                    className="p-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CALENDARIO TAB ── */}
        {tab === "calendario" && (
          <CalendarTab
            matches={matches}
            loading={loadingMatches}
            isError={isErrorMatches}
            refetch={refetchMatches}
            autoSchedule={autoSchedule}
            onMatchClick={setResultMatch}
            tournament={tournament}
            tournamentId={id}
          />
        )}

        {/* ── CUADRO TAB ── */}
        {tab === "cuadro" && (
          <div className="space-y-4">
            {(tournament.status === "OPEN" || tournament.status === "DRAW") && (() => {
              const st = tournament.status;
              // En DRAW las inscripciones siempre están cerradas
              const deadlinePassed = st === "DRAW"
                ? true
                : tournament.registrationDeadline
                  ? new Date() > new Date(tournament.registrationDeadline)
                  : false;
              const deadlineLabel = tournament.registrationDeadline
                ? new Date(tournament.registrationDeadline).toLocaleString("es-ES", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })
                : null;

              const alreadyGenerated = bracketCatId
                ? bracketMatches.some((m: any) => m.categoryId === bracketCatId)
                : false;

              const blockedReason = !deadlinePassed
                ? `Las inscripciones siguen abiertas${deadlineLabel ? ` hasta el ${deadlineLabel}` : ""}. Cambia el estado a "Sorteo" para generar el cuadro.`
                : alreadyGenerated
                ? "El cuadro ya ha sido generado para esta categoría."
                : null;

              return (
                <div className="bg-card border border-border rounded-lg p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Generar cuadro automático</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {blockedReason
                          ? <span className="text-yellow-400">{blockedReason}</span>
                          : "Inscripciones cerradas. Selecciona una categoría y genera el cuadro."
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-56">
                        <CustomSelect
                          options={catOptions}
                          value={bracketCatId}
                          onChange={setBracketCatId}
                        />
                      </div>
                      <button
                        onClick={handlePreviewBracket}
                        disabled={!bracketCatId || loadingPreview || generateBracket.isPending || !!blockedReason}
                        title={blockedReason ?? undefined}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {loadingPreview ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                        Vista previa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-4">
              {tournament.categories.map((cat) => {
                const allCatMatches = bracketMatches.filter((m: any) => m.categoryId === cat.id);
                const catMatches    = allCatMatches.filter((m: any) => m.phase === "GROUPS");
                const elimMatches   = allCatMatches.filter((m: any) => m.phase !== "GROUPS");
                const groupNames    = [...new Set(catMatches.map((m: any) => m.group ?? "Grupo"))];
                const hasGroups     = catMatches.length > 0;
                const hasElim       = elimMatches.length > 0;

                // Agrupar eliminatoria por fase
                const PHASE_LABEL: Record<string, string> = { R16: "Octavos", QF: "Cuartos", SF: "Semifinales", FINAL: "Final" };
                const elimPhases = [...new Set(elimMatches.map((m: any) => m.phase))]
                  .sort((a, b) => {
                    const order: Record<string, number> = { R16: 0, QF: 1, SF: 2, FINAL: 3 };
                    return (order[a] ?? 0) - (order[b] ?? 0);
                  });
                return (
                  <div key={cat.id} className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                      <h4 className="text-sm font-semibold text-foreground">
                        {GENDER_LABEL[cat.gender].short} {CATEGORY_LABEL_SHORT[cat.level]}
                      </h4>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#D4AF37]">{cat.currentPhaseLabel ?? phaseLabel(cat.currentPhase)}</span>
                        {hasGroups && (
                          <div className="flex items-center gap-2">
                            {/* En eliminatoria: botón para ver/ocultar clasificación de grupos */}
                            {cat.currentPhase !== "GROUPS" && (
                              <button
                                onClick={() => setShowStandingsCatId((p) => p === cat.id ? null : cat.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
                                  showStandingsCatId === cat.id
                                    ? "border-[rgba(212,175,55,0.4)] text-[#D4AF37] bg-[rgba(212,175,55,0.08)]"
                                    : "border-border text-muted-foreground hover:text-foreground hover:border-[rgba(212,175,55,0.3)]"
                                }`}
                              >
                                <Trophy size={11} />
                                {showStandingsCatId === cat.id ? "Ocultar grupos" : "Ver grupos"}
                              </button>
                            )}
                            {cat.currentPhase !== "GROUPS" && (
                              <button
                                onClick={() => setRegenElimCatId(cat.id)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-blue-400/50 transition-colors"
                              >
                                <RefreshCw size={11} />
                                Regen. eliminatorias
                              </button>
                            )}
                            <button
                              onClick={() => setRegenCatId(cat.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-yellow-400/50 transition-colors"
                            >
                              <RefreshCw size={11} />
                              Regenerar todo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Grupos: siempre visible. Eliminatoria: solo si botón activo */}
                    {(cat.currentPhase === "GROUPS" || showStandingsCatId === cat.id) && (
                      <div className="border-b border-border p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {!(allStandings as any)[cat.id] && (
                            <p className="text-xs text-muted-foreground col-span-3 py-2">Cargando clasificación...</p>
                          )}
                          {((allStandings as any)[cat.id] ?? []).map((grp: any) => (
                            <div key={grp.id} className="bg-secondary/30 rounded-md overflow-hidden border border-border">
                              <div className="px-3 py-2 bg-secondary/60 border-b border-border">
                                <p className="text-xs font-semibold text-[#D4AF37]">{grp.label}</p>
                              </div>
                              <table className="w-full text-[11px]">
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
                                  {grp.rows.map((row: any) => {
                                    const qualifies = row.pos <= (grp.qualifyCount ?? 1);
                                    return (
                                      <tr key={row.pos} className={`border-b border-border last:border-0 ${qualifies ? "bg-[rgba(212,175,55,0.05)]" : ""}`}>
                                        <td className="px-2 py-1.5">
                                          <span className={`font-bold ${qualifies ? "text-[#D4AF37]" : "text-muted-foreground"}`}>{row.pos}</span>
                                        </td>
                                        <td className="px-2 py-1.5 text-foreground truncate max-w-[140px]">{row.name}</td>
                                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.played}</td>
                                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.wins}</td>
                                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.setsWon}</td>
                                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.setsLost}</td>
                                        <td className={`px-2 py-1.5 text-center font-semibold ${row.setDiff > 0 ? "text-green-400" : row.setDiff < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                                          {row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.gamesWon}</td>
                                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.gamesLost}</td>
                                        <td className={`px-2 py-1.5 text-center font-semibold ${row.gameDiff > 0 ? "text-green-400" : row.gameDiff < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                                          {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                                        </td>
                                        <td className="px-2 py-1.5 text-center font-bold text-foreground">{row.points}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Partidos de eliminatoria */}
                    {hasElim && (
                      <div className="border-b border-border p-4 space-y-4">
                        {elimPhases.map((phase) => {
                          const phaseMatches = elimMatches.filter((m: any) => m.phase === phase);
                          return (
                            <div key={phase}>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                {PHASE_LABEL[phase] ?? phase}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {phaseMatches.map((m: any) => {
                                  const matchTime = m.date ? new Date(m.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : null;
                                  return (
                                    <div key={m.id} className={`bg-secondary/40 border rounded-md px-3 py-2 space-y-0.5 ${m.isResult ? "border-[rgba(212,175,55,0.3)]" : "border-border"}`}>
                                      <div className="grid text-xs items-center gap-1" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                                        <span className={`truncate ${m.winner === "team1" ? "text-[#D4AF37] font-semibold" : "text-muted-foreground"}`}>
                                          {m.team1?.join(" / ") || "Por definir"}
                                        </span>
                                        <span className="text-[10px] font-mono text-foreground text-center whitespace-nowrap px-1">
                                          {m.isResult && m.sets1 && m.sets2
                                            ? m.sets1.map((s: number, i: number) => `${s}-${m.sets2![i]}`).join(" / ")
                                            : "vs"}
                                        </span>
                                        <span className={`truncate text-right ${m.winner === "team2" ? "text-[#D4AF37] font-semibold" : "text-muted-foreground"}`}>
                                          {m.team2?.join(" / ") || "Por definir"}
                                        </span>
                                      </div>
                                      {(matchTime || m.court) && (
                                        <div className="flex items-center gap-2">
                                          {matchTime && <span className="text-[10px] text-[#D4AF37]/70">🕐 {matchTime}</span>}
                                          {m.court && <span className="text-[10px] text-muted-foreground/60">{m.court}</span>}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!hasGroups ? (
                      <p className="text-xs text-muted-foreground text-center py-6">Sin partidos generados</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                        {groupNames.map((grp) => {
                          const grpMatches = catMatches.filter((m: any) => (m.group ?? "Grupo") === grp);
                          return (
                            <div key={grp} className="bg-secondary/40 border border-border rounded-md p-3 space-y-2">
                              <p className="text-xs font-semibold text-[#D4AF37]">{grp}</p>
                              {grpMatches.map((m: any) => {
                                const matchTime = m.date ? new Date(m.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : null;
                                return (
                                  <div key={m.id} className="space-y-0.5">
                                    <div className="grid text-xs text-muted-foreground items-center gap-1" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                                      <span className="truncate">{m.team1?.join(" / ") ?? "—"}</span>
                                      <span className="text-[10px] font-mono text-foreground text-center whitespace-nowrap px-1">
                                        {m.isResult && m.sets1 && m.sets2
                                          ? m.sets1.map((s: number, i: number) => `${s}-${m.sets2![i]}`).join(" / ")
                                          : "vs"}
                                      </span>
                                      <span className="truncate text-right">{m.team2?.join(" / ") ?? "—"}</span>
                                    </div>
                                    {(matchTime || m.court) && (
                                      <div className="flex items-center gap-2 pl-0.5">
                                        {matchTime && (
                                          <span className="text-[10px] text-[#D4AF37]/70">🕐 {matchTime}</span>
                                        )}
                                        {m.court && (
                                          <span className="text-[10px] text-muted-foreground/60">{m.court}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>

    {bracketPreview && (
      <BracketEditor
        groups={bracketPreview.groups}
        totalMatches={bracketPreview.totalMatches}
        isGroups={bracketPreview.isGroups}
        saving={generateBracket.isPending}
        onConfirm={(customGroups) => generateBracket.mutate(customGroups)}
        onCancel={() => setBracketPreview(null)}
      />
    )}

        {/* ── PISTAS TAB ── */}
        {tab === "pistas" && (
          <PistasTab tournamentId={id} />
        )}

    <ConfirmModal
      open={showDeleteModal}
      title="Eliminar torneo"
      description={`¿Seguro que quieres eliminar "${tournament?.name}"? Esta acción no se puede deshacer.`}
      confirmLabel="Eliminar"
      danger
      loading={deleteTournament.isPending}
      onClose={() => setShowDeleteModal(false)}
      onConfirm={() => deleteTournament.mutate()}
    />

    {availRegId && (
      <AvailabilityModal registrationId={availRegId} onClose={() => setAvailRegId(null)} />
    )}

    {resultMatch && (
      <ResultModal
        match={resultMatch}
        onClose={() => setResultMatch(null)}
        onSave={saveResult}
        saving={savingResultId === resultMatch.id}
      />
    )}

    <ConfirmModal
      open={!!regenCatId}
      title="Regenerar cuadro completo"
      description="Esto borrará todos los partidos no jugados de esta categoría y regenerará los grupos desde cero. Si hay partidos jugados se mostrará un error."
      confirmLabel="Regenerar cuadro"
      loading={regenerateBracket.isPending}
      onClose={() => setRegenCatId(null)}
      onConfirm={() => regenCatId && regenerateBracket.mutate(regenCatId)}
    />

    <ConfirmModal
      open={!!regenElimCatId}
      title="Regenerar eliminatorias"
      description="Borrará los partidos de eliminatoria no jugados y recalculará los emparejamientos según la clasificación de grupos actual. Los partidos de grupos y sus resultados no se tocan."
      confirmLabel="Regenerar eliminatorias"
      loading={regenerateElimination.isPending}
      onClose={() => setRegenElimCatId(null)}
      onConfirm={() => regenElimCatId && regenerateElimination.mutate(regenElimCatId)}
    />


    </>
  );
}
