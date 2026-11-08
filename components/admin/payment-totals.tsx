"use client";

import { formatEuros, paymentTotals } from "@/lib/utils/registration-amounts";
import type { PairRegistration } from "@/lib/utils/registration-pairs";

/**
 * Los cobros del torneo para la mesa: lo cobrado, lo pendiente y el total
 * de las parejas no canceladas, con la regla de precio por pareja y pago por
 * jugador (registration-amounts.ts).
 */
export function PaymentTotals({ pairs }: { pairs: Pick<PairRegistration, "status" | "primary">[] }) {
  const { collected, pending, total } = paymentTotals(pairs);
  return (
    <div
      role="group"
      aria-label="Cobros del torneo"
      title="Sin las parejas canceladas"
      className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground"
    >
      <span>Cobrado <strong className="font-semibold text-green-400">{formatEuros(collected)}</strong></span>
      <span>Pendiente <strong className="font-semibold text-yellow-400">{formatEuros(pending)}</strong></span>
      <span>Total <strong className="font-semibold text-foreground">{formatEuros(total)}</strong></span>
    </div>
  );
}
