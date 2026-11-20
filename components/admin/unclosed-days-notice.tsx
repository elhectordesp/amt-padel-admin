"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cashClosureService, closureQK } from "@/lib/services/cash-closure";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";
import { formatCents } from "@/lib/utils/booking-price";
import { capitalizeFirst, formatDayKey } from "@/lib/utils/time-zone";

/** Cuántos días hacia atrás mira el aviso. */
export const UNCLOSED_DAYS_WINDOW = 14;

/**
 * «Días sin cerrar» de la portada: los días recientes con cobros y sin cierre
 * de caja, y los cerrados que han cambiado después del cierre («Cerrado, pero
 * ha cambiado»), cada uno con enlace a su caja. Solo con el módulo «Cuentas» y para
 * quien lee la caja; sin días pendientes, no sale.
 */
export function UnclosedDaysNotice({ clubId }: { clubId: string }) {
  const accountsEnabled = useAccountsEnabled(clubId);
  const canSeeCash = useClubAccess().can("cash", "read");
  const query = useQuery({
    queryKey: closureQK.unclosed(clubId, UNCLOSED_DAYS_WINDOW),
    queryFn: () => cashClosureService.unclosed(clubId, UNCLOSED_DAYS_WINDOW),
    enabled: accountsEnabled && canSeeCash,
  });

  if (!accountsEnabled || !canSeeCash || !query.data || query.data.length === 0) return null;
  return (
    <section aria-label="Días sin cerrar" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <AlertTriangle size={14} className="text-amber-500" /> Días sin cerrar
      </h4>
      <ul className="divide-y divide-border">
        {query.data.map((d) => (
          <li key={d.date}>
            <Link
              href={`/caja?dia=${d.date}`}
              className="-mx-2 flex items-center gap-3 rounded px-2 py-2 text-sm hover:bg-secondary/40"
            >
              <span className="flex-1 text-foreground">
                {capitalizeFirst(formatDayKey(d.date, { weekday: "long", day: "numeric", month: "long" }))}
              </span>
              <span className="text-xs text-muted-foreground">{formatCents(d.totalCents)} cobrados</span>
              {d.changedSinceClose && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-500">
                  Cerrado, pero ha cambiado
                </span>
              )}
              <span className="text-xs text-muted-foreground">{d.changedSinceClose ? "Revisar ›" : "Cerrar ›"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
