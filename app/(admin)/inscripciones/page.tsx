"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Check, Clock, X, Download, ChevronRight, ChevronLeft, Users, CalendarDays, ArrowLeftRight, UserPlus } from "lucide-react";
import { downloadCsv } from "@/lib/utils/csv";
import Link from "next/link";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { AvailabilityModal } from "@/components/admin/availability-modal";
import { MoveCategoryModal } from "@/components/admin/move-category-modal";
import { EnrollTeamModal } from "@/components/admin/enroll-team-modal";
import ReplacePartnerModal from "@/components/admin/replace-partner-modal";
import { adminService } from "@/lib/services/admin";
import type { AdminRegistration, RegistrationStatus, Tournament } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª","2a": "2ª","3a": "3ª","4a": "4ª","5a": "5ª","6a": "6ª","iniciacion": "Inic.",
};

const STATUS_CFG: Record<RegistrationStatus, { label: string; cls: string }> = {
  CONFIRMED: { label: "Confirmado", cls: "text-green-400 bg-green-400/10 border-green-400/30"   },
  PENDING:   { label: "Pendiente",  cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  WAITLIST:  { label: "En espera",  cls: "text-blue-400 bg-blue-400/10 border-blue-400/30"       },
  CANCELLED: { label: "Cancelado",  cls: "text-red-400 bg-red-400/10 border-red-400/30"          },
};

// Tooltip del botón confirmar según el estado actual de la inscripción
function confirmTitle(status: RegistrationStatus): string {
  if (status === "WAITLIST") {
    return "Confirmar directamente (salta la cola automática — útil si has hablado con ellos y confirman su asistencia)";
  }
  return "Confirmar";
}

type StatusFilter = "all" | RegistrationStatus;

const PAGE_SIZE = 20;

// Agrupa inscripciones por pareja+categoría — muestra 1 fila por pareja
interface PairRegistration {
  ids:        string[];          // IDs de ambas inscripciones (1 si sin pareja)
  primary:    AdminRegistration; // inscripción del jugador principal (para mostrar datos)
  status:     RegistrationStatus;
  categoryId: string;
  pairKey:    string;
}

function groupByPair(regs: AdminRegistration[]): PairRegistration[] {
  const seen  = new Set<string>();
  const pairs: PairRegistration[] = [];

  for (const reg of regs) {
    // Clave canónica: ordenar userId y partnerId para que A+B === B+A
    const sorted  = [reg.userId, reg.partnerId ?? ""].sort().join(":");
    const key     = `${sorted}::${reg.categoryId}`;

    if (seen.has(key)) continue;
    seen.add(key);

    // Buscar la inscripción del otro miembro de la pareja
    const partner = reg.partnerId
      ? regs.find((r) => r.userId === reg.partnerId && r.categoryId === reg.categoryId)
      : null;

    pairs.push({
      ids:        partner ? [reg.id, partner.id] : [reg.id],
      primary:    reg,
      status:     reg.status,
      categoryId: reg.categoryId,
      pairKey:    key,
    });
  }
  return pairs;
}

export default function InscripcionesPage() {
  const qc = useQueryClient();

  const [tournamentId, setTournamentId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [catFilter,    setCatFilter]    = useState("all");
  const [search,       setSearch]       = useState("");
  const [updatingIds,   setUpdatingIds]  = useState<Set<string>>(new Set());
  const [selected,      setSelected]    = useState<Set<string>>(new Set());
  const [page,          setPage]        = useState(0);
  const [confirmCancel,    setConfirmCancel]    = useState<{ ids: string[]; name: string } | null>(null);
  const [confirmBulk,      setConfirmBulk]      = useState<{ ids: string[]; status: string; count: number } | null>(null);
  const [availRegId,       setAvailRegId]       = useState<string | null>(null);
  const [availEditMode,    setAvailEditMode]    = useState(false);
  const [movePair,         setMovePair]         = useState<PairRegistration | null>(null);
  const [enrollOpen,       setEnrollOpen]       = useState(false);
  const [replaceReg,       setReplaceReg]       = useState<AdminRegistration | null>(null);

  const { data: tournaments = [] } = useQuery({
    queryKey: ["tournaments"],
    queryFn:  adminService.tournaments.list,
  });

  const { data: registrations = [], isLoading } = useQuery({
    queryKey:  ["registrations", tournamentId],
    queryFn:   () => adminService.registrations.list(tournamentId),
    enabled:   !!tournamentId,
    staleTime:       60_000,
    refetchInterval: 30_000,
  });

  const { data: tournamentDetail } = useQuery({
    queryKey:  ["tournament-detail", tournamentId],
    queryFn:   () => adminService.tournaments.adminDetail(tournamentId),
    enabled:   !!tournamentId,
    staleTime: 120_000,
  });

  const bulkStatus = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      adminService.registrations.bulkStatus(ids, status),
    onSuccess: (res: any, vars) => {
      qc.invalidateQueries({ queryKey: ["registrations", tournamentId] });
      const updated = res?.count ?? res?.updated ?? vars.ids.length;
      toast.success(`${updated} inscripción(es) actualizadas`);
      setSelected(new Set());
      setUpdatingIds(new Set());
    },
    onError: (err: Error) => { toast.error(err.message); setUpdatingIds(new Set()); },
  });

  const moveCategory = useMutation({
    mutationFn: ({ registrationId, newCategoryId }: { registrationId: string; newCategoryId: string }) =>
      adminService.registrations.moveCategory(registrationId, newCategoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations", tournamentId] });
      toast.success("Inscripción movida a la nueva categoría");
      setMovePair(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePairStatus = (pair: PairRegistration, status: string) => {
    if (status === "CANCELLED") {
      setConfirmCancel({ ids: pair.ids, name: pair.primary.user.name });
      return;
    }
    setUpdatingIds(new Set(pair.ids));
    bulkStatus.mutate({ ids: pair.ids, status });
  };

  const handleBulkAction = (status: string) => {
    const allIds = pairs
      .filter((p) => selected.has(p.pairKey))
      .flatMap((p) => p.ids);
    if (allIds.length === 0) return;
    setConfirmBulk({ ids: allIds, status, count: selected.size });
  };

  const toggleSelect = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleAll = (keys: string[]) =>
    setSelected((prev) =>
      keys.every((k) => prev.has(k)) ? new Set() : new Set(keys),
    );

  const handleTournamentChange = (id: string) => {
    setTournamentId(id);
    setStatusFilter("all");
    setCatFilter("all");
    setSearch("");
    setSelected(new Set());
    setPage(0);
  };

  const pairs = useMemo(() => groupByPair(registrations), [registrations]);

  const availableCategories = useMemo(() => {
    const seen = new Map<string, { id: string; gender: string; level: string }>();
    for (const r of registrations) {
      if (!seen.has(r.categoryId)) seen.set(r.categoryId, { id: r.categoryId, gender: r.category.gender, level: r.category.level });
    }
    return [...seen.values()];
  }, [registrations]);

  const filtered = useMemo(() =>
    pairs
      .filter((p) => statusFilter === "all" || p.status === statusFilter)
      .filter((p) => catFilter === "all" || p.categoryId === catFilter)
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const reg = p.primary;
        return reg.user.name.toLowerCase().includes(q) ||
               (reg.partner?.name ?? "").toLowerCase().includes(q) ||
               `${reg.category.gender} ${reg.category.level}`.toLowerCase().includes(q);
      }),
    [pairs, statusFilter, catFilter, search],
  );

  const counts = {
    all:       pairs.length,
    confirmed: pairs.filter((p) => p.status === "CONFIRMED").length,
    pending:   pairs.filter((p) => p.status === "PENDING").length,
    waitlist:  pairs.filter((p) => p.status === "WAITLIST").length,
  };

  const selectedTournament    = tournaments.find((t: Tournament) => t.id === tournamentId);
  const tournamentHasSchedule = (tournamentDetail?.schedule?.length ?? 0) > 0;

  return (
    <div className="flex flex-col min-h-full">
      {availRegId && (
        <AvailabilityModal
          registrationId={availRegId}
          editMode={availEditMode}
          onClose={() => { setAvailRegId(null); setAvailEditMode(false); }}
        />
      )}

      {enrollOpen && selectedTournament && (
        <EnrollTeamModal
          tournament={selectedTournament}
          onEnrolled={(regId) => { setAvailRegId(regId); setAvailEditMode(true); }}
          onClose={() => {
            setEnrollOpen(false);
            qc.invalidateQueries({ queryKey: ["registrations", tournamentId] });
          }}
        />
      )}

      {movePair && (
        <MoveCategoryModal
          pair={movePair}
          categories={tournamentDetail?.categories ?? availableCategories}
          saving={moveCategory.isPending}
          onSave={(newCategoryId) =>
            moveCategory.mutate({ registrationId: movePair.primary.id, newCategoryId })
          }
          onClose={() => setMovePair(null)}
        />
      )}

      {replaceReg && (
        <ReplacePartnerModal
          registration={replaceReg}
          tournamentId={tournamentId}
          onClose={() => setReplaceReg(null)}
        />
      )}

      <ConfirmModal
        open={!!confirmCancel}
        title="Cancelar inscripción"
        description={`¿Cancelar la inscripción de ${confirmCancel?.name ?? ""}? Esta acción notificará al siguiente en lista de espera.`}
        confirmLabel="Sí, cancelar"
        danger
        onConfirm={() => {
          if (confirmCancel) {
            setUpdatingIds(new Set(confirmCancel.ids));
            bulkStatus.mutate({ ids: confirmCancel.ids, status: "CANCELLED" });
          }
          setConfirmCancel(null);
        }}
        onClose={() => setConfirmCancel(null)}
      />

      <ConfirmModal
        open={!!confirmBulk}
        title={`Cambiar estado en bloque (${confirmBulk?.count ?? 0} parejas)`}
        description={`¿Confirmas cambiar el estado de ${confirmBulk?.count ?? 0} inscripción(es) a "${confirmBulk?.status ?? ""}"? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, confirmar"
        danger={confirmBulk?.status === "CANCELLED" || confirmBulk?.status === "REJECTED"}
        onConfirm={() => {
          if (confirmBulk) {
            bulkStatus.mutate({ ids: confirmBulk.ids, status: confirmBulk.status });
          }
          setConfirmBulk(null);
        }}
        onClose={() => setConfirmBulk(null)}
      />

      <Header title="Inscripciones" />

      <div className="flex-1 p-6 space-y-5">

        {/* Tournament selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <select
            value={tournamentId}
            onChange={(e) => handleTournamentChange(e.target.value)}
            className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] min-w-[280px]"
          >
            <option value="">Selecciona un torneo...</option>
            {(tournaments as Tournament[]).length === 0 && (
              <option disabled>— No hay torneos disponibles —</option>
            )}
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

          {selectedTournament && (
            <button
              onClick={() => setEnrollOpen(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#D4AF37] hover:bg-[#c09b2a] text-black text-xs font-semibold transition-colors"
            >
              <UserPlus size={13} />
              Inscribir equipo
            </button>
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
                { key: "all",        label: "Total",       value: counts.all,       cls: "text-foreground"  },
                { key: "CONFIRMED",  label: "Confirmadas", value: counts.confirmed, cls: "text-green-400"   },
                { key: "PENDING",    label: "Pendientes",  value: counts.pending,   cls: "text-yellow-400"  },
                { key: "WAITLIST",   label: "En espera",   value: counts.waitlist,  cls: "text-blue-400"    },
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
              {availableCategories.length > 1 && (
                <select
                  value={catFilter}
                  onChange={(e) => { setCatFilter(e.target.value); setPage(0); }}
                  className="h-9 px-2 rounded-md bg-secondary border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="all">Todas las categorías</option>
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.gender === "M" ? "Masc." : "Fem."} {c.level}
                    </option>
                  ))}
                </select>
              )}
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
                onClick={() => downloadCsv(`inscripciones-${tournamentId}`, filtered.map((p) => ({
                  "Jugador 1":      p.primary.user.name,
                  "Email J1":       p.primary.user.email ?? "",
                  "Nivel SPA J1":   p.primary.user.categoryLevel ?? "",
                  "SPA J1":         p.primary.user.spaPoints ?? "",
                  "Jugador 2":      p.primary.partner?.name ?? "",
                  "Email J2":       p.primary.partner?.email ?? "",
                  "Nivel SPA J2":   p.primary.partner?.categoryLevel ?? "",
                  "SPA J2":         p.primary.partner?.spaPoints ?? "",
                  "Categoría":      `${p.primary.category.gender === "M" ? "Masc." : "Fem."} ${p.primary.category.level}`,
                  "Estado":         p.status,
                  "Pago":           p.primary.paid ? "Sí" : "No",
                  "Fecha":          new Date(p.primary.createdAt).toLocaleDateString("es-ES"),
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
                <span className="text-sm font-medium text-[#D4AF37]">{selected.size} pareja(s) seleccionada(s)</span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => handleBulkAction("CONFIRMED")}
                    disabled={bulkStatus.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/30 text-xs font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                  >
                    <Check size={12} /> Confirmar
                  </button>
                  <button
                    onClick={() => handleBulkAction("WAITLIST")}
                    disabled={bulkStatus.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
                  >
                    <Clock size={12} /> En espera
                  </button>
                  <button
                    onClick={() => handleBulkAction("CANCELLED")}
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
              const pageKeys  = pageItems.map((p) => p.pairKey);
              const allPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));

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
                      <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-secondary/50">
                            <th className="px-4 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={allPageSelected}
                                onChange={() => toggleAll(pageKeys)}
                                className="rounded border-border accent-[#D4AF37] cursor-pointer"
                              />
                            </th>
                            {["Pareja", "Nivel SPA", "Categoría", "Fecha", "Estado", "Pago", "Acciones"].map((h) => (
                              <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((pair) => {
                            const reg        = pair.primary;
                            const scfg       = STATUS_CFG[pair.status];
                            const isSelected = selected.has(pair.pairKey);
                            const isUpdating = pair.ids.some((id) => updatingIds.has(id));
                            return (
                              <tr
                                key={pair.pairKey}
                                className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${isSelected ? "bg-[rgba(212,175,55,0.04)]" : ""}`}
                              >
                                <td className="px-4 py-3.5">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelect(pair.pairKey)}
                                    className="rounded border-border accent-[#D4AF37] cursor-pointer"
                                  />
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
                                      <span className="text-xs font-semibold text-foreground">
                                        {CATEGORY_LABEL[reg.user.categoryLevel ?? ""] ?? reg.user.categoryLevel ?? "—"}
                                      </span>
                                      {reg.user.spaPoints != null && (
                                        <span className="text-[10px] text-muted-foreground">({Math.round(Number(reg.user.spaPoints))} SPA)</span>
                                      )}
                                    </div>
                                    {reg.partner && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-muted-foreground">
                                          {CATEGORY_LABEL[reg.partner.categoryLevel ?? ""] ?? reg.partner.categoryLevel ?? "—"}
                                        </span>
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
                                    {(() => {
                                      const noAvail = tournamentHasSchedule && !reg.availability;
                                      return (
                                        <button
                                          onClick={() => { setAvailRegId(reg.id); setAvailEditMode(noAvail); }}
                                          title={noAvail ? "Sin disponibilidad — click para establecer" : "Ver / editar disponibilidad"}
                                          className={`relative p-1.5 rounded-md transition-colors ${
                                            noAvail
                                              ? "text-orange-400 hover:bg-orange-400/10"
                                              : "text-muted-foreground hover:bg-[rgba(212,175,55,0.1)] hover:text-[#D4AF37]"
                                          }`}
                                        >
                                          <CalendarDays size={14} />
                                          {noAvail && (
                                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400" />
                                          )}
                                        </button>
                                      );
                                    })()}
                                    {pair.status !== "CONFIRMED" && (
                                      <button
                                        onClick={() => handlePairStatus(pair, "CONFIRMED")}
                                        disabled={isUpdating}
                                        title={confirmTitle(pair.status)}
                                        className="p-1.5 rounded-md hover:bg-green-400/10 text-muted-foreground hover:text-green-400 disabled:opacity-40 transition-colors"
                                      >
                                        <Check size={14} />
                                      </button>
                                    )}
                                    {pair.status !== "WAITLIST" && (
                                      <button
                                        onClick={() => handlePairStatus(pair, "WAITLIST")}
                                        disabled={isUpdating}
                                        title="Mover a espera"
                                        className="p-1.5 rounded-md hover:bg-blue-400/10 text-muted-foreground hover:text-blue-400 disabled:opacity-40 transition-colors"
                                      >
                                        <Clock size={14} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setMovePair(pair)}
                                      disabled={isUpdating}
                                      title="Cambiar categoría"
                                      className="p-1.5 rounded-md hover:bg-[rgba(212,175,55,0.1)] text-muted-foreground hover:text-[#D4AF37] disabled:opacity-40 transition-colors"
                                    >
                                      <ArrowLeftRight size={14} />
                                    </button>
                                    {reg.partnerId && (
                                      <button
                                        onClick={() => setReplaceReg(reg)}
                                        disabled={isUpdating}
                                        title="Cambiar pareja"
                                        className="p-1.5 rounded-md hover:bg-purple-400/10 text-muted-foreground hover:text-purple-400 disabled:opacity-40 transition-colors"
                                      >
                                        <Users size={14} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handlePairStatus(pair, "CANCELLED")}
                                      disabled={isUpdating}
                                      title="Cancelar pareja"
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
                      </div>

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
