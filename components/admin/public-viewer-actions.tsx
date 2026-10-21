"use client";

import Link from "next/link";
import { Copy, Tv2 } from "lucide-react";

const DRAFT_HINT = "Publica el torneo para compartirlo";

const BUTTON =
  "flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-md border border-border text-sm text-muted-foreground transition-colors";
const ENABLED = "hover:text-[#D4AF37] hover:border-[rgba(212,175,55,0.4)]";
const DISABLED = "opacity-50 cursor-not-allowed";

/**
 * «Widget TV» y «Visor público» del detalle del torneo. Un borrador no se ve
 * fuera del panel (la API responde 404 en el visor), así que mientras lo es
 * salen desactivados y explican por qué.
 */
export function PublicViewerActions({
  tournamentId,
  isDraft,
  onShare,
}: {
  tournamentId: string;
  isDraft: boolean;
  onShare: () => void;
}) {
  if (isDraft) {
    return (
      <>
        <span
          role="link"
          aria-disabled="true"
          aria-label="Widget TV (publica el torneo para compartirlo)"
          title={DRAFT_HINT}
          className={`${BUTTON} ${DISABLED}`}
        >
          <Tv2 size={14} />
          <span className="hidden sm:inline">Widget TV</span>
        </span>
        <button
          type="button"
          disabled
          aria-label="Compartir visor público (publica el torneo para compartirlo)"
          title={DRAFT_HINT}
          className={`${BUTTON} ${DISABLED}`}
        >
          <Copy size={14} />
          <span className="hidden sm:inline">Visor público</span>
        </button>
      </>
    );
  }

  return (
    <>
      <Link
        href={`/torneo/${tournamentId}/live`}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir widget de resultados en vivo (para TV o pantalla grande)"
        aria-label="Widget TV"
        className={`${BUTTON} ${ENABLED}`}
      >
        <Tv2 size={14} />
        <span className="hidden sm:inline">Widget TV</span>
      </Link>
      <button
        type="button"
        onClick={onShare}
        title="Compartir el visor público (QR y enlace) para jugadores y espectadores, sin login"
        aria-label="Compartir visor público"
        className={`${BUTTON} ${ENABLED}`}
      >
        <Copy size={14} />
        <span className="hidden sm:inline">Visor público</span>
      </button>
    </>
  );
}
