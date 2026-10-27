"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import { ConfirmModal } from "@/components/admin/confirm-modal";

/**
 * Aviso de grupos bloqueados: con el cuadro de la categoría publicado, el
 * back rechaza mover parejas, reestructurar, añadir o borrar grupos y
 * regenerar (409 GROUPS_LOCKED). Para cambiarlos se oculta el cuadro (se
 * avisa a los inscritos), se edita y se vuelve a publicar desde Horarios o la
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
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<"hide" | "force" | null>(null);

  const hideMut = useMutation({
    mutationFn: () => adminService.schedule.unpublish(tournamentId, categoryId),
    onSuccess: () => {
      toast.success(`Cuadro de ${categoryLabel} oculto: ya puedes cambiar los grupos. Se ha avisado a los inscritos.`);
      setConfirm(null);
      onForcedChange(false);
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (err: Error) => {
      setConfirm(null);
      toast.error(err.message);
    },
  });

  if (!published) return null;

  if (forced) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-400/40 bg-red-400/5 px-4 py-3">
        <LockOpen size={16} className="text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 text-xs text-muted-foreground">
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
        description={`Los partidos de ${categoryLabel} dejan de verse con su hora en la app y se avisa a los inscritos de que el cuadro va a cambiar. Cuando acabes, vuelve a publicarlo (se les avisa otra vez).`}
        confirmLabel="Ocultar y avisar"
        loading={hideMut.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => hideMut.mutate()}
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
