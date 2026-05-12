"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Check, Clock, X, Download, ChevronRight, ChevronLeft, Users } from "lucide-react";
import { downloadCsv } from "@/lib/utils/csv";
import Link from "next/link";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import type { AdminRegistration, RegistrationStatus, Tournament } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª","2a": "2ª","3a": "3ª","4a": "4ª","5a": "5ª","6a": "6ª","iniciacion": "Inic.",
};

const STATUS_CFG: Record<RegistrationStatus, { label: string; cls: string }> = {
  confirmed: { label: "Confirmado", cls: "text-green-400 bg-green-400/10 border-green-400/30"   },
  pending:   { label: "Pendiente",  cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  waitlist:  { label: "En espera",  cls: "text-blue-400 bg-blue-400/10 border-blue-400/30"       },
};

type StatusFilter = "all" | RegistrationStatus;

const PAGE_SIZE = 20;

export default function InscripcionesPage() {
  const qc = useQueryClient();

  const [tournamentId, setTournamentId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search,       setSearch]       = useState("");
  const [updatingId,   setUpdatingId]   = useState<string | null>(null);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [page,         setPage]         = useState(0);

  const { data: tournaments = [] } = useQuery({
    queryKey: ["tournaments"],
    queryFn:  adminService.tournaments.list,
  });

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations", tournamentId],
    queryFn:  () => adminService.registrations.list(tournamentId),
    enabled:  !!tournamentId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ regId, status }: { regId: string; status: string }) =>
      adminService.registrations.updateStatus(regId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations", tournamentId] });
      toast.success("Estado actualizado");
    },
    onError:   (err: Error) => toast.error(err.message),
    onSettled: () => setUpdatingId(null),
  });

  const handleStatus = (regId: string, status: string) => {
    setUpdatingId(regId);
    updateStatus.mutate({ regId, status });
  };

  const bulkStatus = useMutation({
    mutationFn: (status: string) =>
      adminService.registrations.bulkStatus(Array.from(selected), status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations", tournamentId] });
      toast.success(`${selected.size} inscripción(es) actualizadas`);
      setSelected(new Set());
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = (ids: string[]) =>
    setSelected((prev) =>
      ids.every((id) => prev.has(id)) ? new Set() : new Set(ids),
    );

  const filtered = useMemo(() =>
    registrations
      .filter((r: AdminRegistration) => statusFilter === "all" || r.status === statusFilter)
      .filter((r: AdminRegistration) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return r.player1Name.toLowerCase().includes(q) ||
               (r.player2Name ?? "").toLowerCase().includes(q) ||
               r.categoryDisplay.toLowerCase().includes(q);
      }),
    [registrations, statusFilter, search],
  );

  const counts = {
    all:       registrations.length,
    confirmed: registrations.filter((r: AdminRegistration) => r.status === "confirmed").length,
    pending:   registrations.filter((r: AdminRegistration) => r.status === "pending").length,
    waitlist:  registrations.filter((r: AdminRegistration) => r.status === "waitlist").length,
  };

  const selectedTournament = tournaments.find((t: Tournament) => t.id === tournamentId);

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Inscripciones" />

      <div className="flex-1 p-6 space-y-5">

        {/* Tournament selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <select
            value={tournamentId}
            onChange={(e) => { setTournamentId(e.target.value); setStatusFilter("all"); setSearch(""); setSelected(new Set()); setPage(0); }}
            className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] min-w-[280px]"
          >
            <option value="">Selecciona un torneo...</option>
            {(tournaments as Tournament[]).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {selectedTournament && (
            <Link
              href={`/torneos/${selectedTournament.id}`}
              className="flex items-center gap-1 text-xs text-[#D4AF37] hover:underline"
            >
              Ver torneo <ChevronRight size={12} />
            </Link>
          )}
        </div>

        {!tournamentId ? (
          <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center justify-center gap-3">
            <div className="p-3 rounded-full bg-[rgba(212,175,55,0.1)]">
              <Check size={28} className="text-[#D4AF37]" />
            </div>
            <p className="text-sm text-muted-foreground">Selecciona un torneo para gestionar sus inscripciones</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              {([
                { key: "all",       label: "Total",       value: counts.all,       cls: "text-foreground"  },
                { key: "confirmed", label: "Confirmadas", value: counts.confirmed, cls: "text-green-400"   },
                { key: "pending",   label: "Pendientes",  value: counts.pending,   cls: "text-yellow-400"  },
                { key: "waitlist",  label: "En espera",   value: counts.waitlist,  cls: "text-blue-400"    },
              ] as { key: StatusFilter; label: string; value: number; cls: string }[]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`bg-card border rounded-lg p-4 text-left transition-all hover:border-[rgba(212,175,55,0.3)] ${
                    statusFilter === s.key ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.05)]" : "border-border"
                  }`}
                >
                  <p className={`text-2xl font-heading ${s.cls}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-border flex-1 max-w-xs">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar jugador o pareja..."
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                />
              </div>
              <button
                onClick={() => downloadCsv(`inscripciones-${tournamentId}`, filtered.map((r: AdminRegistration) => ({
                  "Jugador 1": r.player1Name,
                  "Jugador 2": r.player2Name ?? "",
                  "Categoría": r.categoryDisplay,
                  "Estado":    r.status,
                  "Pago":      r.paid ? "Sí" : "No",
                  "Fecha":     new Date(r.createdAt).toLocaleDateString("es-ES"),
                })))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#D4AF37] transition-colors ml-auto"
              >
                <Download size={13} />
                Exportar CSV
              </button>
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.3)] rounded-lg">
                <Users size={14} className="text-[#D4AF37]" />
                <span className="text-sm font-medium text-[#D4AF37]">{selected.size} seleccionadas</span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => bulkStatus.mutate("confirmed")}
                    disabled={bulkStatus.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/30 text-xs font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                  >
                    <Check size={12} /> Confirmar
                  </button>
                  <button
                    onClick={() => bulkStatus.mutate("waitlist")}
                    disabled={bulkStatus.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
                  >
                    <Clock size={12} /> En espera
                  </button>
                  <button
                    onClick={() => bulkStatus.mutate("cancelled")}
                    disabled={bulkStatus.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                  >
                    <X size={12} /> Rechazar
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground ml-1 transition-colors"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            {(() => {
              const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
              const pageIds   = pageItems.map((r: AdminRegistration) => r.id);
              const allPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selected.has(id));

              return (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  {isLoading ? (
                    <div className="space-y-0">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex gap-4 px-5 py-4 border-b border-border">
                          <div className="h-4 w-44 rounded bg-secondary animate-pulse" />
                          <div className="h-4 w-24 rounded bg-secondary animate-pulse" />
                          <div className="h-4 w-20 rounded bg-secondary animate-pulse ml-auto" />
                        </div>
                      ))}
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No hay inscripciones para estos filtros
                    </div>
                  ) : (
                    <>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-secondary/50">
                            <th className="px-4 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={allPageSelected}
                                onChange={() => toggleAll(pageIds)}
                                className="rounded border-border accent-[#D4AF37] cursor-pointer"
                              />
                            </th>
                            {["Pareja", "Categoría", "Fecha", "Estado", "Pago", "Acciones"].map((h) => (
                              <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((reg: AdminRegistration) => {
                            const scfg     = STATUS_CFG[reg.status];
                            const isSelected = selected.has(reg.id);
                            return (
                              <tr
                                key={reg.id}
                                className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${isSelected ? "bg-[rgba(212,175,55,0.04)]" : ""}`}
                              >
                                <td className="px-4 py-3.5">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelect(reg.id)}
                                    className="rounded border-border accent-[#D4AF37] cursor-pointer"
                                  />
                                </td>
                                <td className="px-5 py-3.5">
                                  <p className="text-sm font-medium text-foreground">{reg.player1Name}</p>
                                  {reg.player2Name
                                    ? <p className="text-xs text-muted-foreground">{reg.player2Name}</p>
                                    : <p className="text-xs text-muted-foreground italic">Sin pareja</p>
                                  }
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="text-xs text-muted-foreground">{reg.categoryDisplay}</span>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(reg.createdAt).toLocaleDateString("es-ES")}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${scfg.cls}`}>
                                    {scfg.label}
                                  </span>
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
                                        title="Confirmar"
                                        className="p-1.5 rounded-md hover:bg-green-400/10 text-muted-foreground hover:text-green-400 disabled:opacity-40 transition-colors"
                                      >
                                        <Check size={14} />
                                      </button>
                                    )}
                                    {reg.status !== "waitlist" && (
                                      <button
                                        onClick={() => handleStatus(reg.id, "waitlist")}
                                        disabled={updatingId === reg.id}
                                        title="Mover a espera"
                                        className="p-1.5 rounded-md hover:bg-blue-400/10 text-muted-foreground hover:text-blue-400 disabled:opacity-40 transition-colors"
                                      >
                                        <Clock size={14} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleStatus(reg.id, "cancelled")}
                                      disabled={updatingId === reg.id}
                                      title="Cancelar"
                                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-40 transition-colors"
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

                      {filtered.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                          <span className="text-xs text-muted-foreground">
                            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPage((p) => p - 1)}
                              disabled={page === 0}
                              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors"
                            >
                              <ChevronLeft size={15} />
                            </button>
                            <button
                              onClick={() => setPage((p) => p + 1)}
                              disabled={(page + 1) * PAGE_SIZE >= filtered.length}
                              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors"
                            >
                              <ChevronRight size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
