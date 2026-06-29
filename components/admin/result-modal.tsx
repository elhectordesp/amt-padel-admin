"use client";

import { useState } from "react";
import { Loader2, X, AlertTriangle } from "lucide-react";
import { phaseLabel } from "@/lib/constants";
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
  const initialMode: ResultMode = isCorrection && (match as any).isWalkover ? "walkover" : "score";
  const initialWalkoverWinner: 1 | 2 | null =
    isCorrection && (match as any).isWalkover && (match as any).winner === "team2" ? 2 : null;

  const [mode, setMode] = useState<ResultMode>(initialMode);
  const [walkoverWinner, setWalkoverWinner] = useState<1 | 2 | null>(
    initialMode === "walkover" ? (initialWalkoverWinner ?? 1) : null,
  );

  const initialSets: { a: string; b: string }[] = isCorrection && match.sets1 && match.sets2
    ? [
        { a: String(match.sets1[0] ?? ""), b: String(match.sets2[0] ?? "") },
        { a: String(match.sets1[1] ?? ""), b: String(match.sets2[1] ?? "") },
        { a: String(match.sets1[2] ?? ""), b: String(match.sets2[2] ?? "") },
      ]
    : [{ a: "", b: "" }, { a: "", b: "" }, { a: "", b: "" }];

  const [sets, setSets] = useState<{ a: string; b: string }[]>(initialSets);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validSets = sets.filter((s) => s.a !== "" && s.b !== "");
  const canSaveScore = validSets.length >= 2;
  const canSaveWalkover = walkoverWinner === 1 || walkoverWinner === 2;
  const canSave = mode === "score" ? canSaveScore : canSaveWalkover;

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
    if (mode === "walkover") {
      if (!canSaveWalkover) {
        setValidationError("Selecciona la pareja ganadora del walkover");
        return;
      }
      // Backend genera sets [6,6] vs [0,0] automáticamente — enviamos arrays vacíos.
      onSave([], [], { walkover: true, walkoverWinnerTeam: walkoverWinner! });
      return;
    }
    for (let i = 0; i < validSets.length; i++) {
      const a = Number(validSets[i].a), b = Number(validSets[i].b);
      const setNum = i + 1;
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
        setValidationError(`Set ${setNum}: los valores deben ser números enteros no negativos`);
        return;
      }
      if (a === b) { setValidationError(`Set ${setNum}: no puede haber empate`); return; }
      const isSuperTb = match.scoringFormat === "BEST_OF_2_SUPERTB" && setNum === 3;
      const valid = isSuperTb ? isValidSuperTiebreak(a, b) : isValidNormalSet(a, b);
      if (!valid) {
        const hint = isSuperTb ? "supertiebreak: primero a 10 con dif. de 2 (ej: 10-8)" : "set normal: 6-x, 7-5 o 7-6";
        setValidationError(`Set ${setNum}: resultado inválido (${a}-${b}). Formato: ${hint}`);
        return;
      }
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sets</p>
            {sets.map((set, i) => {
              const isSuperTb = match.scoringFormat === "BEST_OF_2_SUPERTB" && i === 2;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-12">Set {i + 1}</span>
                  <input
                    type="number" min={0} max={isSuperTb ? 99 : 7}
                    value={set.a}
                    onChange={(e) => { setValidationError(null); setSets((prev) => prev.map((s, idx) => idx === i ? { ...s, a: e.target.value } : s)); }}
                    placeholder="0"
                    aria-label={`Set ${i + 1} pareja 1`}
                    className="w-16 h-9 text-center rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="number" min={0} max={isSuperTb ? 99 : 7}
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
                Marca cuál de las 2 parejas <strong>no se presentó</strong>. La otra
                gana automáticamente con marcador <span className="font-mono">6-0 6-0</span>.
                El partido queda registrado como W.O. en el historial.
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
