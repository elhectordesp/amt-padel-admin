"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";

/**
 * Marco de los diálogos de la escuela: capa oscura, título y cierre con
 * Escape o fuera del diálogo (salvo mientras guarda).
 */
export function SchoolDialog({
  title,
  onClose,
  busy = false,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-md"} space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6`}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 id={titleId} className="font-heading text-base">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const schoolInputCls = "rounded border border-border bg-background px-2 py-1.5 text-sm";
