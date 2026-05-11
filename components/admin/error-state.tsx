"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?:   string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title   = "Error al cargar los datos",
  message = "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
      <div className="p-4 rounded-full bg-destructive/10 border border-destructive/20">
        <AlertTriangle size={28} className="text-destructive" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw size={13} />
          Reintentar
        </button>
      )}
    </div>
  );
}
