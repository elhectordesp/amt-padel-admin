"use client";

import { useState } from "react";
import { Loader2, X, AlertTriangle } from "lucide-react";
import { phaseLabel } from "@/lib/constants";
import {
  DEFAULT_SCORING_FORMAT,
  SET_KIND,
  isScoringFormat,
  minSets,
  scoreHint,
  scoringFormatLabel,
  setKinds,
} from "@/lib/scoring-format";
import { matchScoreIssue } from "@/lib/utils/match-score";
import type { MatchResult } from "@/types";

type ResultMode = "score" | "walkover";

export function ResultModal({
  match,
  onClose,
  onSave,
  saving,
  isCorrection = false,
}: {
  match:        MatchResult;
  onClose:      () => void;
  onSave:       (
    sets1: number[],
    sets2: number[],
    opts?: { walkover?: boolean; walkoverWinnerTeam?: 1 | 2 },
  ) => void;
  saving:       boolean;
  isCorrection?: boolean;
}) {
  // Detectar si el partido EXISTENTE es walkover (al corregir) — preseleccionar tab.
  const initialMode: ResultMode = isCorrection && match.isWalkover ? "walkover" : "score";
  const initialWalkoverWinner: 1 | 2 | null =
    isCorrection && match.isWalkover && match.winner === "team2" ? 2 : null;

  const [mode, setMode] = useState<ResultMode>(initialMode);
  const [walkoverWinner, setWalkoverWinner] = useState<1 | 2 | null>(
    initialMode === "walkover" ? (initialWalkoverWinner ?? 1) : null,
  );

  // Las casillas de set que tiene el formato de este partido (el de su fase,
  // si la categoría la juega distinta): 1 en los de un set, 3 en los demás
  const format = isScoringFormat(match.scoringFormat) ? match.scoringFormat : DEFAULT_SCORING_FORMAT;
  const kinds  = setKinds(format);

  const initialSets: { a: string; b: string }[] = kinds.map((_, i) =>
    isCorrection && match.sets1 && match.sets2
      ? { a: String(match.sets1[i] ?? ""), b: String(match.sets2[i] ?? "") }
      : { a: "", b: "" },
  );

  const [sets, setSets] = useState<{ a: string; b: string }[]>(initialSets);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validSets = sets.filter((s) => s.a !== "" && s.b !== "");
  const canSaveScore = validSets.length >= minSets(format);
  const canSaveWalkover = walkoverWinner === 1 || walkoverWinner === 2;
  const canSave = mode === "score" ? canSaveScore : canSaveWalkover;

  const handleSave = () => {
    setValidationError(null);
    if (mode === "walkover") {
      if (!canSaveWalkover) {
        setValidationError("Selecciona la pareja ganadora del walkover");
        return;
      }
      // Backend genera sets [6,6] vs [0,0] automáticamente — enviamos arrays vacíos.
      onSave([], [], { walkover: true, walkoverWinnerTeam: walkoverWinner! });
      return;
    }
    // Lo mismo que valida el back al guardar, con el marcador esperado del formato
    const issue = matchScoreIssue(validSets.map((s) => ({ a: Number(s.a), b: Number(s.b) })), format);
    if (issue) {
      setValidationError(issue);
      return;
    }
    onSave(validSets.map((s) => Number(s.a)), validSets.map((s) => Number(s.b)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg text-foreground">{isCorrection ? "Corregir resultado" : "Introducir resultado"}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{phaseLabel(match.phase)} · {match.court ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

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

        {/* Toggle modo: score vs walkover */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-secondary/40 rounded-md">
          <button
            onClick={() => { setMode("score"); setValidationError(null); }}
            className={`py-1.5 text-xs font-medium rounded transition-colors ${
              mode === "score"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Resultado
          </button>
          <button
            onClick={() => { setMode("walkover"); setValidationError(null); }}
            className={`py-1.5 text-xs font-medium rounded transition-colors ${
              mode === "walkover"
                ? "bg-background text-amber-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle size={11} /> Walkover
            </span>
          </button>
        </div>

        {mode === "score" && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{kinds.length === 1 ? "Set" : "Sets"}</p>
            {/* Cómo se juega este partido y qué marcador vale: es lo que comprueba antes de guardar */}
            <p className="text-xs text-muted-foreground">
              Formato: <span className="text-foreground">{scoringFormatLabel(format)}</span>
              <br />
              Marcador válido: {scoreHint(format)}
            </p>
            {sets.map((set, i) => {
              const isSuperTb = kinds[i] === "superTb";
              const maxGames  = SET_KIND[kinds[i]].maxGames;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-12">Set {i + 1}</span>
                  <input
                    type="number" min={0} max={maxGames}
                    value={set.a}
                    onChange={(e) => { setValidationError(null); setSets((prev) => prev.map((s, idx) => idx === i ? { ...s, a: e.target.value } : s)); }}
                    placeholder="0"
                    aria-label={`Set ${i + 1} pareja 1`}
                    className="w-16 h-9 text-center rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="number" min={0} max={maxGames}
                    value={set.b}
                    onChange={(e) => { setValidationError(null); setSets((prev) => prev.map((s, idx) => idx === i ? { ...s, b: e.target.value } : s)); }}
                    placeholder="0"
                    aria-label={`Set ${i + 1} pareja 2`}
                    className="w-16 h-9 text-center rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                  {i === 2 && (
                    <span className="text-xs text-muted-foreground">{isSuperTb ? "supertb" : "(opcional)"}</span>
                  )}
                </div>
              );
            })}
            {validationError && <p className="text-xs text-red-500 pt-1">{validationError}</p>}
          </div>
        )}

        {mode === "walkover" && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle size={11} /> Walkover (W.O.)
              </p>
              <p>
                Marca la pareja que <strong>gana</strong>: la otra no se presentó.
                Gana con marcador <span className="font-mono">6-0 6-0</span> y el
                partido queda registrado como W.O. en el historial.
              </p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">¿Quién ganó?</p>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as const).map((team) => {
                const players = team === 1 ? match.team1 : match.team2;
                const isActive = walkoverWinner === team;
                return (
                  <button
                    key={team}
                    onClick={() => { setWalkoverWinner(team); setValidationError(null); }}
                    className={`p-3 rounded-md text-left transition-colors border ${
                      isActive
                        ? "bg-amber-500/10 border-amber-500 text-amber-200"
                        : "bg-secondary/30 border-border text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wide opacity-70">Gana pareja {team}</p>
                    <p className="text-xs font-semibold mt-1 truncate">{players.join(" / ")}</p>
                  </button>
                );
              })}
            </div>
            {validationError && <p className="text-xs text-red-500 pt-1">{validationError}</p>}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`flex-1 py-2 rounded-md text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 transition-colors ${
              mode === "walkover"
                ? "bg-amber-500 text-[#0C0C0C] hover:bg-amber-400"
                : "bg-[#D4AF37] text-[#0C0C0C] hover:bg-[#C49F2A]"
            }`}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {mode === "walkover"
              ? (isCorrection ? "Guardar W.O. corregido" : "Registrar walkover")
              : (isCorrection ? "Guardar corrección" : "Guardar resultado")}
          </button>
        </div>
      </div>
    </div>
  );
}
