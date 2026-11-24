"use client";

/**
 * «Cuentas» → «Deudas» → «Cuentas abiertas» (F8-C2): clientes (un entrenador
 * externo, un contrato de pistas) cuyas reservas van a deber y que pagan cada
 * cierto tiempo. Sus deudas no caducan. Se cobran como cualquier deuda. Solo
 * propietario y gestor.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CreditCard, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { ClubDebtPayDialog } from "@/components/admin/club-debt-pay";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import type { ClubCustomer } from "@/lib/services/club-customers";
import { clubDebtsQK, clubDebtsService, invalidateClubDebts } from "@/lib/services/club-debts";
import { ledgerQK, ledgerService, type OpenAccount } from "@/lib/services/ledger";
import { formatCents } from "@/lib/utils/booking-price";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { formatInTimeZone } from "@/lib/utils/time-zone";
import { useClubTimeZone } from "@/lib/use-club-time-zone";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" };

export function OpenAccountsSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const { timeZone } = useClubTimeZone(clubId);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<OpenAccount | null>(null);
  const [paying, setPaying] = useState<{ account: OpenAccount; debtIds: string[]; totalCents: number } | null>(null);

  const list = useQuery({
    queryKey: ledgerQK.openAccounts(clubId),
    queryFn: () => ledgerService.openAccounts.list(clubId),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ledgerQK.openAccounts(clubId) });
    invalidateClubDebts(qc, clubId);
  };
  const switchOff = useMutation({
    mutationFn: (a: OpenAccount) => ledgerService.openAccounts.set(clubId, a.clubCustomerId, false),
    onSuccess: () => { setRemoving(null); toast.success("Cuenta abierta apagada. Sus deudas actuales se quedan como están"); refresh(); },
    onError: (err: unknown) => { setRemoving(null); toast.error(accountsErrorText(err)); },
  });
  const collect = useMutation({
    mutationFn: async (a: OpenAccount) => {
      const groups = await qc.fetchQuery({
        queryKey: clubDebtsQK.list(clubId, "OPEN", a.clubCustomerId),
        queryFn: () => clubDebtsService.list(clubId, "OPEN", a.clubCustomerId),
        staleTime: 0,
      });
      const debts = (groups[0]?.debts ?? []).filter((d) => d.status === "OPEN");
      return { account: a, debtIds: debts.map((d) => d.id), totalCents: debts.reduce((s, d) => s + d.amountCents, 0) };
    },
    onSuccess: (r) => {
      if (r.debtIds.length === 0) toast.info("No debe nada ahora mismo");
      else setPaying(r);
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  return (
    <section aria-label="Cuentas abiertas" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-medium">Cuentas abiertas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Clientes que pagan cada cierto tiempo (un entrenador externo, un contrato de pistas). Sus reservas van a
            deber y sus deudas no caducan.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Abrir una cuenta
        </Button>
      </div>
      {list.isPending ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : list.isError ? (
        <ErrorState title="No se pudieron cargar las cuentas abiertas" onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ningún cliente tiene la cuenta abierta.</p>
      ) : (
        <ul className="space-y-2">
          {list.data.map((a) => (
            <li key={a.clubCustomerId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <div className="min-w-0">
                <Link href={`/mi-club/clientes/${a.clubCustomerId}`} className="font-medium underline-offset-2 hover:underline">
                  {a.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Debe {formatCents(a.openCents)} en {a.openDebts} {a.openDebts === 1 ? "deuda" : "deudas"} ·{" "}
                  {a.lastPaidAt && timeZone
                    ? `último pago el ${formatInTimeZone(a.lastPaidAt, timeZone, DAY)}`
                    : "todavía no ha pagado"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="xs" onClick={() => collect.mutate(a)} disabled={a.openDebts === 0 || collect.isPending}>
                  <CreditCard className="h-3 w-3" /> Cobrar
                </Button>
                <Button size="xs" variant="outline" aria-label={`Cerrar la cuenta abierta de ${a.name}`} onClick={() => setRemoving(a)}>
                  <X className="h-3 w-3" /> Cerrar cuenta
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddDialog clubId={clubId} onClose={() => setAdding(false)} onDone={refresh} />}
      {paying && (
        <ClubDebtPayDialog
          clubId={clubId}
          subtitle={`${paying.account.name} · ${paying.debtIds.length} ${paying.debtIds.length === 1 ? "deuda" : "deudas"}`}
          debtIds={paying.debtIds}
          totalCents={paying.totalCents}
          onClose={() => { setPaying(null); refresh(); }}
        />
      )}
      <ConfirmModal
        open={!!removing}
        title={`¿Cerrar la cuenta abierta de ${removing?.name ?? ""}?`}
        description="Sus deudas actuales se quedan como están (de largo plazo). Las nuevas volverán a caducar con el plazo del club."
        confirmLabel="Cerrar cuenta"
        loading={switchOff.isPending}
        onClose={() => { if (!switchOff.isPending) setRemoving(null); }}
        onConfirm={() => { if (removing) switchOff.mutate(removing); }}
      />
    </section>
  );
}

function AddDialog({ clubId, onClose, onDone }: { clubId: string; onClose: () => void; onDone: () => void }) {
  const [customer, setCustomer] = useState<ClubCustomer | null>(null);
  const save = useMutation({
    mutationFn: () => ledgerService.openAccounts.set(clubId, customer!.id, true),
    onSuccess: (r) => {
      toast.success(
        r.converted > 0
          ? `Cuenta abierta. ${r.converted} ${r.converted === 1 ? "deuda pasa" : "deudas pasan"} a largo plazo`
          : "Cuenta abierta",
      );
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  return (
    <SchoolDialog title="Abrir una cuenta" onClose={onClose} busy={save.isPending}>
      <p className="text-sm text-muted-foreground">
        Elige el cliente. Sus deudas abiertas pasan a largo plazo y las que nazcan después también.
      </p>
      <BookingCustomerPicker clubId={clubId} value={customer} onChange={setCustomer} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
        <Button onClick={() => save.mutate()} disabled={!customer || save.isPending}>
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Abrir cuenta
        </Button>
      </div>
    </SchoolDialog>
  );
}
