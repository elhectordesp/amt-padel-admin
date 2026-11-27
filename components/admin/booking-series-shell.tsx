"use client";

/**
 * El marco de los diálogos de una reserva fija (ver, ampliar, resultado de
 * terminar): fondo que oscurece, cabecera con su cierre, cuerpo que se desplaza
 * y pie de botones fijo. Se cierra con Escape y pulsando fuera, salvo mientras
 * trabaja (`busy`).
 */

import { useEffect, useId, useRef } from "react";
import { Repeat, X } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Mientras guarda, no se cierra ni con Escape ni pulsando fuera. */
  busy?: boolean;
  /** Más ancho, para una lista. */
  wide?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function SeriesDialogShell({ title, subtitle, onClose, busy = false, wide = false, footer, children }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Siempre lo último: el oyente de Escape no se vuelve a montar en cada pintado
  const closeRef = useRef(() => {});
  useEffect(() => {
    closeRef.current = () => {
      if (!busy) onClose();
    };
  });

  // Al abrir, el foco pasa al diálogo; al cerrar, vuelve a lo que lo abrió
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => closeRef.current()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[90vh] w-full flex-col rounded-xl border border-border bg-card shadow-2xl outline-none ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-[#D4AF37]" aria-hidden />
            <div>
              <h2 id={titleId} className="text-sm font-semibold text-foreground">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => closeRef.current()}
            disabled={busy}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary max-[1024px]:p-3"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
