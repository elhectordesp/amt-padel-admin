"use client";

import { useState } from "react";
import { isGroupsLocked } from "@/lib/utils/groups-lock";

/**
 * El diálogo de «Grupos bloqueados» (GroupsLockedPrompt) de una petición
 * rechazada con el cuadro publicado (409 GROUPS_LOCKED), o de una acción que
 * lo rehace pedida con el cuadro publicado. Su «Forzar» repite ESA petición
 * una sola vez con forceLocked: no deja nada forzado. La edición forzada que
 * dura (varios cambios seguidos) es solo la del aviso de la pestaña Cuadro,
 * que se ve mientras está activa.
 */
export function useGroupsLockedPrompt() {
  const [pending, setPending] = useState<{ categoryId: string; retryForced: () => void } | null>(null);
  return {
    /** La categoría del diálogo abierto (null: cerrado). */
    categoryId: pending?.categoryId ?? null,
    /**
     * Si el error es el 409 GROUPS_LOCKED, abre el diálogo con cómo repetir
     * la petición forzando y devuelve true (el error ya está atendido).
     */
    onError: (err: unknown, categoryId: string, retryForced: () => void) => {
      if (!isGroupsLocked(err)) return false;
      setPending({ categoryId, retryForced });
      return true;
    },
    /** Abrirlo sin error previo: la acción aún no se ha pedido. */
    open: (categoryId: string, retryForced: () => void) => setPending({ categoryId, retryForced }),
    close: () => setPending(null),
    /** «Forzar»: repite la petición una vez con forceLocked y cierra. */
    force: () => {
      pending?.retryForced();
      setPending(null);
    },
  };
}
