"use client";

/**
 * Cuotas de la escuela: las del mes de cada grupo con cuota mensual, por
 * alumno. Se generan sin duplicar (una por alumno que estuvo en el grupo algún
 * día del mes), se cobran en el mostrador, se les quita el cobro si fue un
 * error y se anulan (solo las pendientes: una anulada no se vuelve a generar).
 * Lo cobrado sale en la caja y lo pendiente, en «Pendiente de cobro».
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ChevronLeft, ChevronRight, CreditCard, Loader2, Pencil, Receipt, Undo2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { AmountField } from "@/components/admin/payment-fields";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolFeePayDialog } from "@/components/admin/school-pay-dialogs";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { schoolQK, schoolService } from "@/lib/services/school";
import { invalidateSchoolBilling, schoolBillingQK, schoolBillingService } from "@/lib/services/school-billing";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { formatCents } from "@/lib/utils/booking-price";
import { eurosToCents } from "@/lib/utils/payment-methods";
import {
  FEE_STATUS_LABEL,
  currentMonth,
  feeStateText,
  feeTotals,
  generateFeesText,
  monthLabel,
  shiftMonth,
} from "@/lib/utils/school-billing";
import { SCHOOL_MAX_PRICE_CENTS, centsToFieldText } from "@/lib/utils/school-money";
import type { SchoolFee, SchoolFeeStatus } from "@/types/school-billing";

const STATUS_COLORS: Record<SchoolFeeStatus, string> = {
  pending:   "bg-amber-500/15 text-amber-500 border-amber-500/30",
  paid:      "bg-green-500/15 text-green-500 border-green-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function SchoolFeesSection({ clubId, canWrite }: { clubId: string; canWrite: boolean }) {
  const { timeZone, isError, refetch } = useClubTimeZone(clubId);
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!timeZone) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  return <FeesList clubId={clubId} timeZone={timeZone} canWrite={canWrite} />;
}

function FeesList({ clubId, timeZone, canWrite }: { clubId: string; timeZone: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => currentMonth(new Date(), timeZone));
  const [status, setStatus] = useState<SchoolFeeStatus | "">("");
  const [groupId, setGroupId] = useState("");
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [paying, setPaying] = useState<SchoolFee | null>(null);
  const [editing, setEditing] = useState<SchoolFee | null>(null);
  const [unpaying, setUnpaying] = useState<SchoolFee | null>(null);
  const [toCancel, setToCancel] = useState<SchoolFee | null>(null);
  const [note, setNote] = useState("");

  const filters = { month, ...(status ? { status } : {}), ...(groupId ? { groupId } : {}) };
  const fees = useQuery({
    queryKey: schoolBillingQK.fees(clubId, filters),
    queryFn: () => schoolBillingService.fees.list(clubId, filters),
  });
  // Para elegir grupo: los mismos que el listado de Grupos (misma consulta)
  const groups = useQuery({
    queryKey: schoolQK.groups(clubId, false),
    queryFn: () => schoolService.groups.list(clubId, false),
  });

  const refresh = () => invalidateSchoolBilling(qc, clubId);

  const generate = useMutation({
    mutationFn: () => schoolBillingService.fees.generate(clubId, month, groupId || undefined),
    onSuccess: (result) => {
      refresh();
      const text = generateFeesText(result);
      if (result.created === 0) toast.info(text);
      else toast.success(text);
      setConfirmGenerate(false);
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setConfirmGenerate(false);
    },
  });

  const unpay = useMutation({
    mutationFn: (fee: SchoolFee) => schoolBillingService.fees.unpay(clubId, fee.id),
    onSuccess: () => {
      refresh();
      toast.success("Cobro quitado: la cuota vuelve a estar pendiente");
      setUnpaying(null);
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setUnpaying(null);
    },
  });

  const cancel = useMutation({
    mutationFn: (fee: SchoolFee) => schoolBillingService.fees.cancel(clubId, fee.id, note.trim() || undefined),
    onSuccess: () => {
      refresh();
      toast.success("Cuota anulada");
      setToCancel(null);
      setNote("");
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setToCancel(null);
    },
  });

  const list = fees.data ?? [];
  const totals = feeTotals(list);
  const withFee = (groups.data ?? []).filter((g) => g.monthlyFeeCents !== null);
  const scopeText = groupId ? "del grupo elegido" : "de los grupos con cuota mensual";

  return (
    <section aria-label="Cuotas" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1" role="group" aria-label="Mes">
            <Button variant="outline" size="icon-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium">{monthLabel(month)}</span>
            <Button variant="outline" size="icon-sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <label className="block text-xs text-muted-foreground">
            Estado
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SchoolFeeStatus | "")}
              className={`${schoolInputCls} mt-1 block`}
            >
              <option value="">Todas</option>
              {(Object.keys(FEE_STATUS_LABEL) as SchoolFeeStatus[]).map((s) => (
                <option key={s} value={s}>
                  {FEE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">
            Grupo
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`${schoolInputCls} mt-1 block`}>
              <option value="">Todos</option>
              {(groups.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setConfirmGenerate(true)} disabled={generate.isPending}>
            <WandSparkles className="h-3.5 w-3.5" /> Generar cuotas de {monthLabel(month).toLowerCase()}
          </Button>
        )}
      </div>

      {groups.isSuccess && withFee.length === 0 && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Ningún grupo tiene cuota mensual. Ponla al crear o editar el grupo.
        </p>
      )}

      {fees.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : fees.isError ? (
        <ErrorState onRetry={() => void fees.refetch()} />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          <Receipt className="h-7 w-7 opacity-50" />
          No hay cuotas de este mes con esos filtros.
          {canWrite && " Genéralas con el botón de arriba."}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Pendiente: <strong className="text-foreground">{formatCents(totals.pendingCents)}</strong> ({totals.pendingCount}) ·
            Cobrado: <strong className="text-foreground">{formatCents(totals.paidCents)}</strong> ({totals.paidCount})
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {list.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.customerName ?? "Sin nombre"}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[f.status]}`}>
                      {feeStateText(f)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {f.groupName} · {formatCents(f.amountCents)}
                    {f.note && ` · ${f.note}`}
                  </div>
                </div>
                {canWrite && f.status === "pending" && (
                  <span className="flex flex-wrap items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setPaying(f)} aria-label={`Cobrar la cuota de ${f.customerName ?? "este alumno"}`}>
                      <CreditCard className="h-3.5 w-3.5" /> Cobrar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(f)} aria-label={`Editar la cuota de ${f.customerName ?? "este alumno"}`}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setToCancel(f)} aria-label={`Anular la cuota de ${f.customerName ?? "este alumno"}`}>
                      <Ban className="h-3.5 w-3.5" /> Anular
                    </Button>
                  </span>
                )}
                {canWrite && f.status === "paid" && (
                  <Button variant="outline" size="sm" onClick={() => setUnpaying(f)} aria-label={`Quitar el cobro de la cuota de ${f.customerName ?? "este alumno"}`}>
                    <Undo2 className="h-3.5 w-3.5" /> Quitar cobro
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {paying && (
        <SchoolFeePayDialog
          clubId={clubId}
          feeId={paying.id}
          subtitle={`${paying.customerName ?? "Alumno"} · ${paying.groupName} · ${monthLabel(paying.month)}`}
          amountCents={paying.amountCents}
          onDone={refresh}
          onClose={() => setPaying(null)}
        />
      )}
      {editing && (
        <FeeEditDialog clubId={clubId} fee={editing} onDone={refresh} onClose={() => setEditing(null)} />
      )}

      <ConfirmModal
        open={confirmGenerate}
        title={`Generar las cuotas de ${monthLabel(month).toLowerCase()}`}
        description={`Se crea una cuota por alumno ${scopeText} que estuviera en el grupo algún día del mes, con el importe del grupo. Las que ya existen (también las anuladas) no se tocan.`}
        confirmLabel="Generar cuotas"
        loading={generate.isPending}
        onClose={() => {
          if (!generate.isPending) setConfirmGenerate(false);
        }}
        onConfirm={() => generate.mutate()}
      />
      <ConfirmModal
        open={!!unpaying}
        title="Quitar el cobro de la cuota"
        description={`La cuota de ${unpaying?.customerName ?? "este alumno"} volverá a estar pendiente de cobro. Si ya se contó en la caja de un día, ese cobro dejará de salir en ella (la caja se calcula con los cobros apuntados, no se guarda): úsalo solo si la cobraste por error.`}
        confirmLabel="Quitar el cobro"
        loading={unpay.isPending}
        onClose={() => {
          if (!unpay.isPending) setUnpaying(null);
        }}
        onConfirm={() => unpaying && unpay.mutate(unpaying)}
      />
      <ConfirmModal
        open={!!toCancel}
        danger
        title="Anular la cuota"
        description={`La cuota de ${toCancel?.customerName ?? "este alumno"} deja de contar como pendiente y no se vuelve a generar este mes.`}
        confirmLabel="Anular cuota"
        cancelLabel="Volver"
        loading={cancel.isPending}
        onClose={() => {
          if (!cancel.isPending) {
            setToCancel(null);
            setNote("");
          }
        }}
        onConfirm={() => toCancel && cancel.mutate(toCancel)}
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Motivo (opcional)
          </span>
          <input
            type="text"
            aria-label="Motivo de la anulación"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={cancel.isPending}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
        </label>
      </ConfirmModal>
    </section>
  );
}

/** Cambiar el importe o la nota de una cuota sin cobrar (un descuento, un mes a medias). */
function FeeEditDialog({
  clubId, fee, onDone, onClose,
}: { clubId: string; fee: SchoolFee; onDone: () => void; onClose: () => void }) {
  const [amount, setAmount] = useState(centsToFieldText(fee.amountCents));
  const [note, setNote] = useState(fee.note ?? "");
  const cents = eurosToCents(amount);
  const invalid = cents === null || cents > SCHOOL_MAX_PRICE_CENTS;

  const save = useMutation({
    mutationFn: () => {
      if (cents === null || invalid) throw new Error("Escribe un importe válido (por ejemplo 45 o 45,50)");
      return schoolBillingService.fees.update(clubId, fee.id, { amountCents: cents, note: note.trim() || null });
    },
    onSuccess: () => {
      toast.success("Cuota guardada");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!save.isPending) onClose(); };

  return (
    <SchoolDialog title="Editar cuota" onClose={close} busy={save.isPending}>
      <p className="text-sm text-muted-foreground">
        {fee.customerName ?? "Alumno"} · {fee.groupName} · {monthLabel(fee.month)}
      </p>
      <AmountField label="Importe de la cuota" value={amount} onChange={setAmount} invalid={invalid} disabled={save.isPending} />
      <label className="block text-xs text-muted-foreground">
        Nota (opcional)
        <input
          type="text"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={save.isPending}
          className={`${schoolInputCls} mt-1 w-full`}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={invalid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Guardar cuota
        </Button>
      </div>
    </SchoolDialog>
  );
}
