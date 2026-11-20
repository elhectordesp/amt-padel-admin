"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { DebtPill } from "@/components/admin/club-debt-pay";
import { clubDebtsQK, clubDebtsService } from "@/lib/services/club-debts";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";
import { formatCents } from "@/lib/utils/booking-price";

const REFRESH_MS = 5 * 60_000;

/**
 * «Deudas que avisan hoy» de la portada (F8, M2): las deudas abiertas que
 * están en un día de aviso o en su último día, con enlace a «Pendiente de
 * cobro» de la caja. Solo con el módulo «Cuentas» y para quien lee la caja;
 * sin avisos, no sale.
 */
export function DebtWarningsNotice({ clubId }: { clubId: string }) {
  const accountsEnabled = useAccountsEnabled(clubId);
  const canSeeCash = useClubAccess().can("cash", "read");
  const query = useQuery({
    queryKey: clubDebtsQK.warnings(clubId),
    queryFn: () => clubDebtsService.warnings(clubId),
    enabled: accountsEnabled && canSeeCash,
    refetchInterval: REFRESH_MS,
  });

  if (!accountsEnabled || !canSeeCash || !query.data || query.data.length === 0) return null;
  return (
    <section aria-label="Deudas que avisan hoy" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <AlertTriangle size={14} className="text-amber-500" /> Deudas que avisan hoy
      </h4>
      <ul className="divide-y divide-border">
        {query.data.map((w) => (
          <li key={w.id}>
            <Link href="/caja" className="-mx-2 flex flex-wrap items-center gap-3 rounded px-2 py-2 text-sm hover:bg-secondary/40">
              <span className="min-w-0 flex-1 truncate text-foreground">
                {w.name} <span className="text-muted-foreground">· {w.concept}</span>
              </span>
              <DebtPill dayNumber={w.dayNumber} expiryDays={null} lastDay={w.lastDay} longTerm={false} />
              <span className="text-xs text-muted-foreground">{formatCents(w.amountCents)}</span>
              <span className="text-xs text-muted-foreground">Cobrar ›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
