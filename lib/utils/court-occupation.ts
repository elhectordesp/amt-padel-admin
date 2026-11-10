/**
 * Qué ocupa una pista además de las reservas (bloqueos del club y partidos de
 * torneo): nombre, color y orden de cada tipo. Lo usan el calendario (Día y
 * Semana, con su leyenda) y el formulario de bloqueos.
 */

import type { CourtBlockKind } from "@/types";

export interface OccupationKindInfo {
  value: CourtBlockKind;
  label: string;
  /** Fondo y texto del bloque en el calendario. */
  className: string;
  /** Cuadradito de la leyenda. */
  swatch: string;
}

export const OCCUPATION_KINDS: OccupationKindInfo[] = [
  {
    value: "MAINTENANCE",
    label: "Mantenimiento",
    className: "bg-zinc-500/25 text-zinc-700 dark:text-zinc-300",
    swatch: "border-zinc-500/50 bg-zinc-500/25",
  },
  {
    value: "CLASS",
    label: "Clase",
    className: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    swatch: "border-emerald-500/50 bg-emerald-500/20",
  },
  {
    value: "TOURNAMENT",
    label: "Torneo",
    className: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
    swatch: "border-violet-500/50 bg-violet-500/20",
  },
  {
    value: "LEAGUE",
    label: "Liga",
    className: "bg-teal-500/20 text-teal-700 dark:text-teal-300",
    swatch: "border-teal-500/50 bg-teal-500/20",
  },
  {
    value: "EVENT",
    label: "Evento",
    className: "bg-pink-500/20 text-pink-700 dark:text-pink-300",
    swatch: "border-pink-500/50 bg-pink-500/20",
  },
  {
    value: "OTHER",
    label: "Otro",
    className: "bg-muted text-muted-foreground",
    swatch: "border-border bg-muted",
  },
];

const BY_KIND = new Map(OCCUPATION_KINDS.map((k) => [k.value, k]));

/** Un bloqueo sin tipo (de antes de que existiera) es «Otro». */
export function occupationKindInfo(kind: CourtBlockKind | null | undefined): OccupationKindInfo {
  return BY_KIND.get(kind ?? "OTHER") ?? BY_KIND.get("OTHER")!;
}
