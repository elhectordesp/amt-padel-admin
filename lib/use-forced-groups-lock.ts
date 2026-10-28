"use client";

import { useState } from "react";

/**
 * «Forzar» el bloqueo de los grupos de una categoría con el cuadro publicado:
 * mientras vale, las peticiones de grupos de esa categoría llevan
 * `forceLocked`. Vale solo para esa categoría y esa publicación: se pierde al
 * cambiar de categoría en el cuadro (cambia `viewKey`) y cuando el cuadro se
 * oculta o se vuelve a publicar (cambia su `schedulePublishedAt`). Entonces
 * hay que confirmarlo otra vez.
 */
export function useForcedGroupsLock(
  publishedAtOf: (categoryId: string) => string | null | undefined,
  viewKey: string,
) {
  const [forced, setForced] = useState<{ categoryId: string; publishedAt: string } | null>(null);
  // Cambiar de categoría lo quita (se ajusta al renderizar, sin efecto)
  const [seenViewKey, setSeenViewKey] = useState(viewKey);
  if (seenViewKey !== viewKey) {
    setSeenViewKey(viewKey);
    setForced(null);
  }

  const isForced = (categoryId: string) =>
    !!forced && forced.categoryId === categoryId && forced.publishedAt === publishedAtOf(categoryId);

  return {
    isForced,
    /** Solo con el cuadro publicado: sin publicar no hay nada que forzar. */
    force: (categoryId: string) => {
      const publishedAt = publishedAtOf(categoryId);
      setForced(publishedAt ? { categoryId, publishedAt } : null);
    },
    release: () => setForced(null),
  };
}
