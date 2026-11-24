"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clubCustomersQK } from "@/lib/services/club-customers";
import { invalidateClubDebts } from "@/lib/services/club-debts";
import { ledgerQK, ledgerService } from "@/lib/services/ledger";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";
import { accountsErrorText } from "@/lib/utils/booking-parts";

/**
 * El interruptor «Cuenta abierta» de la ficha del cliente (F8-C2): un entrenador
 * externo o un contrato de pistas que paga cada cierto tiempo. Sus reservas van
 * a deber y sus deudas no caducan. Solo con el módulo «Cuentas» y para
 * propietario y gestor.
 */
export function CustomerOpenAccount({
  clubId, customerId, openAccount,
}: { clubId: string; customerId: string; openAccount: boolean }) {
  const qc = useQueryClient();
  const accountsEnabled = useAccountsEnabled(clubId);
  const canWrite = useClubAccess().can("accounts", "write");
  const set = useMutation({
    mutationFn: (next: boolean) => ledgerService.openAccounts.set(clubId, customerId, next),
    onSuccess: (r) => {
      toast.success(
        r.openAccount
          ? r.converted > 0
            ? `Cuenta abierta. ${r.converted} ${r.converted === 1 ? "deuda pasa" : "deudas pasan"} a largo plazo`
            : "Cuenta abierta"
          : "Cuenta abierta apagada",
      );
      void qc.invalidateQueries({ queryKey: clubCustomersQK.all(clubId) });
      void qc.invalidateQueries({ queryKey: ledgerQK.openAccounts(clubId) });
      invalidateClubDebts(qc, clubId);
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  if (!accountsEnabled || !canWrite) return null;
  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm">
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={openAccount}
          disabled={set.isPending}
          onChange={(e) => set.mutate(e.target.checked)}
        />
        Cuenta abierta
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        Para quien paga cada cierto tiempo (un entrenador externo, un contrato de pistas): sus reservas van a deber y
        sus deudas no caducan.
      </p>
    </div>
  );
}
