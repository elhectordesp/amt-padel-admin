"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarDays, Loader2, Printer } from "lucide-react";
import { CashClosurePanel } from "@/components/admin/cash-closure-panel";
import { ErrorState } from "@/components/admin/error-state";
import { Button } from "@/components/ui/button";
import { cashQK, cashService } from "@/lib/services/cash";
import { formatCents } from "@/lib/utils/booking-price";
import { methodLabel } from "@/lib/utils/payment-methods";
import { bizumReceiverTotals, methodsWithTotals, movementMethodLabel, printCash } from "@/lib/utils/print-cash";
import { zonedDayKey, zonedTime } from "@/lib/utils/time-zone";

interface Props {
  clubId:   string;
  clubName: string | null;
  timeZone: string;
}

/** «Caja del día»: lo cobrado en el día elegido, por método, con cada movimiento. */
export function CajaDay({ clubId, clubName, timeZone }: Props) {
  // null = sin tocar: hoy, en la zona del club
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? zonedDayKey(new Date(), timeZone);

  // El aviso «Días sin cerrar» de la portada llega con ?dia=AAAA-MM-DD
  useEffect(() => {
    const day = new URLSearchParams(window.location.search).get("dia");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) setPicked(day);
  }, []);

  const query = useQuery({
    queryKey: cashQK.day(clubId, date),
    queryFn: () => cashService.day(clubId, date),
    placeholderData: (prev) => prev,
  });

  const cash = query.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays size={14} />
          <span>Día</span>
          <input
            type="date"
            aria-label="Día de la caja"
            value={date}
            onChange={(e) => e.target.value && setPicked(e.target.value)}
            className="h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
        </label>
        {query.isFetching && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={!cash || cash.date !== date}
          onClick={() => cash && printCash(cash, clubName)}
        >
          <Printer className="h-3.5 w-3.5" /> Imprimir
        </Button>
      </div>

      <CashClosurePanel clubId={clubId} date={date} timeZone={timeZone} />

      {query.isError && !cash ? (
        <ErrorState title="No se pudo cargar la caja" onRetry={() => query.refetch()} />
      ) : !cash ? (
        <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {methodsWithTotals(cash.totalsByMethod).map((m) => (
              <div key={m} className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{methodLabel(m)}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{formatCents(cash.totalsByMethod[m])}</p>
              </div>
            ))}
            <div className="rounded-lg border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.08)] p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total del día</p>
              <p className="mt-1 text-lg font-semibold text-[#D4AF37]">{formatCents(cash.totalCents)}</p>
            </div>
          </div>

          {bizumReceiverTotals(cash).length > 0 && (
            <section aria-label="Bizum por receptor" className="rounded-lg border border-border bg-card p-3">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Bizum por receptor</h3>
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {bizumReceiverTotals(cash).map(([name, cents]) => (
                  <li key={name} className="text-foreground">
                    {name}: <span className="font-semibold">{formatCents(cents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {cash.movements.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No se cobró nada este día.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Hora</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Persona</th>
                    <th className="px-3 py-2">Método</th>
                    <th className="px-3 py-2 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {cash.movements.map((m, i) => (
                    <tr key={`${m.source}-${m.refId}-${i}`} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{zonedTime(m.at, cash.timezone)}</td>
                      <td className="px-3 py-2 text-foreground">
                        {m.source === "BOOKING_PART" && m.bookingId ? (
                          <Link href={`/mi-club/reservas/bookings/${m.bookingId}`} className="underline underline-offset-2 hover:text-[#D4AF37]">
                            {m.concept}
                          </Link>
                        ) : (
                          m.concept
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground">{m.person}</td>
                      <td className="px-3 py-2 text-muted-foreground">{movementMethodLabel(m)}</td>
                      <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">{formatCents(m.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
