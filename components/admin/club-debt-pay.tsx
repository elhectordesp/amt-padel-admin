"use client";

/**
 * Cobro de deudas del club (F8, M2) y su píldora del plazo. Los comparten la
 * caja («Pendiente de cobro»), «Cuentas» → «Deudas» y la ficha del cliente: el
 * método del mostrador y, con Bizum, a qué móvil llegó (un socio o «Club»). El
 * importe es el de la deuda: para cambiarlo se edita antes, no al cobrar.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BizumReceiverPicker, type BizumReceiver } from "@/components/admin/bizum-receiver";
import { PaymentMethodPicker } from "@/components/admin/payment-fields";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { accountsQK, accountsService } from "@/lib/services/accounts";
import type { DebtItem } from "@/lib/services/cash";
import { clubDebtsService, invalidateClubDebts } from "@/lib/services/club-debts";
import { formatCents } from "@/lib/utils/booking-price";
import { debtPill } from "@/lib/utils/club-debts";
import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";

/** «Día 5 de 10», «Último día» (resaltada) o «Largo plazo». */
export function DebtPill({ dayNumber, expiryDays, lastDay, longTerm }: {
  dayNumber:  number;
  expiryDays: number | null;
  lastDay:    boolean;
  longTerm:   boolean;
}) {
  const pill = debtPill({ dayNumber, expiryDays, lastDay, longTerm });
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        pill.urgent
          ? "border-red-500/40 bg-red-500/15 text-red-500"
          : "border-border bg-secondary text-muted-foreground"
      }`}
    >
      {pill.label}
    </span>
  );
}

/** La píldora de una línea de «Pendiente de cobro»; solo las deudas del club la llevan. */
export function DebtItemPill({ item }: { item: DebtItem }) {
  if (item.source !== "CLUB_DEBT") return null;
  return (
    <DebtPill
      dayNumber={item.dayNumber ?? 1}
      expiryDays={item.expiryDays ?? null}
      lastDay={item.lastDay ?? false}
      longTerm={item.longTerm ?? false}
    />
  );
}

interface DialogProps {
  clubId:     string;
  /** Qué se cobra y a quién. */
  subtitle:   string;
  debtIds:    string[];
  totalCents: number;
  onClose:    () => void;
}

export function ClubDebtPayDialog({ clubId, subtitle, debtIds, totalCents, onClose }: DialogProps) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");
  const [receiver, setReceiver] = useState<BizumReceiver>(undefined);
  // Solo hace falta si se cobra por Bizum: el diálogo solo existe con el módulo Cuentas
  const partners = useQuery({
    queryKey: accountsQK.partners(clubId),
    queryFn: () => accountsService.partners.list(clubId),
    enabled: method === "BIZUM",
  });
  const askReceiver = method === "BIZUM";

  const pay = useMutation({
    mutationFn: () =>
      clubDebtsService.pay(clubId, {
        debtIds,
        method: method as CounterPaymentMethod,
        ...(askReceiver ? { bizumPartnerId: receiver as string | null } : {}),
      }),
    onSuccess: () => {
      toast.success(debtIds.length === 1 ? "Deuda cobrada" : "Deudas cobradas");
      invalidateClubDebts(qc, clubId);
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  // Mientras guarda no se cierra: la respuesta cerraría el diálogo que se abriera después
  const close = () => { if (!pay.isPending) onClose(); };
  const ready =
    method !== "" && (!askReceiver || (receiver !== undefined && partners.isSuccess)) && !pay.isPending;

  return (
    <SchoolDialog title="Cobrar deuda" onClose={close} busy={pay.isPending}>
      <p className="text-sm text-muted-foreground">
        {subtitle} · <strong className="text-foreground">{formatCents(totalCents)}</strong>
      </p>
      <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
      {askReceiver && (
        partners.isSuccess ? (
          <BizumReceiverPicker
            partners={partners.data.filter((p) => p.active)}
            value={receiver}
            onChange={setReceiver}
            disabled={pay.isPending}
          />
        ) : partners.isError ? (
          <p className="text-sm text-destructive">No se pudieron cargar los socios: cierra y vuelve a intentarlo.</p>
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={pay.isPending}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={!ready} onClick={() => pay.mutate()}>
          {pay.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
          Cobrar
        </Button>
      </div>
    </SchoolDialog>
  );
}

/** «Cobrar todo» de una persona: todas sus deudas abiertas de una vez, con un solo método. */
export function ClubDebtPayAll({ clubId, personName, debts }: {
  clubId:     string;
  personName: string;
  /** Sus deudas abiertas (id e importe). */
  debts:      { id: string; amountCents: number }[];
}) {
  const [open, setOpen] = useState(false);
  if (debts.length === 0) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CreditCard className="h-3.5 w-3.5" /> Cobrar todo
      </Button>
      {open && (
        <ClubDebtPayDialog
          clubId={clubId}
          subtitle={`${personName} · ${debts.length} ${debts.length === 1 ? "deuda" : "deudas"}`}
          debtIds={debts.map((d) => d.id)}
          totalCents={debts.reduce((sum, d) => sum + d.amountCents, 0)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
