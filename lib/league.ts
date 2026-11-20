import { usePathname } from "next/navigation";
import type { TournamentKind } from "@/types";

/** Las rutas de las ligas cuelgan de `/ligas`; las de los torneos, de `/torneos`. */
export function isLeaguePath(pathname: string | null | undefined): boolean {
  return pathname === "/ligas" || !!pathname?.startsWith("/ligas/");
}

/** Raíz de las pantallas de un tipo: a donde vuelven los enlaces y las redirecciones. */
export function tournamentsBase(kind: TournamentKind | undefined): "/ligas" | "/torneos" {
  return kind === "LEAGUE" ? "/ligas" : "/torneos";
}

/** Palabra del tipo en los textos («torneo» o «liga»). */
export function kindWord(kind: TournamentKind | undefined): "torneo" | "liga" {
  return kind === "LEAGUE" ? "liga" : "torneo";
}

/**
 * Las pantallas de torneos y de ligas son las mismas: la ruta decide el tipo
 * (`/ligas/...` es una liga). La ficha, en cambio, lo lee del propio torneo.
 */
export function useRouteKind(): TournamentKind {
  return isLeaguePath(usePathname()) ? "LEAGUE" : "TOURNAMENT";
}
