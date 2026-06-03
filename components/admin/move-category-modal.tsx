"use client";

import { useState } from "react";
import { Loader2, X, ArrowRight } from "lucide-react";
import type { AdminRegistration } from "@/types";

const GENDER_LABEL: Record<string, string> = { M: "Masc.", F: "Fem." };
const LEVEL_LABEL:  Record<string, string>  = {
  "1a": "1ª", "2a": "2ª", "3a": "3ª", "4a": "4ª",
  "5a": "5ª", "6a": "6ª", "iniciacion": "Inic.",
};

interface Category {
  id:     string;
  gender: string;
  level:  string;
}

interface PairRegistration {
  ids:     string[];
  primary: AdminRegistration;
}

export function MoveCategoryModal({
  pair,
  categories,
  saving,
  onSave,
  onClose,
}: {
  pair:       PairRegistration;
  categories: Category[];
  saving:     boolean;
  onSave:     (newCategoryId: string) => void;
  onClose:    () => void;
}) {
  const [selected, setSelected] = useState("");

  const current = pair.primary.category;
  const hasPartner = !!pair.primary.partner;

  const options = categories.filter(
    (c) => c.id !== pair.primary.categoryId,
  );

  const canSave = !!selected && !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base text-foreground">Cambiar categoría</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Player info */}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{pair.primary.user.name}</p>
          {hasPartner && (
            <p className="text-xs text-muted-foreground">con {pair.primary.partner!.name}</p>
          )}
        </div>

        {/* Current → destination */}
        <div className="flex items-center gap-3">
          <div className="flex-1 px-3 py-2 rounded-md bg-secondary/50 border border-border text-xs text-muted-foreground text-center">
            {GENDER_LABEL[current.gender] ?? current.gender} {LEVEL_LABEL[current.level] ?? current.level}
          </div>
          <ArrowRight size={14} className="text-muted-foreground shrink-0" />
          <div className="flex-1">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full h-9 px-2 rounded-md bg-secondary border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
            >
              <option value="">Seleccionar...</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {GENDER_LABEL[c.gender] ?? c.gender} {LEVEL_LABEL[c.level] ?? c.level}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Partner warning */}
        {hasPartner && (
          <p className="text-[11px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-md px-3 py-2">
            La pareja ({pair.primary.partner!.name}) también será movida a la categoría destino.
          </p>
        )}

        {/* Availability notice */}
        <p className="text-[11px] text-muted-foreground">
          Los horarios de disponibilidad se borrarán — el jugador deberá volver a indicarlos en la nueva categoría.
        </p>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => canSave && onSave(selected)}
            disabled={!canSave}
            className="flex-1 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Mover
          </button>
        </div>
      </div>
    </div>
  );
}
