"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  open:        boolean;
  title:       string;
  description: string;
  confirmLabel?: string;
  /** Texto del botón que cierra sin hacer nada (por defecto, «Cancelar»). */
  cancelLabel?: string;
  danger?:     boolean;
  onClose:     () => void;
  onConfirm:   () => void;
  loading?:    boolean;
  /** Mantiene el botón de confirmar apagado (p. ej. hasta que se teclee la palabra de seguridad). */
  confirmDisabled?: boolean;
  /** Contenido extra entre la descripción y los botones (p. ej. un campo de motivo). */
  children?:   React.ReactNode;
}

export function ConfirmModal({
  open, title, description, confirmLabel = "Confirmar", cancelLabel = "Cancelar",
  danger = false, onClose, onConfirm, loading, confirmDisabled, children,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Siempre la última: el listener de Escape no se vuelve a montar en cada render
  const closeRef = useRef(() => {});
  useEffect(() => {
    closeRef.current = () => { if (!loading) onClose(); };
  });

  // Al abrir, el foco pasa al diálogo; al cerrar, vuelve a lo que lo abrió
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4 outline-none"
      >
        <div className="flex items-center justify-between">
          <div className={`p-2.5 rounded-full border ${danger ? "bg-destructive/10 border-destructive/20" : "bg-[rgba(212,175,55,0.1)] border-[rgba(212,175,55,0.3)]"}`}>
            <AlertTriangle size={18} className={danger ? "text-destructive" : "text-[#D4AF37]"} />
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={15} />
          </button>
        </div>
        <div>
          <h3 id={titleId} className="font-heading text-lg text-foreground">{title}</h3>
          <p id={descriptionId} className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        {children}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
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
