import type { BookingPartsView } from "@/lib/services/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";

/** Los totales de la hoja de la reserva: precio, partes, descuento y cómo está cada euro. */
export function BookingPartsTotals({ view }: { view: Pick<BookingPartsView, "priceCents" | "totals"> }) {
  const t = view.totals;
  const cells: { label: string; cents: number; strong?: boolean; tone?: string }[] = [
    { label: "Precio de la reserva", cents: view.priceCents },
    { label: "Suma de las partes", cents: t.partsCents },
    { label: "Descuento", cents: t.discountCents },
    { label: "Cobrado", cents: t.collectedCents, tone: "text-green-600 dark:text-green-400" },
    { label: "Pendiente", cents: t.pendingCents, strong: true, tone: t.pendingCents > 0 ? "text-red-600 dark:text-red-400" : undefined },
    { label: "A deber", cents: t.debtCents, tone: t.debtCents > 0 ? "text-orange-600 dark:text-orange-400" : undefined },
    { label: "Invitado", cents: t.invitedCents, tone: t.invitedCents > 0 ? "text-violet-600 dark:text-violet-400" : undefined },
  ];
  return (
    <dl aria-label="Totales de la reserva" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="rounded-md border border-border bg-background px-3 py-2">
          <dt className="text-xs text-muted-foreground">{c.label}</dt>
          <dd className={`tabular-nums ${c.strong ? "text-lg font-semibold" : "text-sm font-medium"} ${c.tone ?? "text-foreground"}`}>
            {formatCents(c.cents)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
