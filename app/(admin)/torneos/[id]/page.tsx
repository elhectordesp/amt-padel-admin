"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy, Calendar, ChevronLeft, MapPin,
  Check, X, Clock, Download, Search, Loader2,
  GitBranch, CheckCircle, Copy, Trash2, ChevronRight,
  Square, CheckSquare, Lock, RefreshCw, CalendarDays, Printer, Tv2,
  LayoutGrid, Star, Ban, CalendarOff, AlarmClock,
  Pencil, Send, EyeOff, RotateCcw, List, Save, ShieldAlert, ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { AvailabilityModal } from "@/components/admin/availability-modal";
import { ResultModal } from "@/components/admin/result-modal";
import { BracketEditor, type PreviewGroup } from "@/components/admin/bracket-editor";
import { ScheduleGrid } from "@/components/admin/schedule-grid";
import { ErrorState } from "@/components/admin/error-state";
import { CustomSelect } from "@/components/admin/form";
import { adminService, type ScheduleConflict, type ConflictType } from "@/lib/services/admin";
import { downloadCsv } from "@/lib/utils/csv";
import { printRegistrations, printSchedule } from "@/lib/utils/print";
import {
  CATEGORY_LABEL_SHORT, GENDER_LABEL,
  TOURNAMENT_STATUS_LABEL, TOURNAMENT_STATUS_COLOR,
  resolveTier, phaseLabel,
} from "@/lib/constants";
import type { AdminRegistration, RegistrationStatus, MatchResult, TournamentStatus, TournamentCourt, Gender, CategoryLevel, AuditLogEntry } from "@/types";

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

