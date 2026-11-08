import { pairPlayers, type PairRegistration } from "@/lib/utils/registration-pairs";
import type { AdminRegistration } from "@/types";

/**
 * Los cobros de las inscripciones de un torneo, para la mesa. La regla es la
 * de Finanzas del back (collectedByPair): precio por pareja y pago por
 * jugador (decisión del 18-10). El precio de la categoría es el de la pareja
 * y cada jugador paga la mitad; sin compañero, su mitad queda pendiente (la
 * pagará quien entre).
 */

/** Lo cobrado de una pareja y lo que vale, en euros. */
export interface PairAmount {
  paid:  number;
  total: number;
}

/** Lo cobrado, lo pendiente y el total de varias parejas, en euros. */
export interface PaymentTotals {
  collected: number;
  pending:   number;
  total:     number;
}

/** Lo que vale la inscripción (el precio de su categoría) y lo que han pagado sus jugadores. */
export function pairAmount(reg: AdminRegistration): PairAmount {
  const total = reg.category.price;
  const paidPlayers = pairPlayers(reg).filter(({ payment }) => payment.paid).length;
  return { paid: (total / 2) * paidPlayers, total };
}

/**
 * Las parejas que la mesa tiene que cobrar: las que tienen plaza (pendientes y
 * confirmadas), como Finanzas. Ni las canceladas ni las de la lista de espera,
 * que quizá nunca entren.
 */
function hasSpot(status: PairRegistration["status"]): boolean {
  return status !== "CANCELLED" && status !== "WAITLIST";
}

/**
 * «Sin pagar»: una pareja con plaza a la que le falta pagar a alguno de sus
 * jugadores (el titular y, si lo hay, el compañero). La misma regla que
 * «exigir el pago para confirmar» del back.
 */
export function isUnpaidPair(pair: Pick<PairRegistration, "status" | "primary">): boolean {
  return hasSpot(pair.status) && pairPlayers(pair.primary).some(({ payment }) => !payment.paid);
}

/** Lo cobrado, lo pendiente y el total del torneo: las parejas con plaza. */
export function paymentTotals(pairs: Pick<PairRegistration, "status" | "primary">[]): PaymentTotals {
  let collected = 0;
  let total = 0;
  for (const pair of pairs) {
    if (!hasSpot(pair.status)) continue;
    const amount = pairAmount(pair.primary);
    collected += amount.paid;
    total += amount.total;
  }
  return { collected, pending: total - collected, total };
}

// Como los importes de Finanzas: coma decimal y siempre dos decimales
const EUR = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Un importe en euros para leer: «12,50 €». */
export function formatEuros(euros: number): string {
  return `${EUR.format(euros)} €`;
}
