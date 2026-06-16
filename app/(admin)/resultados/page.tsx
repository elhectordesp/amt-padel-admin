"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, Search, CheckCircle, Clock, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { downloadCsv } from "@/lib/utils/csv";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { ErrorState } from "@/components/admin/error-state";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ResultModal } from "@/components/admin/result-modal";
import { adminService } from "@/lib/services/admin";
import { phaseLabel } from "@/lib/constants";
import type { MatchResult, Tournament } from "@/types";

const PAGE_SIZE = 30;


// ── Main ──────────────────────────────────────────────────────────────────
export default function ResultadosPage() {
  const qc = useQueryClient();
  const [search,        setSearch]        = useState("");
  const [page,          setPage]          = useState(0);
  const [tournamentId,  setTournamentId]  = useState<string>("");
  const [selectedMatch,  setSelectedMatch]  = useState<MatchResult | null>(null);
  const [savingId,       setSavingId]       = useState<string | null>(null);
  const [confirmEdit,    setConfirmEdit]    = useState<MatchResult | null>(null);

  const { data: tournaments = [] } = useQuery({
    queryKey: ["tournaments"],
    queryFn:  adminService.tournaments.list,
  });

  const ongoingTournaments = tournaments.filter((t: Tournament) => ["ONGOING", "SCHEDULED", "OPEN", "DRAW"].includes(t.status));

  const {
    data: matches = [], isLoading, isError, refetch,
  } = useQuery({
    queryKey: ["matches", tournamentId],
    queryFn:  () => adminService.matches.list(tournamentId),
    enabled:  !!tournamentId,
  });

  const saveResult = useMutation({
    mutationFn: ({ id, sets1, sets2 }: { id: string; sets1: number[]; sets2: number[] }) =>
      adminService.matches.setResult(id, sets1, sets2),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches", tournamentId] });
      qc.invalidateQueries({ queryKey: ["standings", tournamentId] });
      qc.invalidateQueries({ queryKey: ["bracket", tournamentId] });
      toast.success("Resultado guardado");
      setSelectedMatch(null);
    },
    onError:   (err: Error) => toast.error(err.message),
    onSettled: () => setSavingId(null),
  });

  const pendingMatches  = matches.filter((m: MatchResult) => !m.isResult);
  const finishedMatches = matches.filter((m: MatchResult) =>  m.isResult);

  const filtered = useMemo(() =>
    [...pendingMatches, ...finishedMatches].filter((m: MatchResult) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return m.team1.some((p) => p.toLowerCase().includes(q)) ||
             m.team2.some((p) => p.toLowerCase().includes(q)) ||
             m.court.toLowerCase().includes(q);
    }),
  [pendingMatches, finishedMatches, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleTournamentChange = (id: string) => { setTournamentId(id); setPage(0); setSearch(""); };
  const handleSearchChange     = (v: string)  => { setSearch(v);        setPage(0); };

  return (
    <>
      <div className="flex flex-col min-h-full">
        <Header title="Resultados" />

        <div className="flex-1 p-6 space-y-5">

          {/* Tournament selector */}
          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={tournamentId}
              onChange={(e) => handleTournamentChange(e.target.value)}
              className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] min-w-[260px]"
            >
              <option value="">Selecciona un torneo...</option>
              {ongoingTournaments.length === 0 && (
                <option disabled>— No hay torneos en curso o abiertos —</option>
              )}
              {ongoingTournaments.map((t: Tournament) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {tournamentId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-border">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Buscar jugador o pista..."
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-44"
                />
              </div>
            )}

            {tournamentId && (
              <div className="flex items-center gap-4 ml-auto text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock size={12} className="text-yellow-400" />
                  {pendingMatches.length} pendientes
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-green-400" />
                  {finishedMatches.length} completados
                </span>
                <button
                  onClick={() => downloadCsv(
                    `resultados-${tournamentId}`,
                    filtered.map((m: MatchResult) => ({
                      Fase:       phaseLabel(m.phase),
                      Pista:      m.court,
                      "Pareja 1": m.team1.join(" / "),
                      "Pareja 2": m.team2.join(" / "),
                      Estado:     m.isResult ? "Completado" : "Pendiente",
                      Resultado:  m.isResult && m.sets1
                        ? m.sets1.map((s, i) => `${s}-${m.sets2?.[i] ?? 0}`).join(", ")
                        : "",
                    }))
                  )}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:border-[#D4AF37] hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  <Download size={12} /> Exportar CSV
                </button>
              </div>
            )}
          </div>

          {/* Empty / no tournament selected */}
          {!tournamentId && (
            <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center justify-center gap-3">
              <Trophy size={36} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Selecciona un torneo para ver sus partidos</p>
            </div>
          )}

          {/* Matches table */}
          {tournamentId && (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                {isLoading ? (
                  <div className="space-y-0">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="flex gap-4 px-5 py-4 border-b border-border">
                        <div className="h-4 w-48 rounded bg-secondary animate-pulse" />
                        <div className="h-4 w-24 rounded bg-secondary animate-pulse" />
                        <div className="h-4 w-20 rounded bg-secondary animate-pulse ml-auto" />
                      </div>
                    ))}
                  </div>
                ) : isError ? (
                  <ErrorState message="No se pudieron cargar los partidos." onRetry={refetch} />
                ) : filtered.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No hay partidos registrados
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        {["Fase", "Pareja 1", "vs", "Pareja 2", "Pista", "Resultado", ""].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((match: MatchResult) => (
                        <tr key={match.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="text-xs text-muted-foreground">{phaseLabel(match.phase)}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-medium text-foreground">{match.team1.join(" / ")}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center text-xs text-muted-foreground">vs</td>
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-medium text-foreground">{match.team2.join(" / ")}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs text-muted-foreground">{match.court || "—"}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {match.isResult && match.sets1 && match.sets2 ? (
                              <div className="flex items-center gap-1.5">
                                <CheckCircle size={13} className="text-green-400" />
                                <span className="text-xs text-foreground font-mono">
                                  {match.sets1.map((s, i) => `${s}-${match.sets2![i]}`).join(", ")}
                                </span>
                              </div>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                                <Clock size={13} />
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => match.isResult ? setConfirmEdit(match) : setSelectedMatch(match)}
                              className={`text-xs font-medium transition-colors hover:underline ${
                                match.isResult ? "text-muted-foreground" : "text-[#D4AF37]"
                              }`}
                            >
                              {match.isResult ? "Editar" : "Introducir"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{filtered.length} partidos · página {page + 1} de {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 0}
                      className="p-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages - 1}
                      className="p-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm overwrite existing result */}
      <ConfirmModal
        open={!!confirmEdit}
        title="Editar resultado"
        description={`Este partido ya tiene resultado registrado. ¿Seguro que quieres sobreescribirlo?`}
        confirmLabel="Sí, editar"
        danger
        onConfirm={() => { if (confirmEdit) setSelectedMatch(confirmEdit); setConfirmEdit(null); }}
        onClose={() => setConfirmEdit(null)}
      />

      {/* Result modal */}
      {selectedMatch && (
        <ResultModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          saving={savingId === selectedMatch.id}
          onSave={(s1, s2) => {
            setSavingId(selectedMatch.id);
            saveResult.mutate({ id: selectedMatch.id, sets1: s1, sets2: s2 });
          }}
        />
      )}
    </>
  );
}
