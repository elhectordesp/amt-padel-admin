import type { BookingPartsView } from "@/lib/services/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";

/** Un importe con su signo explícito («+0,50 €», «−0,50 €»); sin diferencia, «0,00 €». */
function signedCents(cents: number): string {
  if (cents === 0) return formatCents(0);
  return `${cents > 0 ? "+" : "−"}${formatCents(Math.abs(cents))}`;
}

/**
 * Los totales de la hoja de la reserva, para que cuadren a la vista:
 * precio de la pista = a cobrar + invitaciones − otros precios, y lo a cobrar
 * es lo cobrado + lo pendiente + lo que queda a deber.
 */
export function BookingPartsTotals({ view }: { view: Pick<BookingPartsView, "priceCents" | "totals"> }) {
  const t = view.totals;
  const toCollect = t.partsCents - t.invitedCents;
  const adjustment = t.adjustmentCents;
  const cells: { label: string; value: string; strong?: boolean; tone?: string }[] = [
    { label: "Precio de la pista", value: formatCents(view.priceCents) },
    { label: "Invitaciones", value: formatCents(t.invitedCents), tone: t.invitedCents > 0 ? "text-violet-600 dark:text-violet-400" : undefined },
    { label: "Otros precios", value: signedCents(adjustment) },
    { label: "A cobrar", value: formatCents(toCollect), strong: true },
    { label: "Cobrado", value: formatCents(t.collectedCents), tone: "text-green-600 dark:text-green-400" },
    { label: "A deber", value: formatCents(t.debtCents), tone: t.debtCents > 0 ? "text-orange-600 dark:text-orange-400" : undefined },
    { label: "Pendiente", value: formatCents(t.pendingCents), strong: true, tone: t.pendingCents > 0 ? "text-red-600 dark:text-red-400" : undefined },
  ];
  return (
    <div className="space-y-2">
      <dl aria-label="Totales de la reserva" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="rounded-md border border-border bg-background px-3 py-2">
            <dt className="text-xs text-muted-foreground">{c.label}</dt>
            <dd className={`tabular-nums ${c.strong ? "text-lg font-semibold" : "text-sm font-medium"} ${c.tone ?? "text-foreground"}`}>
              {c.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground tabular-nums" data-testid="totals-equation">
        Precio {formatCents(view.priceCents)} = a cobrar {formatCents(toCollect)} + invitaciones {formatCents(t.invitedCents)}{" "}
        {adjustment > 0 ? "−" : "+"} otros precios {formatCents(Math.abs(adjustment))}
      </p>
    </div>
  );
}
