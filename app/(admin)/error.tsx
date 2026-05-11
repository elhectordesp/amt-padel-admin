"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Admin Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-5">
      <div className="p-5 rounded-full bg-destructive/10 border border-destructive/20">
        <AlertTriangle size={36} className="text-destructive" />
      </div>
      <div>
        <h2 className="font-heading text-xl text-foreground">Algo salió mal</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          {error.message || "Ha ocurrido un error inesperado en esta sección."}
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-5 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors"
      >
        <RefreshCw size={14} />
        Intentar de nuevo
      </button>
    </div>
  );
}
