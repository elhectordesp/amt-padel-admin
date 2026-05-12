"use client";

import { AlertTriangle, X } from "lucide-react";

interface Props {
  open:        boolean;
  title:       string;
  description: string;
  confirmLabel?: string;
  danger?:     boolean;
  onClose:     () => void;
  onConfirm:   () => void;
  loading?:    boolean;
}

export function ConfirmModal({
  open, title, description, confirmLabel = "Confirmar",
  danger = false, onClose, onConfirm, loading,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className={`p-2.5 rounded-full border ${danger ? "bg-destructive/10 border-destructive/20" : "bg-[rgba(212,175,55,0.1)] border-[rgba(212,175,55,0.3)]"}`}>
            <AlertTriangle size={18} className={danger ? "text-destructive" : "text-[#D4AF37]"} />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={15} />
          </button>
        </div>
        <div>
          <h3 className="font-heading text-lg text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2 rounded-md text-sm font-semibold disabled:opacity-60 transition-colors ${
              danger ? "bg-destructive text-white hover:bg-destructive/80" : "bg-[#D4AF37] text-[#0C0C0C] hover:bg-[#C49F2A]"
            }`}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
