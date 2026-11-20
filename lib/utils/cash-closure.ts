import { formatCents } from "@/lib/utils/booking-price";

/**
 * Cómo se cuenta el cierre de caja: «Cuadra», «Faltan X €» o «Sobran X €».
 * La diferencia es contado − esperado (negativa, faltan).
 */

export type DiffKind = "ok" | "short" | "over";

export interface DiffResult {
  kind:  DiffKind;
  label: string;
}

export function diffResult(diffCents: number): DiffResult {
  if (diffCents === 0) return { kind: "ok", label: "Cuadra" };
  return diffCents < 0
    ? { kind: "short", label: `Faltan ${formatCents(-diffCents)}` }
    : { kind: "over", label: `Sobran ${formatCents(diffCents)}` };
}

/** Colores del resultado: verde si cuadra, rojo si faltan, ámbar si sobran. */
export const DIFF_TEXT_CLASS: Record<DiffKind, string> = {
  ok:    "text-green-500",
  short: "text-red-400",
  over:  "text-amber-400",
};

/** Las claves de un total por método, las de mayor importe primero. */
export function methodsByAmount(totals: Record<string, number>): string[] {
  return Object.keys(totals).sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));
}
