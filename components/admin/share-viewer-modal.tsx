"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, ExternalLink, X, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * Pantalla de "Compartir visor público": QR + enlace + copiar.
 * El visor (/torneo/:id) es público (sin login) para jugadores y espectadores.
 */
export function ShareViewerModal({
  open,
  onClose,
  tournamentId,
  tournamentName,
}: {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName?: string;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(`${window.location.origin}/torneo/${tournamentId}`);
    }
  }, [tournamentId]);

  if (!open) return null;

  const copy = () => {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        toast.success("Enlace copiado");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("No se pudo copiar"),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Compartir visor público</h2>
            <p className="text-xs text-muted-foreground">Sin cuenta · para jugadores y espectadores</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          {tournamentName && <p className="text-sm font-medium text-foreground text-center">{tournamentName}</p>}

          {/* QR */}
          <div className="bg-white p-3 rounded-xl">
            {url ? (
              <QRCodeSVG value={url} size={196} bgColor="#ffffff" fgColor="#0C0C0C" level="M" />
            ) : (
              <div className="w-[196px] h-[196px] animate-pulse bg-zinc-200 rounded" />
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">Escanea el código o comparte el enlace</p>

          {/* Enlace + copiar */}
          <div className="w-full flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground font-mono truncate"
            />
            <button
              onClick={copy}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-[#D4AF37] text-[#0C0C0C] px-3 py-2 text-xs font-semibold hover:bg-[#C49F2A] transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          <a
            href={url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#D4AF37] transition-colors"
          >
            <ExternalLink size={13} /> Abrir en una pestaña nueva
          </a>
        </div>
      </div>
    </div>
  );
}
