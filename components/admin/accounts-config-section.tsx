"use client";

/**
 * Ajustes de las cuentas del club: cuánto tiempo tiene una deuda para cobrarse,
 * cuándo avisa la portada y la comisión del datáfono (solo para el resumen: no
 * toca la caja). Recepción lo ve; propietario y gestor lo cambian.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { errorText } from "@/components/admin/price-seasons-panel";
import { Button } from "@/components/ui/button";
import { accountsConfigQK, accountsConfigService, type AccountsConfig } from "@/lib/services/accounts-config";
import { clubDebtsService, type ExpiryPreview } from "@/lib/services/club-debts";
import { formatCents } from "@/lib/utils/booking-price";
import { useClubAccess } from "@/lib/use-club-access";
import {
  bpsToFeeText, DEBT_MAX_DAYS, feePercentToBps, parseWarnDays, warnDaysText,
} from "@/lib/utils/accounts-config";

const fieldClass =
  "rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-60";

export function AccountsConfigSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const canWrite = useClubAccess().can("settings", "write");
  const config = useQuery({
    queryKey: accountsConfigQK.config(clubId),
    queryFn: () => accountsConfigService.get(clubId),
  });

  const [expires, setExpires] = useState(false);
  const [days, setDays] = useState("");
  const [warn, setWarn] = useState("");
  const [fee, setFee] = useState("");
  const saved = config.data;

  useEffect(() => {
    if (!saved) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setExpires(saved.debtExpiryDays !== null);
    setDays(saved.debtExpiryDays !== null ? String(saved.debtExpiryDays) : "");
    setWarn(warnDaysText(saved.debtWarnDays));
    setFee(bpsToFeeText(saved.cardFeeBps));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [saved]);

  const expiryDays = expires ? (/^\d{1,3}$/.test(days.trim()) ? Number(days) : null) : null;
  const expiryValid = !expires || (expiryDays !== null && expiryDays >= 1 && expiryDays <= DEBT_MAX_DAYS);
  const warnDays = parseWarnDays(warn);
  const warnValid =
    warnDays !== null && (!expires || !expiryValid || warnDays.every((d) => d <= (expiryDays as number)));
  const feeBps = feePercentToBps(fee);

  const next: AccountsConfig | null =
    expiryValid && warnValid && warnDays !== null && feeBps !== null
      ? { debtExpiryDays: expires ? expiryDays : null, debtWarnDays: warnDays, cardFeeBps: feeBps }
      : null;
  const unchanged =
    !!next && !!saved &&
    next.debtExpiryDays === saved.debtExpiryDays &&
    next.cardFeeBps === saved.cardFeeBps &&
    next.debtWarnDays.join() === saved.debtWarnDays.join();

  // Al poner un plazo o acortarlo, las deudas ya vencidas con él pasarían a
  // perdidas: antes de guardar se enseña cuántas son
  const [confirming, setConfirming] = useState<{ next: AccountsConfig; preview: ExpiryPreview } | null>(null);
  const shortens = (input: AccountsConfig) =>
    input.debtExpiryDays !== null &&
    (!saved || saved.debtExpiryDays === null || input.debtExpiryDays < saved.debtExpiryDays);

  const save = useMutation({
    mutationFn: (input: AccountsConfig) => accountsConfigService.update(clubId, input),
    onSuccess: () => {
      setConfirming(null);
      toast.success("Ajustes de cuentas guardados");
      qc.invalidateQueries({ queryKey: accountsConfigQK.config(clubId) });
    },
    onError: (err: unknown) => { setConfirming(null); toast.error(errorText(err)); },
  });
  const preview = useMutation({
    mutationFn: (input: AccountsConfig) =>
      clubDebtsService.expiryPreview(clubId, input.debtExpiryDays as number).then((p) => ({ input, p })),
    onSuccess: ({ input, p }) => {
      if (p.count > 0) setConfirming({ next: input, preview: p });
      else save.mutate(input);
    },
    onError: () => toast.error("No se pudo comprobar cuántas deudas se perderían con ese plazo: no se ha guardado nada"),
  });
  const onSave = (input: AccountsConfig) => (shortens(input) ? preview.mutate(input) : save.mutate(input));

  return (
    <section aria-label="Ajustes de cuentas">
      <h2 className="text-base font-medium">Ajustes de cuentas</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cuánto tiempo tiene una deuda para cobrarse, cuándo avisa la portada de las que siguen
        pendientes y la comisión que cobra el banco por el datáfono.
      </p>
      {config.isLoading ? (
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-muted-foreground" />
      ) : config.isError ? (
        <p className="mt-3 text-sm text-destructive">No se pudieron cargar los ajustes de cuentas</p>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          <fieldset className="space-y-2" disabled={!canWrite}>
            <legend className="mb-1 font-medium">Plazo de las deudas</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="debt-expiry" checked={!expires} onChange={() => setExpires(false)} />
              No caducan
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <input type="radio" name="debt-expiry" checked={expires} onChange={() => setExpires(true)} />
              Caducan a los
              <input
                type="text"
                inputMode="numeric"
                aria-label="Días para que caduque una deuda"
                aria-invalid={expires && !expiryValid}
                disabled={!canWrite || !expires}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className={`w-20 ${fieldClass}`}
              />
              días
            </label>
            {expires && !expiryValid && (
              <p className="text-xs text-destructive">Un número entero de 1 a {DEBT_MAX_DAYS}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Los días se cuentan desde el de la pista o la venta; pasados, la deuda se da por perdida.
            </p>
          </fieldset>

          <label className="block space-y-1">
            <span className="font-medium">Días de aviso</span>
            <input
              type="text"
              aria-label="Días de aviso de las deudas"
              aria-invalid={!warnValid}
              placeholder="Por ejemplo: 5, 7, 9, 10"
              disabled={!canWrite}
              value={warn}
              onChange={(e) => setWarn(e.target.value)}
              className={`block w-full max-w-xs ${fieldClass}`}
            />
            {warnDays === null ? (
              <span className="block text-xs text-destructive">
                Números enteros de 1 a {DEBT_MAX_DAYS}, separados por comas
              </span>
            ) : !warnValid ? (
              <span className="block text-xs text-destructive">
                Ningún aviso puede pasar del plazo de la deuda ({expiryDays} días)
              </span>
            ) : (
              <span className="block text-xs text-muted-foreground">
                La portada avisa de la deuda cuando lleva esos días. Vacío = sin avisos.
              </span>
            )}
          </label>

          <label className="block space-y-1">
            <span className="font-medium">Comisión del datáfono</span>
            <span className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Comisión del datáfono (%)"
                aria-invalid={feeBps === null}
                disabled={!canWrite}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className={`w-20 ${fieldClass}`}
              />
              <span className="text-muted-foreground">%</span>
            </span>
            {feeBps === null ? (
              <span className="block text-xs text-destructive">Un porcentaje de 0 a 10 (por ejemplo 1,5)</span>
            ) : (
              <span className="block text-xs text-muted-foreground">
                Solo para el resumen de cuentas: no cambia lo que dice la caja.
              </span>
            )}
          </label>

          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              disabled={!next || unchanged || save.isPending || preview.isPending}
              onClick={() => next && onSave(next)}
            >
              Guardar ajustes
            </Button>
          )}
        </div>
      )}
      <ConfirmModal
        open={confirming !== null}
        danger
        title="Algunas deudas se perderían ya"
        description={
          confirming
            ? `Con un plazo de ${confirming.next.debtExpiryDays} días, ${confirming.preview.count} ${
                confirming.preview.count === 1 ? "deuda abierta" : "deudas abiertas"
              } (${formatCents(confirming.preview.totalCents)}) pasarían a perdidas hoy, en la próxima hora. Las de largo plazo no. Un propietario o gestor puede reabrirlas después.`
            : ""
        }
        confirmLabel="Guardar el plazo"
        loading={save.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && save.mutate(confirming.next)}
      />
    </section>
  );
}
