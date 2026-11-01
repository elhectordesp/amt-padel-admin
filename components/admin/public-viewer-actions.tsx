"use client";

import { useId, type KeyboardEvent } from "react";
import { Share2, Tv2 } from "lucide-react";
import { toast } from "sonner";

const DRAFT_HINT = "Publica el torneo para compartirlo";

const BUTTON =
  "flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-md border border-border text-sm text-muted-foreground transition-colors";
const ENABLED = "hover:text-[#D4AF37] hover:border-[rgba(212,175,55,0.4)]";
const DISABLED = "opacity-50 cursor-not-allowed";

/**
 * «Widget TV» y «Visor público» del detalle del torneo. Un borrador no se ve
 * fuera del panel (la API responde 404 en el visor): mientras lo es, los dos
 * salen desactivados y el motivo se ve sin pasar el ratón (texto visible) y
 * al tocarlos o activarlos con el teclado (aviso). Siguen siendo enfocables
 * (aria-disabled, no disabled) para que el teclado llegue a ellos.
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
  const hintId = useId();
  const explain = () => toast.info(DRAFT_HINT);
  // En el enlace del widget, sin href, Enter no hace nada por sí solo
  const explainOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      explain();
    }
  };
  const state = isDraft ? DISABLED : ENABLED;

  return (
    <>
      {/* Un <a> (no Link): sin href mientras es un borrador */}
      <a
        href={isDraft ? undefined : `/torneo/${tournamentId}/live`}
        target="_blank"
        rel="noopener noreferrer"
        // Sin href, un <a> no es enlace ni enfocable: se le devuelve
        role={isDraft ? "link" : undefined}
        tabIndex={isDraft ? 0 : undefined}
        aria-label="Widget TV"
        aria-disabled={isDraft || undefined}
        aria-describedby={isDraft ? hintId : undefined}
        title={isDraft ? DRAFT_HINT : "Abrir widget de resultados en vivo (para TV o pantalla grande)"}
        onClick={isDraft ? explain : undefined}
        onKeyDown={isDraft ? explainOnEnter : undefined}
        className={`${BUTTON} ${state}`}
      >
        <Tv2 size={14} />
        <span className="hidden sm:inline">Widget TV</span>
      </a>
      <button
        type="button"
        aria-label="Compartir visor público"
        aria-disabled={isDraft || undefined}
        aria-describedby={isDraft ? hintId : undefined}
        title={isDraft ? DRAFT_HINT : "Compartir el visor público (QR y enlace) para jugadores y espectadores, sin login"}
        onClick={isDraft ? explain : onShare}
        className={`${BUTTON} ${state}`}
      >
        {/* Compartir, no Copy: en el móvil, sin texto, era el mismo icono que «Duplicar torneo» */}
        <Share2 size={14} />
        <span className="hidden sm:inline">Visor público</span>
      </button>
      {isDraft && (
        <span id={hintId} className="basis-full sm:basis-auto text-[11px] leading-tight text-muted-foreground">
          {DRAFT_HINT}
        </span>
      )}
    </>
  );
}
