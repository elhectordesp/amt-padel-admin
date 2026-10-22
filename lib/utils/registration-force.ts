import { ApiError } from "@/lib/api";

/**
 * Códigos con los que el back pide confirmar un cambio de estado que mete
 * parejas en una categoría llena (CATEGORY_FULL) o por delante de la lista de
 * espera (CATEGORY_WAITLIST_AHEAD). El panel pregunta «Forzar» y lo repite con
 * `force`, como el alta manual.
 */
const NEEDS_FORCE = new Set(["CATEGORY_FULL", "CATEGORY_WAITLIST_AHEAD"]);

export function needsForce(err: unknown): err is ApiError {
  return err instanceof ApiError && !!err.code && NEEDS_FORCE.has(err.code);
}
