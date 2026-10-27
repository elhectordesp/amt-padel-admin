"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Lock, LockOpen, X } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import { ConfirmModal } from "@/components/admin/confirm-modal";

/** «Ocultar cuadro»: despublica la categoría (el back avisa a los inscritos) y desbloquea sus grupos. */
function useHideDraw(tournamentId: string, categoryLabel: string, onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => adminService.schedule.unpublish(tournamentId, categoryId),
    onSuccess: () => {
      toast.success(`Cuadro de ${categoryLabel} oculto: ya puedes cambiar los grupos. Se ha avisado a los inscritos.`);
      onDone();
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (err: Error) => {
      onDone();
      toast.error(err.message);
    },
  });
}

const hideDescription = (categoryLabel: string) =>
  `Los partidos de ${categoryLabel} dejan de verse con su hora en la app y se avisa a los inscritos de que el cuadro va a cambiar. Cuando acabes, vuelve a publicarlo (se les avisa otra vez).`;

/**
 * Aviso de grupos bloqueados: con el cuadro de la categoría publicado, el
 * back rechaza mover parejas, reestructurar, añadir o borrar grupos,
 * regenerar y cambiar, crear o borrar partidos de grupos (409
 * GROUPS_LOCKED). Para cambiarlos se oculta el cuadro (se avisa a los
 * inscritos), se edita y se vuelve a publicar desde Horarios o la
 * preparación. «Forzar» deja editar sin ocultarlo (las peticiones llevan
 * forceLocked); no avisa a nadie.
 */
export function GroupsLockBanner({
  tournamentId,
  categoryId,
  categoryLabel,
  published,
  forced,
  onForcedChange,
}: {
  tournamentId: string;
  categoryId: string;
  categoryLabel: string;
  /** Cuadro publicado: horario publicado y con partidos. */
  published: boolean;
  forced: boolean;
  onForcedChange: (forced: boolean) => void;
}) {
  const [confirm, setConfirm] = useState<"hide" | "force" | null>(null);
  const hideMut = useHideDraw(tournamentId, categoryLabel, () => {
    setConfirm(null);
    onForcedChange(false);
  });

  if (!published) return null;

  if (forced) {
    return (
      <div className="flex items-start gap-3 flex-wrap rounded-lg border border-red-400/40 bg-red-400/5 px-4 py-3">
        <LockOpen size={16} className="text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[220px] text-xs text-muted-foreground">
          <p className="text-sm font-semibold text-red-400">Edición forzada</p>
          Los cambios en los grupos de {categoryLabel} se aplican sobre el cuadro publicado y no se avisa a los inscritos.
        </div>
        <button
          onClick={() => onForcedChange(false)}
          className="shrink-0 text-xs font-medium rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-secondary"
        >
          Volver a bloquear
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 flex-wrap rounded-lg border border-amber-400/40 bg-amber-400/5 px-4 py-3">
      <Lock size={16} className="text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-[220px] text-xs text-muted-foreground">
        <p className="text-sm font-semibold text-amber-400">Grupos bloqueados</p>
        El cuadro de {categoryLabel} está publicado y los inscritos ya tienen sus partidos. Para cambiar los grupos, oculta el cuadro (se les avisa), haz los cambios y vuelve a publicarlo.
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setConfirm("hide")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-md bg-[#D4AF37] text-[#0C0C0C] px-3 py-1.5 hover:bg-[#C49F2A]"
        >
          <EyeOff size={12} /> Ocultar cuadro
        </button>
        <button
          onClick={() => setConfirm("force")}
          className="text-xs font-medium rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          Forzar
        </button>
      </div>

      <ConfirmModal
        open={confirm === "hide"}
        title="Ocultar cuadro"
        description={hideDescription(categoryLabel)}
        confirmLabel="Ocultar y avisar"
        loading={hideMut.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => hideMut.mutate(categoryId)}
      />
      <ConfirmModal
        open={confirm === "force"}
        title="Forzar la edición de los grupos"
        description={`Podrás cambiar los grupos de ${categoryLabel} con el cuadro publicado, sin avisar a los inscritos: verán los cambios sin saber que los ha habido. Úsalo solo para corregir un error puntual.`}
        confirmLabel="Forzar"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); onForcedChange(true); }}
      />
    </div>
  );
}

/**
 * Un cambio rechazado porque el cuadro de la categoría está publicado (409
 * GROUPS_LOCKED), o una acción que lo rehace pedida con el cuadro publicado:
 * se explica y se ofrece ocultar el cuadro (avisa a los inscritos y
 * desbloquea) o forzar el cambio sin avisar. Sin categoría no se muestra.
 */
export function GroupsLockedPrompt({
  tournamentId,
  categoryId,
  categoryLabel,
  onClose,
  onForce,
}: {
  tournamentId: string;
  categoryId: string | null;
  categoryLabel: string;
  onClose: () => void;
  /** Forzar: repetir el cambio con forceLocked o dejar la edición forzada. */
  onForce: () => void;
}) {
  const hideMut = useHideDraw(tournamentId, categoryLabel, onClose);
  if (!categoryId) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="groups-locked-title"
        className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="p-2.5 rounded-full border bg-amber-400/10 border-amber-400/30">
            <Lock size={18} className="text-amber-400" />
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={15} />
          </button>
        </div>
        <div>
          <h3 id="groups-locked-title" className="font-heading text-lg text-foreground">Grupos bloqueados</h3>
          <p className="text-sm text-muted-foreground mt-1">
            El cuadro de {categoryLabel} está publicado y los inscritos ya tienen sus partidos. {hideDescription(categoryLabel)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            «Forzar» hace el cambio sobre el cuadro publicado sin avisar a nadie: úsalo solo para corregir un error puntual.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <button
            onClick={onForce}
            className="flex-1 py-2 rounded-md border border-destructive/50 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
          >
            Forzar
          </button>
          <button
            onClick={() => hideMut.mutate(categoryId)}
            disabled={hideMut.isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold bg-[#D4AF37] text-[#0C0C0C] hover:bg-[#C49F2A] disabled:opacity-60 transition-colors"
          >
            <EyeOff size={14} /> {hideMut.isPending ? "..." : "Ocultar cuadro"}
          </button>
        </div>
      </div>
    </div>
  );
}
