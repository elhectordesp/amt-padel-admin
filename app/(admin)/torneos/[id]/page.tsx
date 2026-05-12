"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy, Calendar, ChevronLeft, MapPin,
  Check, X, Clock, Download, Search, Loader2,
  GitBranch, CheckCircle, Copy, Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { adminService } from "@/lib/services/admin";
import { downloadCsv } from "@/lib/utils/csv";
import { CATEGORY_LABEL_SHORT, GENDER_LABEL } from "@/lib/constants";
import type { AdminRegistration, RegistrationStatus, MatchResult } from "@/types";

const STATUS_CONFIG: Record<RegistrationStatus, { label: string; color: string; icon: React.ElementType }> = {
  confirmed: { label: "Confirmado", color: "text-green-400 bg-green-400/10 border-green-400/30",    icon: Check },
  pending:   { label: "Pendiente",  color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30", icon: Clock },
  waitlist:  { label: "En espera",  color: "text-blue-400 bg-blue-400/10 border-blue-400/30",       icon: Clock },
};

const GENDER_SHORT = { M: "Masc.", F: "Fem." };

type Tab = "resumen" | "inscripciones" | "calendario" | "cuadro";

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

export default function TorneoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc     = useQueryClient();
  const [tab,            setTab]          = useState<Tab>("resumen");
  const [regFilter,      setRegFilter]    = useState<"all" | RegistrationStatus>("all");
  const [regSearch,      setRegSearch]    = useState("");
  const [updatingId,     setUpdatingId]   = useState<string | null>(null);
  const [bracketCatId,   setBracketCatId] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn:  () => adminService.tournaments.detail(id),
  });

  const { data: registrations = [], isLoading: loadingRegs } = useQuery({
    queryKey: ["registrations", id],
    queryFn:  () => adminService.registrations.list(id),
    enabled:  tab === "inscripciones",
  });

  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["matches", id],
    queryFn:  () => adminService.matches.list(id),
    enabled:  tab === "calendario",
  });

  const updateStatus = useMutation({
    mutationFn: ({ regId, status }: { regId: string; status: string }) =>
      adminService.registrations.updateStatus(regId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations", id] });
      toast.success("Estado actualizado");
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setUpdatingId(null),
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

  const generateBracket = useMutation({
    mutationFn: () => adminService.tournaments.generateBracket(id, bracketCatId),
    onSuccess:  () => {
      toast.success("Cuadro generado correctamente");
      qc.invalidateQueries({ queryKey: ["tournament", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleStatus = (regId: string, status: string) => {
    setUpdatingId(regId);
    updateStatus.mutate({ regId, status });
  };

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

  if (!tournament) return null;

  const totalSpots      = tournament.categories.reduce((s, c) => s + c.totalSpots, 0);
  const totalRegistered = tournament.categories.reduce((s, c) => s + c.registeredCount, 0);
  const fillPct         = totalSpots > 0 ? Math.round((totalRegistered / totalSpots) * 100) : 0;

  const TIER_LABEL_T: Record<string, string> = { gold: "Gold", silver: "Silver", open: "Open" };
  const TIER_COLOR_T: Record<string, string>  = { gold: "#D4AF37", silver: "#C0C0C0", open: "#94A3B8" };
  const tournamentTier = tournament.spaTier ?? tournament.tier;

  const STATUS_LABEL_T: Record<string, string> = { open: "Abierto", ongoing: "En curso", finished: "Finalizado" };
  const STATUS_COLOR_T: Record<string, string> = {
    open: "text-green-400 bg-green-400/10 border-green-400/30",
    ongoing: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    finished: "text-muted-foreground bg-secondary border-border",
  };

  const filteredRegs = registrations
    .filter((r) => regFilter === "all" || r.status === regFilter)
    .filter((r) => {
      if (!regSearch.trim()) return true;
      const q = regSearch.toLowerCase();
      return r.player1Name.toLowerCase().includes(q) ||
             (r.player2Name ?? "").toLowerCase().includes(q);
    });

  const regCounts = {
    all:       registrations.length,
    confirmed: registrations.filter((r) => r.status === "confirmed").length,
    pending:   registrations.filter((r) => r.status === "pending").length,
    waitlist:  registrations.filter((r) => r.status === "waitlist").length,
  };

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
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLOR_T[tournament.status]}`}>
                  {STATUS_LABEL_T[tournament.status]}
                </span>
                {tournamentTier && tournamentTier !== "open" && (
                  <span
                    className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    style={{
                      color: TIER_COLOR_T[tournamentTier],
                      backgroundColor: TIER_COLOR_T[tournamentTier] + "22",
                      borderColor:     TIER_COLOR_T[tournamentTier] + "55",
                    }}
                  >
                    {TIER_LABEL_T[tournamentTier].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-[#D4AF37]" />
                  {tournament.dates}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#D4AF37]" />
                  {tournament.venue}
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
                className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
              >
                {duplicate.isPending ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                title="Eliminar torneo"
                className="p-2 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
              >
                <Trash2 size={15} />
              </button>
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
              <p className="text-xs text-muted-foreground mt-0.5">Inscritos</p>
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
        <div className="flex items-center gap-0 border-b border-border">
          {([
            { key: "resumen",       label: "Resumen"        },
            { key: "inscripciones", label: `Inscripciones (${registrations.length || "…"})` },
            { key: "calendario",    label: "Calendario"     },
            { key: "cuadro",        label: "Cuadro"         },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? "border-[#D4AF37] text-[#D4AF37]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── RESUMEN TAB ── */}
        {tab === "resumen" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Categories */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Categorías</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    {["Categoría", "Plazas", "Inscritos", "Ocupación"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tournament.categories.map((cat) => {
                    const pct = cat.totalSpots > 0
                      ? Math.round((cat.registeredCount / cat.totalSpots) * 100)
                      : 0;
                    return (
                      <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {GENDER_SHORT[cat.gender]} {CATEGORY_LABEL_SHORT[cat.level]}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{cat.totalSpots}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{cat.registeredCount}</td>
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

            {/* Phase progress */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Fase actual por categoría</h3>
              <div className="space-y-3">
                {tournament.categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">
                      {GENDER_SHORT[cat.gender]} {CATEGORY_LABEL_SHORT[cat.level]}
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
            {/* Sub-filters + search */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 bg-secondary rounded-lg p-1">
                {([
                  { key: "all",       label: `Todos (${regCounts.all})`            },
                  { key: "confirmed", label: `Confirmados (${regCounts.confirmed})` },
                  { key: "pending",   label: `Pendientes (${regCounts.pending})`    },
                  { key: "waitlist",  label: `En espera (${regCounts.waitlist})`    },
                ] as { key: "all" | RegistrationStatus; label: string }[]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setRegFilter(f.key)}
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
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-border">
                  <Search size={14} className="text-muted-foreground shrink-0" />
                  <input
                    value={regSearch}
                    onChange={(e) => setRegSearch(e.target.value)}
                    placeholder="Buscar pareja o jugador..."
                    className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-48"
                  />
                </div>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#D4AF37] transition-colors">
                  <Download size={13} />
                  Exportar
                </button>
              </div>
            </div>

            {/* Registrations table */}
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
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      {["Pareja / Jugador", "Categoría", "Estado", "Pago", "Acciones"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-sm text-muted-foreground">
                          No hay inscripciones
                        </td>
                      </tr>
                    ) : filteredRegs.map((reg) => (
                      <tr key={reg.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-foreground">{reg.player1Name}</p>
                          {reg.player2Name && (
                            <p className="text-xs text-muted-foreground">{reg.player2Name}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-muted-foreground">{reg.categoryDisplay}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={reg.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium ${reg.paid ? "text-green-400" : "text-yellow-400"}`}>
                            {reg.paid ? "Pagado" : "Pendiente"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            {reg.status !== "confirmed" && (
                              <button
                                onClick={() => handleStatus(reg.id, "confirmed")}
                                disabled={updatingId === reg.id}
                                className="p-1.5 rounded-md hover:bg-green-400/10 text-muted-foreground hover:text-green-400 transition-colors disabled:opacity-50"
                                title="Confirmar"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            {reg.status !== "waitlist" && (
                              <button
                                onClick={() => handleStatus(reg.id, "waitlist")}
                                disabled={updatingId === reg.id}
                                className="p-1.5 rounded-md hover:bg-blue-400/10 text-muted-foreground hover:text-blue-400 transition-colors disabled:opacity-50"
                                title="Mover a espera"
                              >
                                <Clock size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleStatus(reg.id, "cancelled")}
                              disabled={updatingId === reg.id}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                              title="Rechazar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── CALENDARIO TAB ── */}
        {tab === "calendario" && (
          <div className="space-y-4">
            {loadingMatches ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-card border border-border animate-pulse" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center gap-3">
                <Calendar size={36} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No hay partidos registrados aún</p>
              </div>
            ) : (
              (() => {
                // Group by date
                const byDate = (matches as MatchResult[]).reduce<Record<string, MatchResult[]>>((acc, m) => {
                  const date = m.date.includes("T") ? m.date.split("T")[0] : m.date;
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(m);
                  return acc;
                }, {});

                return Object.entries(byDate).map(([date, dayMatches]) => {
                  const label = new Date(date + "T12:00:00").toLocaleDateString("es-ES", {
                    weekday: "long", day: "numeric", month: "long",
                  });
                  const pending  = dayMatches.filter((m) => !m.isResult).length;
                  const finished = dayMatches.filter((m) =>  m.isResult).length;

                  return (
                    <div key={date} className="bg-card border border-border rounded-lg overflow-hidden">
                      {/* Day header */}
                      <div className="flex items-center justify-between px-5 py-3 bg-secondary/50 border-b border-border">
                        <div>
                          <p className="text-sm font-semibold text-foreground capitalize">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{dayMatches.length} partidos</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {finished > 0 && (
                            <span className="flex items-center gap-1 text-green-400">
                              <CheckCircle size={12} /> {finished} completados
                            </span>
                          )}
                          {pending > 0 && (
                            <span className="flex items-center gap-1 text-yellow-400">
                              <Clock size={12} /> {pending} pendientes
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Matches grid */}
                      <div className="divide-y divide-border">
                        {dayMatches.map((m: MatchResult) => {
                          const time = m.date.includes("T")
                            ? new Date(m.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
                            : "—";
                          return (
                            <div key={m.id} className="flex items-center gap-4 px-5 py-3 hover:bg-secondary/30 transition-colors">
                              {/* Time */}
                              <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{time}</span>

                              {/* Court */}
                              <span className="text-xs text-muted-foreground w-16 shrink-0 truncate">{m.court || "—"}</span>

                              {/* Phase badge */}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.2)] shrink-0">
                                {m.phase}
                              </span>

                              {/* Teams */}
                              <div className="flex-1 flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-foreground truncate">{m.team1.join(" / ")}</span>
                                <span className="text-xs text-muted-foreground shrink-0">vs</span>
                                <span className="text-sm font-medium text-foreground truncate">{m.team2.join(" / ")}</span>
                              </div>

                              {/* Result / Status */}
                              {m.isResult && m.sets1 && m.sets2 ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <CheckCircle size={13} className="text-green-400" />
                                  <span className="text-xs font-mono text-foreground">
                                    {m.sets1.map((s, i) => `${s}-${m.sets2![i]}`).join(", ")}
                                  </span>
                                </div>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-yellow-400 shrink-0">
                                  <Clock size={12} /> Pendiente
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* ── CUADRO TAB ── */}
        {tab === "cuadro" && (
          <div className="space-y-4">
            {/* Generate bracket */}
            {tournament.status !== "finished" && (
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Generar cuadro automático</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Genera el cuadro de eliminatorias en base a los resultados de la fase de grupos
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={bracketCatId}
                      onChange={(e) => setBracketCatId(e.target.value)}
                      className="h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    >
                      <option value="">Seleccionar categoría...</option>
                      {tournament.categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {GENDER_LABEL[cat.gender].short} {CATEGORY_LABEL_SHORT[cat.level]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => generateBracket.mutate()}
                      disabled={!bracketCatId || generateBracket.isPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-50 transition-colors"
                    >
                      {generateBracket.isPending
                        ? <Loader2 size={14} className="animate-spin" />
                        : <GitBranch size={14} />
                      }
                      Generar cuadro
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bracket preview per category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {tournament.categories.map((cat) => (
                <div key={cat.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-foreground">
                      {GENDER_LABEL[cat.gender].short} {CATEGORY_LABEL_SHORT[cat.level]}
                    </h4>
                    <span className="text-xs text-[#D4AF37]">
                      {cat.currentPhaseLabel ?? cat.currentPhase}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: "Grupos",          done: ["groups","r16","qf","sf","final","finished"].includes(cat.currentPhase) },
                      { label: "Octavos",          done: ["r16","qf","sf","final","finished"].includes(cat.currentPhase) },
                      { label: "Cuartos",          done: ["qf","sf","final","finished"].includes(cat.currentPhase) },
                      { label: "Semis",            done: ["sf","final","finished"].includes(cat.currentPhase) },
                      { label: "Final",            done: ["final","finished"].includes(cat.currentPhase) },
                    ].map(({ label, done }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${done ? "bg-[#D4AF37] border-[#D4AF37]" : "border-border"}`}>
                          {done && <Check size={9} className="text-[#0C0C0C]" />}
                        </div>
                        <span className={`text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>

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
    </>
  );
}
