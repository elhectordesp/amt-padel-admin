"use client";

/**
 * Ajustes de la tesorería (dentro de «Ajustes de cuentas», solo con ella
 * encendida): el día en que empieza, el colchón y el saldo inicial del fondo.
 * Solo propietario y gestor. Se guarda solo lo que ha cambiado.
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AmountField } from "@/components/admin/payment-fields";
import { Field, Input } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import { accountsConfigQK, accountsConfigService, type AccountsConfig } from "@/lib/services/accounts-config";
import { treasuryQK } from "@/lib/services/treasury";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { isDayKey, ledgerRetentionMinDay } from "@/lib/utils/ledger";
import { centsToEurosInput, eurosToCents } from "@/lib/utils/payment-methods";
import { TREASURY_MAX_CENTS } from "@/lib/utils/treasury";
import { zonedDayKey } from "@/lib/utils/time-zone";

export function AccountsTreasurySettings({ clubId, saved, canWrite }: {
  clubId:   string;
  saved:    AccountsConfig;
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const { timeZone } = useClubTimeZone(clubId);
  const today = timeZone ? zonedDayKey(new Date(), timeZone) : null;

  const [start, setStart] = useState("");
  const [reserve, setReserve] = useState("");
  const [fund, setFund] = useState("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setStart(saved.treasuryStartDate ?? "");
    setReserve(centsToEurosInput(saved.reserveCents ?? 0));
    setFund(centsToEurosInput(saved.fundOpeningCents ?? 0));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [saved]);

  const reserveCents = eurosToCents(reserve);
  const fundCents = eurosToCents(fund);
  const startError =
    start !== "" && !isDayKey(start) ? "Elige un día válido"
    : start !== "" && today && start > today ? "El inicio no puede ser futuro"
    : undefined;
  // Un importe de 0 a 100.000 €; el campo ya dice cómo escribirlo
  const reserveInvalid = reserveCents === null || reserveCents > TREASURY_MAX_CENTS;
  const fundInvalid = fundCents === null || fundCents > TREASURY_MAX_CENTS;
  const invalid = !!startError || reserveInvalid || fundInvalid;

  const changes: Pick<AccountsConfig, "treasuryStartDate" | "reserveCents" | "fundOpeningCents"> = {
    ...(start !== (saved.treasuryStartDate ?? "") ? { treasuryStartDate: start === "" ? null : start } : {}),
    ...(reserveCents !== null && reserveCents !== (saved.reserveCents ?? 0) ? { reserveCents } : {}),
    ...(fundCents !== null && fundCents !== (saved.fundOpeningCents ?? 0) ? { fundOpeningCents: fundCents } : {}),
  };
  const unchanged = Object.keys(changes).length === 0;

  const save = useMutation({
    mutationFn: () =>
      // El back exige los tres campos de las deudas: van como estaban
      accountsConfigService.update(clubId, {
        debtExpiryDays: saved.debtExpiryDays,
        debtWarnDays: saved.debtWarnDays,
        cardFeeBps: saved.cardFeeBps,
        ...changes,
      }),
    onSuccess: () => {
      toast.success("Ajustes de tesorería guardados");
      void qc.invalidateQueries({ queryKey: accountsConfigQK.config(clubId) });
      void qc.invalidateQueries({ queryKey: treasuryQK.all(clubId) });
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  return (
    <fieldset className="space-y-3 border-t border-border pt-4" disabled={!canWrite}>
      <legend className="mb-1 text-sm font-medium">Tesorería</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Empieza el" error={startError}>
          <Input
            type="date"
            aria-label="Inicio de la tesorería"
            min={today ? ledgerRetentionMinDay(today) : undefined}
            max={today ?? undefined}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <AmountField label="Colchón" value={reserve} onChange={setReserve} invalid={reserveInvalid} disabled={!canWrite} />
        <AmountField label="Saldo inicial del fondo" value={fund} onChange={setFund} invalid={fundInvalid} disabled={!canWrite} />
      </div>
      <p className="text-xs text-muted-foreground">
        La tesorería cuenta desde el día de inicio: ese día cuadras la caja y el banco con lo que hay de verdad. Sin
        fecha, no se puede apuntar nada. No puede quedar después de un traspaso o un cuadre ya apuntado. El colchón es
        el dinero que nunca se reparte; el saldo inicial del fondo, lo que había apartado en él el día de inicio.
      </p>
      {canWrite && (
        <Button variant="outline" size="sm" disabled={invalid || unchanged || save.isPending} onClick={() => save.mutate()}>
          Guardar tesorería
        </Button>
      )}
    </fieldset>
  );
}
