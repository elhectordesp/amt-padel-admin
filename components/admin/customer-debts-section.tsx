"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ClubDebtPayAll, DebtPill } from "@/components/admin/club-debt-pay";
import { clubDebtsQK, clubDebtsService } from "@/lib/services/club-debts";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";
import { formatCents } from "@/lib/utils/booking-price";
import { DEBT_STATUS_LABEL } from "@/lib/utils/club-debts";
import { formatDayKey } from "@/lib/utils/time-zone";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" };

/**
 * Las deudas de un cliente del club (F8, M2), en su ficha: todas, con lo que
 * sigue abierto arriba y «Cobrar todo» ahí mismo. Solo con el módulo «Cuentas»
 * y para quien lee la caja; un cliente sin deudas no la enseña.
 */
export function CustomerDebtsSection({ clubId, customerId }: { clubId: string; customerId: string }) {
  const accountsEnabled = useAccountsEnabled(clubId);
  const access = useClubAccess();
  const canSeeCash = access.can("cash", "read");
  const query = useQuery({
    queryKey: clubDebtsQK.list(clubId, "ALL", customerId),
    queryFn: () => clubDebtsService.list(clubId, "ALL", customerId),
    enabled: accountsEnabled && canSeeCash,
  });

  if (!accountsEnabled || !canSeeCash) return null;
  if (query.isPending) return <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />;
  const person = query.data?.[0];
  if (!person) return null;

  const open = person.debts.filter((d) => d.status === "OPEN");
  return (
    <section aria-label="Deudas" className="mt-4 rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-base text-foreground">
          Deudas{" "}
          <span className="text-sm font-normal text-muted-foreground">
            · abierto: <strong className="text-[#D4AF37]">{formatCents(person.openCents)}</strong>
          </span>
        </h3>
        {access.can("cash", "write") && <ClubDebtPayAll clubId={clubId} personName={person.name} debts={open} />}
      </div>
      <ul className="divide-y divide-border">
        {person.debts.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-foreground">{d.concept}</p>
              <p className="text-xs text-muted-foreground">{formatDayKey(d.debtDate, DAY)}</p>
            </div>
            {d.status === "OPEN" ? (
              <DebtPill dayNumber={d.dayNumber} expiryDays={null} lastDay={d.lastDay} longTerm={d.longTerm} />
            ) : (
              <span className="text-xs text-muted-foreground">{DEBT_STATUS_LABEL[d.status]}</span>
            )}
            <span className="font-medium text-foreground">{formatCents(d.amountCents)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
