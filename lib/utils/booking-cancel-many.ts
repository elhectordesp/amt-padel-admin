/**
 * Resultado de «Cancelar seleccionadas»: por qué no se pudo cancelar alguna,
 * dicho en llano para el mostrador.
 */
import type { CancelManyResult } from "@/types/bookings";

/** Código propio: el lote falló (red o servidor) y esta reserva no llegó a procesarse. */
export const CANCEL_NOT_PROCESSED = "NOT_PROCESSED";

const FAILURE_REASONS: Record<string, string> = {
  BOOKING_ALREADY_CANCELLED: "ya estaba cancelada",
  BOOKING_CANNOT_CANCEL_COMPLETED: "ya se jugó",
  BOOKING_ALREADY_PLAYED: "ya se jugó",
  BOOKING_NOT_FOUND: "no se ha encontrado",
  [CANCEL_NOT_PROCESSED]: "no se llegó a procesar por un error: sigue sin cancelar",
};

export function cancelFailureReason(code: string): string {
  return FAILURE_REASONS[code] ?? "no se ha podido cancelar";
}

/** «3 canceladas» / «1 cancelada» */
export function cancelledSummary(result: CancelManyResult): string {
  const n = result.cancelled.length;
  return n === 1 ? "1 reserva cancelada" : `${n} reservas canceladas`;
}
