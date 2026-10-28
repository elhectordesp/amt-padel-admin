import { ApiError } from "@/lib/api";

/**
 * El back rechaza con 409 GROUPS_LOCKED cambiar los grupos o los partidos de
 * grupos de una categoría con el cuadro publicado. El panel no lo enseña como
 * un error más: ofrece ocultar el cuadro (avisa a los inscritos) o forzar el
 * cambio, como `needsForce` con las categorías llenas.
 */
export function isGroupsLocked(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === "GROUPS_LOCKED";
}
