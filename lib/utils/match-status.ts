import type { MatchResult } from "@/types";

/**
 * Si un partido ya tiene resultado. El back manda el estado en mayúsculas
 * ("FINISHED"); comparar con "finished" daba todos por pendientes en el CSV
 * del horario y en los informes. `isResult` ya lo resuelve el servicio.
 */
export function isMatchFinished(m: Pick<MatchResult, "isResult" | "status">): boolean {
  return m.isResult || String(m.status ?? "").toUpperCase() === "FINISHED";
}
