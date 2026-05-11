"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy, Users, Calendar, ChevronLeft, MapPin,
  Check, X, Clock, Download, Search, MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import type { AdminRegistration, RegistrationStatus } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª", "2a": "2ª", "3a": "3ª",
  "4a": "4ª", "5a": "5ª", "6a": "6ª", "iniciacion": "Inic.",
};
const GENDER_SHORT: Record<string, string> = { M: "Masc.", F: "Fem." };

const STATUS_CONFIG: Record<RegistrationStatus, { label: string; color: string; icon: React.ElementType }> = {
  confirmed: { label: "Confirmado", color: "text-green-400 bg-green-400/10 border-green-400/30",  icon: Check  },
  pending:   { label: "Pendiente",  color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30", icon: Clock  },
  waitlist:  { label: "En espera",  color: "text-blue-400 bg-blue-400/10 border-blue-400/30",    icon: Clock  },
};

type Tab = "resumen" | "inscripciones" | "calendario";

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
  const router  = useRouter();
  const qc      = useQueryClient();
  const [tab,            setTab]            = useState<Tab>("resumen");
  const [regFilter,      setRegFilter]      = useState<"all" | RegistrationStatus>("all");
  const [regSearch,      setRegSearch]      = useState("");
  const [updatingId,     setUpdatingId]     = useState<string | null>(null);

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn:  () => adminService.tournaments.detail(id),
  });

  const { data: registrations = [], isLoading: loadingRegs } = useQuery({
    queryKey: ["registrations", id],
    queryFn:  () => adminService.registrations.list(id),
    enabled:  tab === "inscripciones",
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
              <div className="flex items-center gap-3">
                <h2 className="font-heading text-xl text-foreground">{tournament.name}</h2>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLOR_T[tournament.status]}`}>
                  {STATUS_LABEL_T[tournament.status]}
                </span>
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
                          {GENDER_SHORT[cat.gender]} {CATEGORY_LABEL[cat.level]}
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
                      {GENDER_SHORT[cat.gender]} {CATEGORY_LABEL[cat.level]}
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
          <div className="bg-card border border-border rounded-lg p-6 flex items-center justify-center min-h-[300px]">
            <div className="text-center space-y-2">
              <Calendar size={36} className="text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Calendario de partidos próximamente</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
