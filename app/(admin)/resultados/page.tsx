"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, Search, CheckCircle, Clock, X, Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { downloadCsv } from "@/lib/utils/csv";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { ErrorState } from "@/components/admin/error-state";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { adminService } from "@/lib/services/admin";
import type { MatchResult, Tournament } from "@/types";

const PAGE_SIZE = 30;

// ── Result Entry Modal ────────────────────────────────────────────────────
function ResultModal({
  match,
  onClose,
  onSave,
  saving,
}: {
  match:   MatchResult;
  onClose: () => void;
  onSave:  (sets1: number[], sets2: number[]) => void;
  saving:  boolean;
}) {
  const [sets, setSets] = useState<{ a: string; b: string }[]>([
    { a: "", b: "" },
    { a: "", b: "" },
    { a: "", b: "" },
  ]);

  const [validationError, setValidationError] = useState<string | null>(null);

  const validSets = sets.filter((s) => s.a !== "" && s.b !== "");
  const canSave   = validSets.length >= 2;

  function isValidNormalSet(a: number, b: number) {
    const max = Math.max(a, b), min = Math.min(a, b);
    return (max === 6 && min <= 4) || (max === 7 && min === 5) || (max === 7 && min === 6);
  }
  function isValidSuperTiebreak(a: number, b: number) {
    const max = Math.max(a, b), min = Math.min(a, b);
    return max >= 10 && max - min >= 2;
  }

  const handleSave = () => {
    setValidationError(null);
    for (let i = 0; i < validSets.length; i++) {
      const a = Number(validSets[i].a), b = Number(validSets[i].b);
      const setNum = i + 1;
      if (a === b) { setValidationError(`Set ${setNum}: no puede haber empate`); return; }
      const isSuperTb = match.scoringFormat === "BEST_OF_2_SUPERTB" && setNum === 3;
      const valid = isSuperTb ? isValidSuperTiebreak(a, b) : isValidNormalSet(a, b);
      if (!valid) {
        const hint = isSuperTb ? "supertiebreak: primero a 10 con dif. de 2 (ej: 10-8)" : "set normal: 6-x, 7-5 o 7-6";
        setValidationError(`Set ${setNum}: resultado inválido (${a}-${b}). Formato: ${hint}`);
        return;
      }
    }
    const s1 = validSets.map((s) => Number(s.a));
    const s2 = validSets.map((s) => Number(s.b));
    onSave(s1, s2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg text-foreground">Introducir resultado</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{match.phase} · {match.court}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-4">
          <div className="text-center flex-1">
            <p className="text-sm font-semibold text-foreground">{match.team1.join(" / ")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pareja 1</p>
          </div>
          <span className="text-muted-foreground font-bold">VS</span>
          <div className="text-center flex-1">
            <p className="text-sm font-semibold text-foreground">{match.team2.join(" / ")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pareja 2</p>
          </div>
        </div>

        {/* Sets input */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sets</p>
          {sets.map((set, i) => {
            const isSuperTb = match.scoringFormat === "BEST_OF_2_SUPERTB" && i === 2;
            return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12">Set {i + 1}</span>
              <input
                type="number"
                min={0} max={isSuperTb ? 99 : 7}
                value={set.a}
                onChange={(e) => { setValidationError(null); setSets((prev) => prev.map((s, idx) => idx === i ? { ...s, a: e.target.value } : s)); }}
                placeholder="0"
                className="w-16 h-9 text-center rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="number"
                min={0} max={isSuperTb ? 99 : 7}
                value={set.b}
                onChange={(e) => { setValidationError(null); setSets((prev) => prev.map((s, idx) => idx === i ? { ...s, b: e.target.value } : s)); }}
                placeholder="0"
                className="w-16 h-9 text-center rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              {i === 2 && (
                <span className="text-xs text-muted-foreground">{isSuperTb ? "supertb" : "(opcional)"}</span>
              )}
            </div>
            );
          })}
          {validationError && (
            <p className="text-xs text-red-500 pt-1">{validationError}</p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar resultado
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const ongoingTournaments = tournaments.filter((t: Tournament) => t.status === "ONGOING" || t.status === "OPEN");

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
                      Fase:       m.phase,
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
                            <span className="text-xs text-muted-foreground">{match.phase}</span>
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
