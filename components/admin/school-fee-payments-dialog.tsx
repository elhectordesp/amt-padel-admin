"use client";

/**
 * Los pagos de una cuota de la escuela (F8-C3): cuándo, cómo y quién cobró cada
 * parte, con «Deshacer este cobro» (borra los pagos de ese cobro en todas las
 * cuotas que tocó). Una cuota cobrada antes de los pagos por partes no tiene
 * lista: se le quita el cobro entero.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { schoolBillingService } from "@/lib/services/school-billing";
import { formatCents } from "@/lib/utils/booking-price";
import { methodLabel } from "@/lib/utils/payment-methods";
import { feeCollectedToday, monthLabel } from "@/lib/utils/school-billing";
import { isBeforeToday } from "@/lib/utils/time-zone";
import { formatInTimeZone } from "@/lib/utils/time-zone";
import type { SchoolFee, SchoolFeePayment } from "@/types/school-billing";

const WHEN: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };

/** «Bizum · Rodri» o «Efectivo». */
function paymentMethodText(p: Pick<SchoolFeePayment, "paymentMethod" | "bizumPartnerName">): string {
  const label = methodLabel(p.paymentMethod);
  return p.paymentMethod === "BIZUM" ? `${label} · ${p.bizumPartnerName ?? "Club"}` : label;
}

export function SchoolFeePaymentsDialog({
  clubId, fee, timeZone, canWrite, canAdjust, onDone, onClose,
}: {
  clubId:   string;
  fee:      SchoolFee;
  timeZone: string;
  canWrite: boolean;
  /** Si lleva las cuentas del club: sin ello solo deshace lo cobrado hoy (el back lo exige). */
  canAdjust: boolean;
  /** Tras deshacer algo: recargar lo que corresponda. */
  onDone:   () => void;
  onClose:  () => void;
}) {
  const [undoing, setUndoing] = useState<SchoolFeePayment | null>(null);
  const [unpaying, setUnpaying] = useState(false);

  const undo = useMutation({
    mutationFn: (collectionId: string) => schoolBillingService.fees.undoCollection(clubId, collectionId),
    onSuccess: () => {
      toast.success("Cobro deshecho");
      onDone();
      setUndoing(null);
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setUndoing(null);
    },
  });
  const unpay = useMutation({
    mutationFn: () => schoolBillingService.fees.unpay(clubId, fee.id),
    onSuccess: () => {
      toast.success("Cobro quitado: la cuota vuelve a estar pendiente");
      onDone();
      setUnpaying(false);
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setUnpaying(false);
    },
  });
  const busy = undo.isPending || unpay.isPending;
  const close = () => { if (!busy) onClose(); };
  const legacyPaid = fee.payments.length === 0 && fee.paidAt !== null;
  // Un cobro de un día anterior ya está en una caja cerrada: lo deshace quien lleva las cuentas
  const locked = !canAdjust && !feeCollectedToday(fee, timeZone);
  const LOCKED_HINT = "Es de un día anterior: lo deshace el propietario o el gestor";

  return (
    <SchoolDialog title="Pagos de la cuota" onClose={close} busy={busy}>
      <p className="text-sm text-muted-foreground">
        {fee.customerName ?? "Alumno"} · {fee.groupName} · {monthLabel(fee.month)} ·{" "}
        <strong className="text-foreground">{formatCents(fee.paidCents)}</strong> de {formatCents(fee.amountCents)}
      </p>

      {legacyPaid ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Cobrada entera ({methodLabel(fee.paymentMethod)}
          {fee.paidAt ? `, el ${formatInTimeZone(fee.paidAt, timeZone, WHEN)}` : ""}) antes de los cobros por partes.
        </p>
      ) : fee.payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta cuota aún no tiene pagos.</p>
      ) : (
        <ul aria-label="Pagos" className="divide-y divide-border rounded-md border border-border text-sm">
          {fee.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0">
                <span className="block font-medium">
                  {formatCents(p.amountCents)} · {paymentMethodText(p)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {formatInTimeZone(p.paidAt, timeZone, WHEN)} · {p.paidByName}
                </span>
              </span>
              {canWrite && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || (!canAdjust && isBeforeToday(p.paidAt, timeZone))}
                  title={!canAdjust && isBeforeToday(p.paidAt, timeZone) ? LOCKED_HINT : undefined}
                  onClick={() => setUndoing(p)}
                  aria-label={`Deshacer el cobro de ${formatCents(p.amountCents)}`}
                >
                  <Undo2 className="h-3.5 w-3.5" /> Deshacer este cobro
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        {canWrite && legacyPaid && (
          <Button type="button" variant="outline" size="sm" disabled={busy || locked} title={locked ? LOCKED_HINT : undefined} onClick={() => setUnpaying(true)}>
            <Undo2 className="h-3.5 w-3.5" /> Quitar el cobro
          </Button>
        )}
        {canWrite && fee.payments.length > 1 && (
          <Button type="button" variant="outline" size="sm" disabled={busy || locked} title={locked ? LOCKED_HINT : undefined} onClick={() => setUnpaying(true)}>
            <Undo2 className="h-3.5 w-3.5" /> Quitar todos los pagos
          </Button>
        )}
        <Button type="button" size="sm" onClick={close} disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Cerrar
        </Button>
      </div>

      <ConfirmModal
        open={!!undoing}
        title="Deshacer este cobro"
        description="Se borran los pagos de este cobro en todas las cuotas que tocó, y esas cuotas vuelven a deber ese dinero. Si ya se contó en la caja de un día, dejará de salir en ella: úsalo solo si lo cobraste por error."
        confirmLabel="Deshacer el cobro"
        loading={undo.isPending}
        onClose={() => {
          if (!undo.isPending) setUndoing(null);
        }}
        onConfirm={() => undoing && undo.mutate(undoing.collectionId)}
      />
      <ConfirmModal
        open={unpaying}
        title="Quitar el cobro de la cuota"
        description="La cuota vuelve a estar pendiente de cobro. Si ya se contó en la caja de un día, ese cobro dejará de salir en ella (la caja se calcula con los cobros apuntados, no se guarda): úsalo solo si la cobraste por error."
        confirmLabel="Quitar el cobro"
        loading={unpay.isPending}
        onClose={() => {
          if (!unpay.isPending) setUnpaying(false);
        }}
        onConfirm={() => unpay.mutate()}
      />
    </SchoolDialog>
  );
}