const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  TORNEO_CREADO:                  { label: "Torneo creado",           color: "text-green-400 bg-green-400/10 border-green-400/30"   },
  TORNEO_EDITADO:                 { label: "Torneo editado",          color: "text-blue-400 bg-blue-400/10 border-blue-400/30"     },
  TORNEO_ELIMINADO:               { label: "Torneo eliminado",        color: "text-red-400 bg-red-400/10 border-red-400/30"        },
  TORNEO_RESTAURADO:              { label: "Torneo restaurado",       color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  TORNEO_DUPLICADO:               { label: "Torneo duplicado",        color: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  TORNEO_PUBLICADO:               { label: "Torneo publicado",        color: "text-green-400 bg-green-400/10 border-green-400/30"   },
  BRACKET_GENERADO:               { label: "Cuadro generado",         color: "text-blue-400 bg-blue-400/10 border-blue-400/30"     },
  BRACKET_REGENERADO:             { label: "Cuadro regenerado",       color: "text-blue-400 bg-blue-400/10 border-blue-400/30"     },
  ELIMINATORIA_REGENERADA:        { label: "Eliminatoria regenerada", color: "text-blue-400 bg-blue-400/10 border-blue-400/30"     },
  PARTIDOS_PROGRAMADOS:           { label: "Partidos programados",    color: "text-teal-400 bg-teal-400/10 border-teal-400/30"     },
  HORARIO_PUBLICADO:              { label: "Horario publicado",       color: "text-green-400 bg-green-400/10 border-green-400/30"   },
  HORARIO_DESPUBLICADO:           { label: "Horario despublicado",    color: "text-orange-400 bg-orange-400/10 border-orange-400/30"},
  PARTIDO_REPROGRAMADO:           { label: "Partido reprogramado",    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  RESULTADO_REGISTRADO:           { label: "Resultado registrado",    color: "text-teal-400 bg-teal-400/10 border-teal-400/30"     },
  ROUND_FORMATS_UPDATED:          { label: "Formatos por ronda",      color: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  INSCRIPCION_ACTUALIZADA:        { label: "Inscripción actualizada", color: "text-blue-400 bg-blue-400/10 border-blue-400/30"     },
  INSCRIPCIONES_ACTUALIZADAS_BULK:{ label: "Inscripciones bulk",      color: "text-blue-400 bg-blue-400/10 border-blue-400/30"     },
  BRACKET_MANUAL_INIT:            { label: "Grupos manuales creados", color: "text-teal-400 bg-teal-400/10 border-teal-400/30"     },
  GROUP_MEMBERS_UPDATED:          { label: "Grupo actualizado",       color: "text-teal-400 bg-teal-400/10 border-teal-400/30"     },
  PREMIOS_CATEGORIA_ACTUALIZADOS: { label: "Premios actualizados",    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
};

function AuditActionBadge({ action, resource }: { action: string; resource: string }) {
  const cfg = AUDIT_ACTION_LABELS[action];
  if (cfg) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border text-muted-foreground bg-muted/30 border-border">
      {action} <span className="ml-1 opacity-50">({resource})</span>
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
  matches, loading, isError, refetch, autoSchedule, onMatchClick, onCorrectClick, tournament, tournamentId,
  scheduleWarnings, onClearWarnings,
}: {
  matches:          MatchResult[];
  loading:          boolean;
  isError:          boolean;
  refetch:          () => void;
  autoSchedule:     { mutate: (force?: boolean) => void; isPending: boolean };
  onMatchClick:     (m: MatchResult) => void;
  onCorrectClick:   (m: MatchResult) => void;
  tournament:       any;
  tournamentId:     string;
  scheduleWarnings: { pair: string; phase: string; category: string }[];
  onClearWarnings:  () => void;
}) {
  const qc = useQueryClient();

  // View mode
  const [viewMode, setViewMode] = useState<"lista" | "grid">("lista");

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

  const catMap = Object.fromEntries(
    (tournament?.categories ?? []).map((c: any) => [
      c.id,
      `${GENDER_LABEL[c.gender as Gender]?.short ?? c.gender} ${CATEGORY_LABEL_SHORT[c.level as CategoryLevel] ?? c.level}`,
    ]),
  );

  const exportCsv = () => {
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

  const printDoc = () => {
    if (tournament) printSchedule(tournament, matches, catMap);
  };

  return (
    <div className="space-y-4">
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Calendar size={14} className="text-[#D4AF37]" />
            Partidos ({matches.length})
          </h3>
          {/* Lista / Grid toggle */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("lista")}
              title="Vista lista"
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                viewMode === "lista"
                  ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List size={12} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="Vista grid (por pistas)"
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs border-l border-border transition-colors ${
                viewMode === "grid"
                  ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={12} />
            </button>
          </div>
        </div>
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
            onClick={printDoc}
            disabled={matches.filter((m) => !!(m as any).date).length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-yellow-400/50 transition-colors disabled:opacity-50"
            title="Imprimir horario o guardar como PDF"
          >
            <Printer size={11} />
            Imprimir
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

      {/* Unscheduled-players warning banner */}
      {scheduleWarnings.length > 0 && (
        <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlarmClock size={14} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-yellow-400">
                {scheduleWarnings.length} partido(s) sin hueco disponible
              </p>
            </div>
            <button
              onClick={onClearWarnings}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Cerrar aviso"
            >
              <X size={13} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Los siguientes jugadores no pudieron ser programados. Ajusta las jornadas, pistas o el límite diario e intenta de nuevo.
          </p>
          <ul className="pl-5 space-y-1">
            {scheduleWarnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-300/80 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-yellow-400/10 text-[10px] font-semibold shrink-0">{w.phase} · {w.category}</span>
                {w.pair}
              </li>
            ))}
          </ul>
        </div>
      )}

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
      ) : viewMode === "grid" ? (
        <ScheduleGrid
          matches={matches}
          duration={tournament?.matchDuration ?? 60}
          tournament={tournament}
          onMatchClick={onMatchClick}
          onCorrectClick={onCorrectClick}
        />
      ) : (
        // Per-category sections (lista)
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
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle size={13} className="text-green-400" />
                                    <span className="text-xs font-mono text-foreground">
                                      {(m as any).sets1.map((s: number, i: number) => `${s}-${(m as any).sets2[i]}`).join(" / ")}
                                    </span>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onCorrectClick(m); }}
                                    className="p-1 rounded-md border border-border text-muted-foreground hover:text-amber-400 hover:border-amber-400/40 transition-colors"
                                    title="Corregir resultado"
                                  >
                                    <RotateCcw size={10} />
                                  </button>
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
                                      {courts.map((c) => (
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

// ── StatusTab ─────────────────────────────────────────────────────────────
function StatusTab({ status, loading, onRefresh }: { status: any; loading: boolean; onRefresh: () => void }) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 size={18} className="animate-spin" /> Cargando estado…
      </div>
    );
  }
  if (!status) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <p className="text-sm">No se pudo cargar el estado del torneo.</p>
        <button onClick={onRefresh} className="text-xs underline">Reintentar</button>
      </div>
    );
  }

  const { summary, categories } = status;
  const pct = summary.totalMatches > 0 ? Math.round((summary.finishedMatches / summary.totalMatches) * 100) : 0;
  const hasIssues = summary.unscheduled > 0 || summary.totalConflicts > 0;

  return (
    <div className="space-y-6 p-4">
      {/* ── Summary bar ── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-foreground">Progreso global</h3>
          <button onClick={onRefresh} className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors" title="Actualizar">
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{summary.finishedMatches} / {summary.totalMatches} partidos jugados</span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-[#D4AF37] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Categorías finalizadas", value: `${summary.completedCategories}/${summary.totalCategories}`, color: summary.completedCategories === summary.totalCategories ? "text-green-400" : "text-foreground" },
            { label: "Sin programar",          value: summary.unscheduled,   color: summary.unscheduled   > 0 ? "text-amber-400" : "text-green-400" },
            { label: "Conflictos",             value: summary.totalConflicts, color: summary.totalConflicts > 0 ? "text-red-400"   : "text-green-400" },
            { label: "Categorías en curso",    value: summary.totalCategories - summary.completedCategories, color: "text-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-secondary/40 rounded-lg p-3 text-center">
              <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {!hasIssues && summary.completedCategories === summary.totalCategories && (
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <CheckCircle size={15} /> Todas las categorías finalizadas. ¡Torneo completo!
          </div>
        )}
        {!hasIssues && summary.completedCategories < summary.totalCategories && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <CheckCircle size={13} className="text-green-400" /> Sin conflictos ni partidos sin programar
          </div>
        )}
      </div>

      {/* ── Category cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat: any) => {
          const catLabel = `${GENDER_LABEL[cat.gender as Gender]?.short ?? cat.gender} ${CATEGORY_LABEL_SHORT[cat.level as CategoryLevel] ?? cat.level}`;
          const catPct   = cat.totalMatches > 0 ? Math.round((cat.finishedMatches / cat.totalMatches) * 100) : 0;
          const hasConflicts  = cat.conflicts.length > 0;
          const hasUnscheduled = cat.unscheduled > 0;
          const isExpanded = expandedCat === cat.categoryId;

          return (
            <div key={cat.categoryId} className={`bg-card border rounded-xl overflow-hidden transition-colors ${cat.isComplete ? "border-green-400/30" : hasConflicts ? "border-red-400/30" : hasUnscheduled ? "border-amber-400/30" : "border-border"}`}>
              {/* Card header */}
              <div className="px-4 pt-4 pb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{catLabel}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">{phaseLabel(cat.currentPhase)}</span>
                  </div>
                  {cat.isComplete && (
                    <span className="flex items-center gap-1 text-[10px] text-green-400 font-semibold"><CheckCircle size={11} /> Finalizada</span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{cat.finishedMatches}/{cat.totalMatches} jugados</span>
                    <span>{catPct}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${catPct}%`, backgroundColor: cat.isComplete ? "#4ade80" : "#D4AF37" }} />
                  </div>
                </div>

                {/* Status chips */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    <Clock size={9} /> {cat.pendingWithTime} con hora
                  </span>
                  {hasUnscheduled && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400">
                      <CalendarOff size={9} /> {cat.unscheduled} sin programar
                    </span>
                  )}
                  {hasConflicts && (
                    <button onClick={() => setExpandedCat(isExpanded ? null : cat.categoryId)} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-400/10 border border-red-400/30 text-red-400 hover:bg-red-400/20 transition-colors">
                      <Ban size={9} /> {cat.conflicts.length} conflicto{cat.conflicts.length !== 1 ? "s" : ""} {isExpanded ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {/* Winner badge */}
                {cat.winner && (
                  <div className="flex items-center gap-2 bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.25)] rounded-lg px-3 py-2">
                    <Trophy size={13} className="text-[#D4AF37] shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Campeona</p>
                      <p className="text-xs font-semibold text-[#D4AF37]">{cat.winner.join(" / ")}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Conflicts detail */}
              {isExpanded && hasConflicts && (
                <div className="border-t border-red-400/20 bg-red-400/5 px-4 py-3 space-y-2">
                  <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Conflictos de horario</p>
                  {cat.conflicts.map((c: any, idx: number) => (
                    <div key={idx} className="text-[10px] text-muted-foreground space-y-0.5">
                      <p className="text-xs font-medium text-red-300">{c.playerName}</p>
                      <p>{phaseLabel(c.phase1)} · {new Date(c.time1).toLocaleString("es-ES", { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {c.court1}</p>
                      <p>{phaseLabel(c.phase2)} · {new Date(c.time2).toLocaleString("es-ES", { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {c.court2}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PistasTab ──────────────────────────────────────────────────────────────

function TournamentCourtCard({ tc }: { tc: TournamentCourt }) {
  return (
    <div className="bg-card border rounded-lg p-4 space-y-1">
      <div className="flex items-center gap-2 min-w-0">
        {tc.court.isCentral && <Star size={13} className="text-[#D4AF37] fill-[#D4AF37] shrink-0" />}
        <p className="text-sm font-semibold truncate">{tc.court.name}</p>
      </div>
      {tc.court.isIndoor && <p className="text-[10px] text-muted-foreground">Cubierta</p>}
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
        {courts.length} pista{courts.length !== 1 ? "s" : ""} · Los bloqueos se gestionan desde el panel del club
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courts.map((tc) => (
          <TournamentCourtCard key={tc.id} tc={tc} />
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

type Tab = "resumen" | "inscripciones" | "calendario" | "cuadro" | "pistas" | "estado" | "historial";

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
  const [bracketFormat,      setBracketFormat]      = useState("");
  const [showDeleteModal,    setShowDeleteModal]    = useState(false);
  const [bracketPreview,     setBracketPreview]     = useState<{ groups: PreviewGroup[]; totalMatches: number; isGroups: boolean } | null>(null);
  const [loadingPreview,     setLoadingPreview]     = useState(false);
  const [regenCatId,         setRegenCatId]         = useState<string | null>(null);
  const [regenElimCatId,     setRegenElimCatId]     = useState<string | null>(null);
  const [availRegId,         setAvailRegId]         = useState<string | null>(null);
  const [resultMatch,        setResultMatch]        = useState<any | null>(null);
  const [resultCorrection,   setResultCorrection]   = useState(false);
  const [savingResultId,     setSavingResultId]     = useState<string | null>(null);
  const [showStandingsCatId,  setShowStandingsCatId]  = useState<string | null>(null);
  const [showRoundFmtCatId,   setShowRoundFmtCatId]   = useState<string | null>(null);
  const [editRoundFormats,    setEditRoundFormats]     = useState<Record<string, string>>({});
  const [manualMode,          setManualMode]           = useState(false);
  const [manualNumGroups,     setManualNumGroups]      = useState(4);
  const [manualGroupEdits,    setManualGroupEdits]     = useState<Record<string, { userId: string; partnerId: string | null }[]>>({});
  const [editPrizesCatId,     setEditPrizesCatId]     = useState<string | null>(null);
  const [prizesForm,          setPrizesForm]           = useState<{ prizeChampion: string; prizeRunnerUp: string; prizeConsolation: string; hasConsolation: boolean }>({ prizeChampion: "", prizeRunnerUp: "", prizeConsolation: "", hasConsolation: false });
  const [validatingCatId,    setValidatingCatId]    = useState<string | null>(null);
  const [conflictsByCat,     setConflictsByCat]     = useState<Record<string, ScheduleConflict[]>>({});
  const [showConflictsCatId, setShowConflictsCatId] = useState<string | null>(null);

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
    enabled:   tab === "inscripciones" || (tab === "cuadro" && manualMode),
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

  const {
    data: tournamentStatus, isLoading: loadingStatus, refetch: refetchStatus,
  } = useQuery({
    queryKey: ["tournament-status", id],
    queryFn:  () => adminService.tournaments.status(id),
    enabled:  tab === "estado",
    staleTime: 30_000,
  });

  const { data: auditLog = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["tournament-audit", id],
    queryFn:  () => adminService.tournaments.auditLog(id, 150),
    enabled:  tab === "historial",
    staleTime: 60_000,
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
    mutationFn: (customGroups?: string[][]) =>
      adminService.tournaments.generateBracket(id, bracketCatId, customGroups, bracketFormat || undefined),
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
      setBracketFormat("");
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
      setResultCorrection(false);
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
      const preview = await adminService.tournaments.previewBracket(id, bracketCatId, bracketFormat || undefined) as any;
      setBracketPreview({ groups: preview.groups, totalMatches: preview.totalMatches, isGroups: preview.isGroups });
    } catch (err: any) {
      toast.error(err.message ?? "Error al generar la previsualización");
    } finally {
      setLoadingPreview(false);
    }
  };

  const [scheduleWarnings, setScheduleWarnings] = useState<{ pair: string; phase: string; category: string }[]>([]);

  const autoSchedule = useMutation({
    mutationFn: (force?: boolean) => adminService.tournaments.autoSchedule(id, force),
    onSuccess:  (res) => {
      const unscheduled = res.unscheduledPlayers ?? [];
      setScheduleWarnings(unscheduled);
      if (unscheduled.length > 0) {
        toast.warning(`${res.count} partidos programados. ${unscheduled.length} partido(s) sin hueco — ver aviso en el calendario.`);
      } else {
        toast.success(`Se han asignado horarios a ${res.count} partidos`);
      }
      qc.invalidateQueries({ queryKey: ["matches", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePairStatus = (pair: PairReg, status: string) => {
    setUpdatingIds(new Set(pair.ids));
    bulkStatus.mutate({ ids: pair.ids, status });
  };

  const saveRoundFormats = useMutation({
    mutationFn: ({ catId, formats }: { catId: string; formats: Record<string, string> | null }) =>
      adminService.categories.updateRoundFormats(id, catId, formats),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournament", id] });
      toast.success("Formatos de puntuación guardados");
      setShowRoundFmtCatId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const initManualBracket = useMutation({
    mutationFn: ({ catId, numGroups }: { catId: string; numGroups?: number }) =>
      adminService.tournaments.initBracketManual(id, catId, numGroups),
    onSuccess: () => {
      toast.success("Grupos creados. Asigna las parejas a cada grupo.");
      qc.invalidateQueries({ queryKey: ["standings", id] });
      setManualGroupEdits({});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveGroupMembers = useMutation({
    mutationFn: ({ catId, groupId, members }: { catId: string; groupId: string; members: { userId: string; partnerId?: string | null }[] }) =>
      adminService.tournaments.updateGroupMembers(id, catId, groupId, members),
    onSuccess: () => {
      toast.success("Grupo guardado correctamente");
      qc.invalidateQueries({ queryKey: ["standings", id] });
      qc.invalidateQueries({ queryKey: ["bracket", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePrizesMut = useMutation({
    mutationFn: ({ catId, prizes }: { catId: string; prizes: typeof prizesForm }) =>
      adminService.categories.updatePrizes(id, catId, prizes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournament", id] });
      toast.success("Premios actualizados");
      setEditPrizesCatId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
              { key: "estado",        label: "Estado"         },
              { key: "inscripciones", label: `Inscripciones (${pairs.length || registrations.length || "…"})` },
              { key: "calendario",    label: "Calendario"     },
              { key: "cuadro",        label: "Cuadro"         },
              { key: "pistas",        label: "Pistas"         },
              { key: "historial",     label: "Historial"      },
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

            {/* ── Premios por categoría ── */}
            <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Trophy size={14} className="text-[#D4AF37]" />
                  Premios por categoría
                </h3>
              </div>
              <div className="divide-y divide-border">
                {tournament.categories.map((cat: any) => {
                  const catLabel = `${GENDER_LABEL[cat.gender as Gender]?.short ?? cat.gender} ${CATEGORY_LABEL_SHORT[cat.level as CategoryLevel] ?? cat.level}`;
                  const isEditing = editPrizesCatId === cat.id;
                  const hasPrizes = cat.prizeChampion || cat.prizeRunnerUp || (cat.hasConsolation && cat.prizeConsolation);

                  return (
                    <div key={cat.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-foreground">{catLabel}</span>
                        {!isEditing ? (
                          <button
                            onClick={() => {
                              setEditPrizesCatId(cat.id);
                              setPrizesForm({
                                prizeChampion:    cat.prizeChampion    ?? "",
                                prizeRunnerUp:    cat.prizeRunnerUp    ?? "",
                                prizeConsolation: cat.prizeConsolation ?? "",
                                hasConsolation:   cat.hasConsolation   ?? false,
                              });
                            }}
                            className="text-xs text-[#D4AF37] hover:underline"
                          >
                            Editar
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updatePrizesMut.mutate({ catId: cat.id, prizes: prizesForm })}
                              disabled={updatePrizesMut.isPending}
                              className="text-xs bg-[#D4AF37] text-black font-semibold px-3 py-1 rounded hover:bg-[#c9a227] disabled:opacity-50"
                            >
                              {updatePrizesMut.isPending ? "Guardando…" : "Guardar"}
                            </button>
                            <button
                              onClick={() => setEditPrizesCatId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">🥇 Campeón</label>
                            <input
                              value={prizesForm.prizeChampion}
                              onChange={(e) => setPrizesForm((f) => ({ ...f, prizeChampion: e.target.value }))}
                              placeholder="ej: 200€, Copa + camiseta…"
                              className="mt-1 w-full h-8 px-3 rounded-md bg-secondary border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">🥈 Subcampeón</label>
                            <input
                              value={prizesForm.prizeRunnerUp}
                              onChange={(e) => setPrizesForm((f) => ({ ...f, prizeRunnerUp: e.target.value }))}
                              placeholder="ej: 100€, Medalla…"
                              className="mt-1 w-full h-8 px-3 rounded-md bg-secondary border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
                            />
                          </div>
                          <div className="sm:col-span-2 flex items-center gap-3">
                            <input
                              type="checkbox"
                              id={`hc-${cat.id}`}
                              checked={prizesForm.hasConsolation}
                              onChange={(e) => setPrizesForm((f) => ({ ...f, hasConsolation: e.target.checked }))}
                              className="accent-[#D4AF37]"
                            />
                            <label htmlFor={`hc-${cat.id}`} className="text-xs text-muted-foreground">Hay partido de consolación</label>
                            {prizesForm.hasConsolation && (
                              <input
                                value={prizesForm.prizeConsolation}
                                onChange={(e) => setPrizesForm((f) => ({ ...f, prizeConsolation: e.target.value }))}
                                placeholder="🏅 Premio consolación"
                                className="flex-1 h-8 px-3 rounded-md bg-secondary border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
                              />
                            )}
                          </div>
                        </div>
                      ) : hasPrizes ? (
                        <div className="flex flex-wrap gap-4 text-sm">
                          {cat.prizeChampion   && <span className="text-foreground">🥇 <span className="text-[#D4AF37] font-medium">{cat.prizeChampion}</span></span>}
                          {cat.prizeRunnerUp   && <span className="text-foreground">🥈 <span className="text-[#D4AF37] font-medium">{cat.prizeRunnerUp}</span></span>}
                          {cat.hasConsolation && cat.prizeConsolation && <span className="text-foreground">🏅 <span className="text-[#D4AF37] font-medium">{cat.prizeConsolation}</span></span>}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Sin premios configurados. Pulsa &quot;Editar&quot; para añadirlos.</p>
                      )}
                    </div>
                  );
                })}
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
            onCorrectClick={(m) => { setResultMatch(m); setResultCorrection(true); }}
            tournament={tournament}
            tournamentId={id}
            scheduleWarnings={scheduleWarnings}
            onClearWarnings={() => setScheduleWarnings([])}
          />
        )}

        {/* ── CUADRO TAB ── */}
        {tab === "cuadro" && (
          <div className="space-y-4">
            {(tournament.status === "OPEN" || tournament.status === "DRAW" || tournament.status === "SCHEDULED" || tournament.status === "ONGOING") && (() => {
              const st = tournament.status;
              // En DRAW/SCHEDULED/ONGOING las inscripciones siempre están cerradas
              const deadlinePassed = (st === "DRAW" || st === "SCHEDULED" || st === "ONGOING")
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

              const selectedCat = bracketCatId
                ? tournament.categories.find((c) => c.id === bracketCatId)
                : null;

              const confirmedPairs = selectedCat?.registeredCount ?? null;

              // Default format selector value: param > category.format > tournament.format
              const defaultFormat = bracketFormat || selectedCat?.format || tournament.format || "";

              const FORMAT_OPTIONS = [
                { value: "grupos+eliminatoria",     label: "Grupos + Eliminatoria" },
                { value: "eliminatoria",            label: "Eliminatoria directa" },
                { value: "eliminatoria+consolacion",label: "Eliminatoria + Consolación" },
              ];

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
                          : confirmedPairs !== null
                          ? <span><span className="text-[#D4AF37] font-semibold">{confirmedPairs} parejas confirmadas</span> — elige formato y genera el cuadro.</span>
                          : "Inscripciones cerradas. Selecciona una categoría y genera el cuadro."
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="w-56">
                        <CustomSelect
                          options={catOptions}
                          value={bracketCatId}
                          onChange={(v) => { setBracketCatId(v); setBracketFormat(""); }}
                        />
                      </div>
                      {bracketCatId && (
                        <select
                          value={bracketFormat || defaultFormat}
                          onChange={(e) => setBracketFormat(e.target.value)}
                          className="h-9 rounded-md border border-border bg-background text-foreground text-sm px-2 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                        >
                          {FORMAT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
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

            {/* ── CUADRO MANUAL ── */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Asignación de grupos manual</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Crea grupos y asigna las parejas sin usar el algoritmo automático.
                  </p>
                </div>
                <button
                  onClick={() => setManualMode((m) => !m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                    manualMode
                      ? "border-[rgba(212,175,55,0.4)] text-[#D4AF37] bg-[rgba(212,175,55,0.08)]"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List size={12} />
                  {manualMode ? "Cerrar modo manual" : "Modo manual"}
                </button>
              </div>

              {manualMode && (
                <div className="space-y-4">
                  <div className="w-56">
                    <CustomSelect
                      options={catOptions}
                      value={bracketCatId}
                      onChange={(v) => { setBracketCatId(v); setBracketFormat(""); setManualGroupEdits({}); }}
                    />
                  </div>

                  {bracketCatId && (() => {
                    const catGroups: any[] = (allStandings as any)[bracketCatId] ?? [];
                    const confirmedPairs = groupByPair(
                      registrations.filter((r: any) => r.categoryId === bracketCatId && r.status === "CONFIRMED")
                    );

                    if (catGroups.length === 0) {
                      return (
                        <div className="space-y-4">
                          <p className="text-xs text-muted-foreground">
                            No hay grupos creados todavía. Define cuántos grupos quieres y crea la estructura vacía.
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-muted-foreground">Nº de grupos</label>
                              <input
                                type="number"
                                min={1}
                                max={16}
                                value={manualNumGroups}
                                onChange={(e) => setManualNumGroups(Math.max(1, Math.min(16, Number(e.target.value))))}
                                className="h-8 w-20 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                              />
                            </div>
                            <button
                              onClick={() => initManualBracket.mutate({ catId: bracketCatId, numGroups: manualNumGroups })}
                              disabled={initManualBracket.isPending}
                              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-50 transition-colors"
                            >
                              {initManualBracket.isPending ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
                              Crear grupos
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (loadingRegs) {
                      return (
                        <div className="flex justify-center py-8">
                          <Loader2 size={18} className="animate-spin text-muted-foreground" />
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          {catGroups.length} grupos · {confirmedPairs.length} parejas confirmadas disponibles.{" "}
                          <span className="text-yellow-400">Guardar reemplaza todos los miembros del grupo y regenera sus partidos.</span>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {catGroups.map((grp: any) => {
                            const groupEdit = manualGroupEdits[grp.id] ?? [];
                            const assignedToOtherGroups = new Set(
                              Object.entries(manualGroupEdits)
                                .filter(([gId]) => gId !== grp.id)
                                .flatMap(([, members]) => members.map((m) => m.userId))
                            );
                            const availablePairs = confirmedPairs.filter((p) => !assignedToOtherGroups.has(p.primary.userId));

                            return (
                              <div key={grp.id} className="bg-secondary/30 border border-border rounded-md p-3 space-y-2">
                                <p className="text-xs font-semibold text-[#D4AF37]">{grp.label}</p>

                                {groupEdit.length === 0 && (
                                  <p className="text-[10px] text-muted-foreground/60 italic">Sin parejas asignadas aún</p>
                                )}

                                {groupEdit.map((member) => {
                                  const pair = confirmedPairs.find((p) => p.primary.userId === member.userId);
                                  return (
                                    <div key={member.userId} className="flex items-center gap-1.5">
                                      <span className="flex-1 text-xs text-foreground truncate">
                                        {pair ? (
                                          <>
                                            {pair.primary.user.name}
                                            {pair.primary.partner && (
                                              <span className="text-muted-foreground"> / {pair.primary.partner.name}</span>
                                            )}
                                          </>
                                        ) : member.userId}
                                      </span>
                                      <button
                                        onClick={() =>
                                          setManualGroupEdits((prev) => ({
                                            ...prev,
                                            [grp.id]: (prev[grp.id] ?? []).filter((m) => m.userId !== member.userId),
                                          }))
                                        }
                                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  );
                                })}

                                {availablePairs.length > 0 && (
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      const pair = confirmedPairs.find((p) => p.primary.userId === e.target.value);
                                      if (!pair) return;
                                      setManualGroupEdits((prev) => ({
                                        ...prev,
                                        [grp.id]: [
                                          ...(prev[grp.id] ?? []),
                                          { userId: pair.primary.userId, partnerId: pair.primary.partnerId ?? null },
                                        ],
                                      }));
                                    }}
                                    className="w-full h-8 rounded-md border border-dashed border-[rgba(212,175,55,0.3)] bg-background px-2 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                                  >
                                    <option value="">+ Añadir pareja…</option>
                                    {availablePairs.map((p) => (
                                      <option key={p.primary.userId} value={p.primary.userId}>
                                        {p.primary.user.name}
                                        {p.primary.partner ? ` / ${p.primary.partner.name}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                <button
                                  onClick={() =>
                                    saveGroupMembers.mutate({
                                      catId: bracketCatId,
                                      groupId: grp.id,
                                      members: groupEdit,
                                    })
                                  }
                                  disabled={saveGroupMembers.isPending || groupEdit.length < 2}
                                  title={groupEdit.length < 2 ? "Añade al menos 2 parejas" : undefined}
                                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] rounded-md bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.25)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.12)] disabled:opacity-50 transition-colors font-medium"
                                >
                                  {saveGroupMembers.isPending ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                  Guardar grupo
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

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
                const roundFmtOpen = showRoundFmtCatId === cat.id;
                const ROUND_PHASES = [
                  { key: "GROUPS",      label: "Grupos"      },
                  { key: "R16",         label: "Octavos"     },
                  { key: "QF",          label: "Cuartos"     },
                  { key: "SF",          label: "Semifinales" },
                  { key: "FINAL",       label: "Final"       },
                  { key: "CONSOLATION", label: "Consolación" },
                ] as const;
                const baseFormat = cat.scoringFormat ?? "BEST_OF_3";
                const FORMAT_LABEL: Record<string, string> = {
                  BEST_OF_3:        "3 sets",
                  BEST_OF_2_SUPERTB:"2 sets + STB",
                };
                return (
                  <div key={cat.id} className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                      <h4 className="text-sm font-semibold text-foreground">
                        {GENDER_LABEL[cat.gender].short} {CATEGORY_LABEL_SHORT[cat.level]}
                      </h4>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#D4AF37]">{cat.currentPhaseLabel ?? phaseLabel(cat.currentPhase)}</span>
                        {/* Validar conflictos de horario */}
                        <button
                          onClick={async () => {
                            if (showConflictsCatId === cat.id) {
                              setShowConflictsCatId(null);
                              return;
                            }
                            setValidatingCatId(cat.id);
                            setShowConflictsCatId(cat.id);
                            try {
                              const conflicts = await adminService.schedule.validate(id, cat.id);
                              setConflictsByCat((prev) => ({ ...prev, [cat.id]: conflicts }));
                            } catch {
                              toast.error("Error al validar el horario");
                              setShowConflictsCatId(null);
                            } finally {
                              setValidatingCatId(null);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
                            showConflictsCatId === cat.id
                              ? (conflictsByCat[cat.id]?.length ?? 0) > 0
                                ? "border-red-400/40 text-red-400 bg-red-400/10"
                                : "border-green-400/40 text-green-400 bg-green-400/10"
                              : "border-border text-muted-foreground hover:text-foreground hover:border-orange-400/40"
                          }`}
                          title="Validar conflictos de horario"
                        >
                          {validatingCatId === cat.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <ShieldAlert size={11} />
                          }
                          Validar
                        </button>

                        {/* Formatos de puntuación por fase */}
                        <button
                          onClick={() => {
                            if (roundFmtOpen) {
                              setShowRoundFmtCatId(null);
                            } else {
                              setShowRoundFmtCatId(cat.id);
                              setEditRoundFormats({ ...(cat.roundFormats ?? {}) });
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${
                            roundFmtOpen
                              ? "border-purple-400/40 text-purple-400 bg-purple-400/10"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                          title="Configurar formato de puntuación por fase"
                        >
                          <Star size={11} />
                          Formatos
                        </button>
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

                    {/* ── Panel de conflictos de horario ── */}
                    {showConflictsCatId === cat.id && conflictsByCat[cat.id] !== undefined && (
                      <div className={`border-b border-border px-5 py-3 ${conflictsByCat[cat.id].length === 0 ? "bg-green-400/5" : "bg-red-400/5"}`}>
                        {conflictsByCat[cat.id].length === 0 ? (
                          <div className="flex items-center gap-2 text-green-400 text-xs">
                            <ShieldCheck size={13} />
                            <span className="font-medium">Sin conflictos — el horario es válido</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
                              <ShieldAlert size={13} />
                              {conflictsByCat[cat.id].length} conflicto{conflictsByCat[cat.id].length !== 1 ? "s" : ""} detectado{conflictsByCat[cat.id].length !== 1 ? "s" : ""}
                            </div>
                            {conflictsByCat[cat.id].map((c, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                                  c.type === "PLAYER_DOUBLE_BOOKED"     ? "border-red-400/40 text-red-400 bg-red-400/10"
                                  : c.type === "COURT_OVERLAP"          ? "border-orange-400/40 text-orange-400 bg-orange-400/10"
                                  : c.type === "AVAILABILITY_VIOLATION" ? "border-blue-400/40 text-blue-400 bg-blue-400/10"
                                  : "border-yellow-400/40 text-yellow-400 bg-yellow-400/10"
                                }`}>
                                  {c.type === "PLAYER_DOUBLE_BOOKED"    ? "DOBLE RESERVA"
                                   : c.type === "COURT_OVERLAP"        ? "PISTA OCUPADA"
                                   : c.type === "AVAILABILITY_VIOLATION" ? "DISPONIBILIDAD"
                                   : "SIN ASIGNAR"}
                                </span>
                                <span>{c.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Formato por fase (collapsible) ── */}
                    {roundFmtOpen && (
                      <div className="border-b border-border bg-secondary/20 px-5 py-4 space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Formato base de la categoría: <span className="text-foreground font-medium">{FORMAT_LABEL[baseFormat] ?? baseFormat}</span>. Configura un formato diferente por fase si lo necesitas.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {ROUND_PHASES.map(({ key, label }) => (
                            <div key={key} className="flex flex-col gap-1">
                              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
                              <select
                                value={editRoundFormats[key] ?? ""}
                                onChange={(e) => setEditRoundFormats((prev) => {
                                  const next = { ...prev };
                                  if (e.target.value === "") delete next[key];
                                  else next[key] = e.target.value;
                                  return next;
                                })}
                                className="h-8 rounded-md border border-border bg-background text-foreground text-xs px-2 focus:outline-none focus:ring-1 focus:ring-purple-400"
                              >
                                <option value="">Auto ({FORMAT_LABEL[baseFormat] ?? baseFormat})</option>
                                <option value="BEST_OF_3">3 sets</option>
                                <option value="BEST_OF_2_SUPERTB">2 sets + STB</option>
                              </select>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-1">
                          <button
                            onClick={() => {
                              saveRoundFormats.mutate({ catId: cat.id, formats: Object.keys(editRoundFormats).length > 0 ? editRoundFormats : null });
                            }}
                            disabled={saveRoundFormats.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-500/10 border border-purple-400/30 text-xs text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
                          >
                            {saveRoundFormats.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                            Guardar formatos
                          </button>
                        </div>
                      </div>
                    )}

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
                                      <div className="flex items-center justify-between">
                                        {(matchTime || m.court) ? (
                                          <div className="flex items-center gap-2">
                                            {matchTime && <span className="text-[10px] text-[#D4AF37]/70">🕐 {matchTime}</span>}
                                            {m.court && <span className="text-[10px] text-muted-foreground/60">{m.court}</span>}
                                          </div>
                                        ) : <span />}
                                        {m.isResult && (
                                          <button
                                            onClick={() => { setResultMatch(m); setResultCorrection(true); }}
                                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-amber-400 transition-colors"
                                            title="Corregir resultado"
                                          >
                                            <RotateCcw size={9} /> Corregir
                                          </button>
                                        )}
                                      </div>
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
                                    <div className="flex items-center justify-between pl-0.5">
                                      {(matchTime || m.court) ? (
                                        <div className="flex items-center gap-2">
                                          {matchTime && <span className="text-[10px] text-[#D4AF37]/70">🕐 {matchTime}</span>}
                                          {m.court && <span className="text-[10px] text-muted-foreground/60">{m.court}</span>}
                                        </div>
                                      ) : <span />}
                                      {m.isResult && (
                                        <button
                                          onClick={() => { setResultMatch(m); setResultCorrection(true); }}
                                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-amber-400 transition-colors"
                                          title="Corregir resultado"
                                        >
                                          <RotateCcw size={9} /> Corregir
                                        </button>
                                      )}
                                    </div>
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

        {/* ── ESTADO TAB ── */}
        {tab === "estado" && (
          <StatusTab status={tournamentStatus} loading={loadingStatus} onRefresh={refetchStatus} />
        )}

        {/* ── PISTAS TAB ── */}
        {tab === "pistas" && (
          <PistasTab tournamentId={id} />
        )}

        {/* ── HISTORIAL TAB ── */}
        {tab === "historial" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Historial de cambios</h3>
              <span className="text-xs text-muted-foreground">{auditLog.length} registros</span>
            </div>
            {loadingAudit ? (
              <div className="flex justify-center py-12">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : auditLog.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">Sin registros de auditoría todavía</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-36">Fecha</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Admin</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Acción</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Detalles / Cambio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry: AuditLogEntry, i: number) => (
                      <tr key={entry.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2 font-medium truncate max-w-[7rem]">{entry.adminName}</td>
                        <td className="px-3 py-2">
                          <AuditActionBadge action={entry.action} resource={entry.resource} />
                        </td>
                        <td className="px-3 py-2">
                          {entry.oldValue || entry.newValue ? (
                            <div className="flex items-start gap-1.5 flex-wrap">
                              {entry.oldValue && (
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">
                                  {Object.entries(entry.oldValue)
                                    .map(([k, v]) => `${k}: ${String(v ?? "—")}`)
                                    .join(", ")}
                                </span>
                              )}
                              {entry.oldValue && entry.newValue && (
                                <span className="text-muted-foreground/50 text-[10px] self-center">→</span>
                              )}
                              {entry.newValue && (
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 rounded px-1.5 py-0.5">
                                  {Object.entries(entry.newValue)
                                    .map(([k, v]) => `${k}: ${String(v ?? "—")}`)
                                    .join(", ")}
                                </span>
                              )}
                            </div>
                          ) : entry.details ? (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {Object.entries(entry.details as Record<string, unknown>)
                                .filter(([k]) => !["force"].includes(k))
                                .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                                .join(" · ")}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
        onClose={() => { setResultMatch(null); setResultCorrection(false); }}
        onSave={saveResult}
        saving={savingResultId === resultMatch.id}
        isCorrection={resultCorrection}
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
