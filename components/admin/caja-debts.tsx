"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { ClubDebtPayAll, ClubDebtPayDialog, DebtItemPill } from "@/components/admin/club-debt-pay";
import CollectModal from "@/components/admin/collect-modal";
import { ErrorState } from "@/components/admin/error-state";
import { SchoolFeePayDialog, SchoolStudentPayDialog, VoucherPayDialog } from "@/components/admin/school-pay-dialogs";
import { ShopSalePayDialog } from "@/components/admin/shop-sale-pay-dialog";
import { Button } from "@/components/ui/button";
import { accountsQK, accountsService } from "@/lib/services/accounts";
import { adminService } from "@/lib/services/admin";
import { bookingsService } from "@/lib/services/bookings";
import { cashQK, cashService, type DebtItem } from "@/lib/services/cash";
import { clubVouchersQK } from "@/lib/services/club-vouchers";
import { invalidateSchoolBilling } from "@/lib/services/school-billing";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";
import { formatCents } from "@/lib/utils/booking-price";
import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";
import { formatInTimeZone } from "@/lib/utils/time-zone";

interface Props {
  clubId:   string;
  timeZone: string;
}

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" };

/** Las deudas que se cobran con el modal de importe: una reserva o un jugador de una inscripción. */
type CounterDebt = DebtItem & { source: "BOOKING" | "REGISTRATION" };

const isCounterDebt = (item: DebtItem): item is CounterDebt =>
  item.source === "BOOKING" || item.source === "REGISTRATION";

/** El área que escribe cada cobro en el back: la reserva, «bookings»; la inscripción, «cash»; la escuela, «school». */
const AREA_OF: Record<DebtItem["source"], "bookings" | "cash" | "school"> = {
  BOOKING:       "bookings",
  BOOKING_PART:  "cash",
  REGISTRATION:  "cash",
  VOUCHER:       "cash",
  SALE:          "cash",
  SCHOOL_FEE:    "school",
  PRIVATE_CLASS: "school",
  CLUB_DEBT:     "cash",
};

/**
 * Cobra una reserva o un jugador de una inscripción, con el método y el importe
 * elegidos. Un Bizum de reserva lleva a qué móvil llegó (módulo Cuentas).
 */
export function collectDebt(
  item: CounterDebt,
  method: CounterPaymentMethod,
  amountCents: number,
  bizumPartnerId?: string | null,
) {
  return item.source === "BOOKING"
    ? bookingsService.bookings.markPaid(item.refId, {
        method,
        amountCents,
        ...(method === "BIZUM" && bizumPartnerId !== undefined ? { bizumPartnerId } : {}),
      })
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
  // Cada cobro va al área que lo escribe en el back
  const canCollect = (item: DebtItem) => can(AREA_OF[item.source], "write");
  const [collecting, setCollecting] = useState<{ person: string; item: DebtItem } | null>(null);
  // Con el módulo Cuentas, un Bizum pregunta a qué móvil llegó (los socios activos)
  const accountsOn = useAccountsEnabled(clubId);
  const partners = useQuery({
    queryKey: accountsQK.partners(clubId),
    queryFn: () => accountsService.partners.list(clubId),
    enabled: accountsOn,
  });

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
        Reservas y clases privadas ya empezadas sin pagar, inscripciones de torneo con algún jugador sin pagar,
        bonos vendidos sin cobrar y cuotas de la escuela sin cobrar.{" "}
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
                <div className="flex items-center gap-3">
                  <ClubDebtPayAll
                    clubId={clubId}
                    personName={p.name}
                    debts={p.items.filter((i) => i.source === "CLUB_DEBT" && canCollect(i)).map((i) => ({ id: i.refId, amountCents: i.amountCents }))}
                    showTotal
                  />
                  <span className="text-sm font-semibold text-[#D4AF37]">{formatCents(p.totalCents)}</span>
                </div>
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
                      <DebtItemPill item={item} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{formatCents(item.amountCents)}</span>
                    {item.source === "BOOKING_PART" && item.bookingId ? (
                      // La parte se cobra en la hoja de su reserva (precio, quién y cómo paga)
                      <Link
                        href={`/mi-club/reservas/bookings/${item.bookingId}`}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-secondary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir la reserva
                      </Link>
                    ) : canCollect(item) && (
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

      {collecting && isCounterDebt(collecting.item) && (
        <CollectModal
          title="Cobrar"
          subtitle={`${collecting.person} · ${collecting.item.concept}`}
          defaultCents={collecting.item.amountCents}
          bizumReceivers={accountsOn && collecting.item.source === "BOOKING" && partners.data ? partners.data.filter((p) => p.active) : undefined}
          onSubmit={(method, amountCents, bizumPartnerId) =>
            collectDebt(collecting.item as CounterDebt, method, amountCents, bizumPartnerId)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
            qc.invalidateQueries({ queryKey: ["bookings", "list"] });
            qc.invalidateQueries({ queryKey: ["registrations"] });
          }}
          onClose={() => setCollecting(null)}
        />
      )}
      {collecting?.item.source === "CLUB_DEBT" && (
        <ClubDebtPayDialog
          clubId={clubId}
          subtitle={`${collecting.person} · ${collecting.item.concept}`}
          debtIds={[collecting.item.refId]}
          totalCents={collecting.item.amountCents}
          onClose={() => setCollecting(null)}
        />
      )}
      {collecting?.item.source === "VOUCHER" && (
        <VoucherPayDialog
          clubId={clubId}
          voucherId={collecting.item.refId}
          subtitle={`${collecting.person} · ${collecting.item.concept}`}
          amountCents={collecting.item.amountCents}
          onDone={() => {
            qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
            qc.invalidateQueries({ queryKey: clubVouchersQK.all(clubId) });
          }}
          onClose={() => setCollecting(null)}
        />
      )}
      {collecting?.item.source === "SALE" && (
        <ShopSalePayDialog
          clubId={clubId}
          saleId={collecting.item.refId}
          subtitle={`${collecting.person} · ${collecting.item.concept}`}
          amountCents={collecting.item.amountCents}
          onClose={() => setCollecting(null)}
        />
      )}
      {collecting?.item.source === "SCHOOL_FEE" && (
        <SchoolFeePayDialog
          clubId={clubId}
          feeId={collecting.item.refId}
          subtitle={`${collecting.person} · ${collecting.item.concept}`}
          amountCents={collecting.item.amountCents}
          onDone={() => invalidateSchoolBilling(qc, clubId)}
          onClose={() => setCollecting(null)}
        />
      )}
      {collecting?.item.source === "PRIVATE_CLASS" && collecting.item.privateClassId && (
        <SchoolStudentPayDialog
          clubId={clubId}
          classId={collecting.item.privateClassId}
          studentId={collecting.item.refId}
          subtitle={`${collecting.person} · ${collecting.item.concept}`}
          priceCents={collecting.item.amountCents}
          timeZone={timeZone}
          onDone={() => invalidateSchoolBilling(qc, clubId)}
          onClose={() => setCollecting(null)}
        />
      )}
    </div>
  );
}
