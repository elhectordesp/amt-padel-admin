"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import CollectModal from "@/components/admin/collect-modal";
import { ErrorState } from "@/components/admin/error-state";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";
import { bookingsService } from "@/lib/services/bookings";
import { cashQK, cashService, type DebtItem } from "@/lib/services/cash";
import { useClubAccess } from "@/lib/use-club-access";
import { formatCents } from "@/lib/utils/booking-price";
import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";
import { formatInTimeZone } from "@/lib/utils/time-zone";

interface Props {
  clubId:   string;
  timeZone: string;
}

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" };

/** Cobra una reserva o un jugador de una inscripción, con el método y el importe elegidos. */
export function collectDebt(item: DebtItem, method: CounterPaymentMethod, amountCents: number) {
  return item.source === "BOOKING"
    ? bookingsService.bookings.markPaid(item.refId, { method, amountCents })
    : adminService.registrations.updatePayment(item.refId, {
        paid: true,
        paymentMethod: method,
        paidAmountCents: amountCents,
        player: item.slot ?? "titular",
        playerId: item.playerId ?? "",
      });
}

/** «Pendiente de cobro»: quién debe al club, por persona, con el cobro ahí mismo. */
export function CajaDebts({ clubId, timeZone }: Props) {
  const qc = useQueryClient();
  const { can } = useClubAccess();
  // Cada cobro va al área que lo escribe en el back: la reserva, a «bookings»; la inscripción, a «cash»
  const canCollect = (item: DebtItem) => can(item.source === "BOOKING" ? "bookings" : "cash", "write");
  const [collecting, setCollecting] = useState<{ person: string; item: DebtItem } | null>(null);

  const query = useQuery({
    queryKey: cashQK.debts(clubId),
    queryFn: () => cashService.debts(clubId),
  });

  if (query.isError) return <ErrorState title="No se pudo cargar lo pendiente" onRetry={() => query.refetch()} />;
  if (!query.data) return <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />;
  const { people, totalCents } = query.data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reservas ya empezadas sin pagar e inscripciones de torneo con algún jugador sin pagar.{" "}
        <strong className="text-foreground">Total pendiente: {formatCents(totalCents)}</strong>
      </p>

      {people.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Nadie debe nada al club.
        </p>
      ) : (
        <div className="space-y-3">
          {people.map((p) => (
            <section key={p.key} className="rounded-lg border border-border bg-card">
              <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h3 className="font-medium text-foreground">{p.name}</h3>
                <span className="text-sm font-semibold text-[#D4AF37]">{formatCents(p.totalCents)}</span>
              </header>
              <ul>
                {p.items.map((item) => (
                  <li
                    key={`${item.source}-${item.refId}-${item.slot ?? ""}`}
                    className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{item.concept}</p>
                      <p className="text-xs text-muted-foreground">{formatInTimeZone(item.date, timeZone, DAY)}</p>
                    </div>
                    <span className="text-sm font-medium text-foreground">{formatCents(item.amountCents)}</span>
                    {canCollect(item) && (
                      <Button variant="outline" size="sm" onClick={() => setCollecting({ person: p.name, item })}>
                        <CreditCard className="h-3.5 w-3.5" /> Cobrar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {collecting && (
        <CollectModal
          title="Cobrar"
          subtitle={`${collecting.person} · ${collecting.item.concept}`}
          defaultCents={collecting.item.amountCents}
          onSubmit={(method, amountCents) => collectDebt(collecting.item, method, amountCents)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
            qc.invalidateQueries({ queryKey: ["bookings", "list"] });
            qc.invalidateQueries({ queryKey: ["registrations"] });
          }}
          onClose={() => setCollecting(null)}
        />
      )}
    </div>
  );
}
