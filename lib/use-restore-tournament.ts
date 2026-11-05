"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import { toastGenderConflicts } from "@/lib/gender-conflicts";

/**
 * Restaurar un torneo borrado (solo AMT, D12): desde «Eliminados» de Torneos
 * y desde el «Deshacer» del aviso tras borrarlo. Los avisos y la recarga van
 * en las opciones de la mutación y no en las de `mutate`: el «Deshacer» se
 * pulsa con la ficha ya cerrada (tras borrar se vuelve a Torneos) y así se
 * ejecutan igual. Si al restaurarlo alguna inscripción ya no encaja por
 * género (AMT pudo cambiárselo a sus jugadores mientras estaba borrado), un
 * segundo aviso dice cuáles y qué hacer, como la ficha del jugador.
 */
export function useRestoreTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.tournaments.restore(id),
    onSuccess: (res) => {
      // Vuelve al listado de torneos y sale de los eliminados
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Torneo restaurado");
      toastGenderConflicts(res.genderConflicts, "restore");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo restaurar el torneo"),
  });
}
