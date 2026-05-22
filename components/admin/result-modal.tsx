"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { phaseLabel } from "@/lib/constants";
import type { MatchResult } from "@/types";

export function ResultModal({
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
    onSave(validSets.map((s) => Number(s.a)), validSets.map((s) => Number(s.b)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg text-foreground">Introducir resultado</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{phaseLabel(match.phase)} · {match.court ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
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
                  className="w-16 h-9 text-center rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="number" min={0} max={isSuperTb ? 99 : 7}
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
          {validationError && <p className="text-xs text-red-500 pt-1">{validationError}</p>}
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
