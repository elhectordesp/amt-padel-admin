"use client";

/**
 * Cuotas de la escuela: las del mes de cada grupo con cuota mensual, por
 * alumno, con lo pagado y lo que falta. Se generan sin duplicar (prorrateadas
 * si el alumno entró a mitad de mes, con su descuento y sin cuota para quien
 * paga con bono o está de baja), se cobran en el mostrador enteras o por
 * partes, se miran y deshacen sus pagos, se recalculan y se anulan (solo las
 * que no tienen pagos: una anulada no se vuelve a generar). Lo cobrado sale en
 * la caja y lo que falta, en «Pendiente de cobro».
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  History,
  Loader2,
  Pencil,
  Receipt,
  RefreshCw,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { AmountField } from "@/components/admin/payment-fields";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolFeePaymentsDialog } from "@/components/admin/school-fee-payments-dialog";
import { SchoolFeeSettings } from "@/components/admin/school-fee-settings";
import {
  SchoolFeeCollectModal,
  SchoolFeesPayAllDialog,
  SchoolStudentFeesDialog,
} from "@/components/admin/school-pay-dialogs";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { accountsQK, accountsService } from "@/lib/services/accounts";
import { schoolQK, schoolService } from "@/lib/services/school";
import { invalidateSchoolBilling, schoolBillingQK, schoolBillingService } from "@/lib/services/school-billing";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { formatCents } from "@/lib/utils/booking-price";
import { eurosToCents } from "@/lib/utils/payment-methods";
import {
  FEE_ARCHIVED_HINT,
  FEE_CANCEL_REASON_LABEL,
  FEE_STATUS_LABEL,
  currentMonth,
  feeBreakdownText,
  feeStateText,
  feeTotals,
  generateFeesText,
  monthLabel,
  shiftMonth,
} from "@/lib/utils/school-billing";
import { SCHOOL_MAX_PRICE_CENTS, centsToFieldText } from "@/lib/utils/school-money";
import type { SchoolFee, SchoolFeeStatus } from "@/types/school-billing";

const STATUS_COLORS: Record<SchoolFeeStatus, string> = {
  PENDING:   "bg-amber-500/15 text-amber-500 border-amber-500/30",
  PARTIAL:   "bg-sky-500/15 text-sky-500 border-sky-500/30",
  OVERDUE:   "bg-red-500/15 text-red-500 border-red-500/30",
  PAID:      "bg-green-500/15 text-green-500 border-green-500/30",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  ARCHIVED:  "bg-muted text-muted-foreground border-border",
};

const STATUS_FILTERS: SchoolFeeStatus[] = ["PAID", "PARTIAL", "OVERDUE", "PENDING", "CANCELLED", "ARCHIVED"];

export function SchoolFeesSection({ clubId, canWrite }: { clubId: string; canWrite: boolean }) {
  const { timeZone, isError, refetch } = useClubTimeZone(clubId);
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!timeZone) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  return <FeesList clubId={clubId} timeZone={timeZone} canWrite={canWrite} />;
}

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const num = "whitespace-nowrap px-3 py-2.5 text-right tabular-nums";

function FeesList({ clubId, timeZone, canWrite }: { clubId: string; timeZone: string; canWrite: boolean }) {
  const qc = useQueryClient();
  // Importes y cobros de días anteriores son de quien lleva las cuentas (propietario y gestor), no de recepción
  const canAdjust = useClubAccess().can("accounts", "write");
  const [month, setMonth] = useState(() => currentMonth(new Date(), timeZone));
  const [status, setStatus] = useState<SchoolFeeStatus | "">("");
  const [groupId, setGroupId] = useState("");
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [collecting, setCollecting] = useState<SchoolFee | null>(null);
  const [collectingStudent, setCollectingStudent] = useState<SchoolFee | null>(null);
  const [payingAll, setPayingAll] = useState(false);
  const [viewing, setViewing] = useState<SchoolFee | null>(null);
  const [editing, setEditing] = useState<SchoolFee | null>(null);
  const [toRecalc, setToRecalc] = useState<SchoolFee | null>(null);
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
  // Con el módulo Cuentas, un Bizum pregunta a qué móvil llegó (los socios activos)
  const accountsOn = useAccountsEnabled(clubId);
  const partners = useQuery({
    queryKey: accountsQK.partners(clubId),
    queryFn: () => accountsService.partners.list(clubId),
    enabled: accountsOn,
  });
  const bizumReceivers = accountsOn && partners.data ? partners.data.filter((p) => p.active) : undefined;

  const refresh = () => invalidateSchoolBilling(qc, clubId);

  const generate = useMutation({
    mutationFn: () => schoolBillingService.fees.generate(clubId, month, groupId || undefined),
    onSuccess: (result) => {
      refresh();
      setWarnings(result.warnings ?? []);
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

  const recalc = useMutation({
    mutationFn: (fee: SchoolFee) => schoolBillingService.fees.recalculate(clubId, fee.id),
    onSuccess: (fee) => {
      refresh();
      toast.success(fee.status === "CANCELLED" ? "Ya no toca cuota: se ha anulado" : "Cuota recalculada");
      setToRecalc(null);
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setToRecalc(null);
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
  const who = (f: SchoolFee) => f.customerName ?? "este alumno";

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
              {STATUS_FILTERS.map((s) => (
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
          <div className="flex flex-wrap gap-2">
            {totals.pendingCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => setPayingAll(true)}>
                <CreditCard className="h-3.5 w-3.5" /> Cobrar todas ({totals.pendingCount})
              </Button>
            )}
            <Button size="sm" onClick={() => setConfirmGenerate(true)} disabled={generate.isPending}>
              <WandSparkles className="h-3.5 w-3.5" /> Generar cuotas de {monthLabel(month).toLowerCase()}
            </Button>
          </div>
        )}
      </div>

      <SchoolFeeSettings clubId={clubId} canWrite={canWrite} />

      {warnings.length > 0 && (
        <div role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          <ul className="list-disc space-y-0.5 pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

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
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th scope="col" className={th}>Alumno</th>
                  <th scope="col" className={th}>Grupo</th>
                  <th scope="col" className={`${th} text-right`}>Cuota</th>
                  <th scope="col" className={`${th} text-right`}>Pagado</th>
                  <th scope="col" className={`${th} text-right`}>Pendiente</th>
                  <th scope="col" className={th}>Estado</th>
                  {canWrite && <th scope="col" className={th}><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((f) => {
                  const archived = f.status === "ARCHIVED";
                  const open = f.status !== "CANCELLED" && !archived;
                  const hasPayments = f.payments.length > 0 || f.paidAt !== null;
                  const breakdown = feeBreakdownText(f);
                  return (
                    <tr key={f.id}>
                      <td className="px-3 py-2.5 align-top">
                        <span className="font-medium">{f.customerName ?? "Sin nombre"}</span>
                        {f.createdByName === null && (
                          <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Automática
                          </span>
                        )}
                        {f.cancelReason && (
                          <span className="block text-xs text-muted-foreground">{FEE_CANCEL_REASON_LABEL[f.cancelReason]}</span>
                        )}
                        {f.note && <span className="block text-xs text-muted-foreground">{f.note}</span>}
                      </td>
                      <td className="px-3 py-2.5 align-top text-muted-foreground">{f.groupName}</td>
                      <td className={`${num} align-top`}>
                        <span className="block">{formatCents(f.amountCents)}</span>
                        {breakdown && <span className="block text-xs text-muted-foreground">{breakdown}</span>}
                      </td>
                      <td className={`${num} align-top`}>{archived ? "—" : formatCents(f.paidCents)}</td>
                      <td className={`${num} align-top`}>{open ? formatCents(f.pendingCents) : "—"}</td>
                      <td className="px-3 py-2.5 align-top">
                        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[f.status]}`}>
                          {feeStateText(f)}
                        </span>
                        {archived && <span className="mt-0.5 block text-xs text-muted-foreground">{FEE_ARCHIVED_HINT}</span>}
                        {open && f.status !== "PAID" && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">Hasta el {f.dueDate.slice(8)}</span>
                        )}
                      </td>
                      {canWrite && (
                        <td className="px-3 py-2.5 align-top">
                          <span className="flex flex-wrap justify-end gap-1">
                            {open && f.pendingCents > 0 && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => setCollecting(f)} aria-label={`Cobrar la cuota de ${who(f)}`}>
                                  <CreditCard className="h-3.5 w-3.5" /> Cobrar
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setCollectingStudent(f)} aria-label={`Cobrar a ${who(f)} todo lo que debe`}>
                                  <UserRound className="h-3.5 w-3.5" /> Al alumno
                                </Button>
                              </>
                            )}
                            {open && hasPayments && (
                              <Button variant="ghost" size="sm" onClick={() => setViewing(f)} aria-label={`Ver los pagos de la cuota de ${who(f)}`}>
                                <History className="h-3.5 w-3.5" /> Ver pagos
                              </Button>
                            )}
                            {open && !hasPayments && (
                              <>
                                {canAdjust && (
                                  <Button variant="ghost" size="sm" onClick={() => setToRecalc(f)} aria-label={`Recalcular la cuota de ${who(f)}`}>
                                    <RefreshCw className="h-3.5 w-3.5" /> Recalcular
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => setToCancel(f)} aria-label={`Anular la cuota de ${who(f)}`}>
                                  <Ban className="h-3.5 w-3.5" /> Anular
                                </Button>
                              </>
                            )}
                            {open && (
                              <Button variant="ghost" size="sm" onClick={() => setEditing(f)} aria-label={`Editar la cuota de ${who(f)}`}>
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </Button>
                            )}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {collecting && (
        <SchoolFeeCollectModal
          clubId={clubId}
          clubCustomerId={collecting.clubCustomerId}
          feeId={collecting.id}
          subtitle={`${collecting.customerName ?? "Alumno"} · ${collecting.groupName} · ${monthLabel(collecting.month)}`}
          pendingCents={collecting.pendingCents}
          bizumReceivers={bizumReceivers}
          onDone={refresh}
          onClose={() => setCollecting(null)}
        />
      )}
      {collectingStudent && (
        <SchoolStudentFeesDialog
          clubId={clubId}
          clubCustomerId={collectingStudent.clubCustomerId}
          studentName={collectingStudent.customerName ?? "Alumno"}
          bizumReceivers={bizumReceivers}
          onDone={refresh}
          onClose={() => setCollectingStudent(null)}
        />
      )}
      {payingAll && (
        <SchoolFeesPayAllDialog
          clubId={clubId}
          month={month}
          groupId={groupId || undefined}
          subtitle={`${monthLabel(month)}, ${groupId ? (groups.data ?? []).find((g) => g.id === groupId)?.name ?? "grupo elegido" : "todos los grupos"}`}
          count={totals.pendingCount}
          totalCents={totals.pendingCents}
          onDone={refresh}
          onClose={() => setPayingAll(false)}
        />
      )}
      {viewing && (
        <SchoolFeePaymentsDialog
          clubId={clubId}
          fee={viewing}
          timeZone={timeZone}
          canWrite={canWrite}
          canAdjust={canAdjust}
          onDone={refresh}
          onClose={() => setViewing(null)}
        />
      )}
      {editing && (
        <FeeEditDialog clubId={clubId} fee={editing} canAdjust={canAdjust} onDone={refresh} onClose={() => setEditing(null)} />
      )}

      <ConfirmModal
        open={confirmGenerate}
        title={`Generar las cuotas de ${monthLabel(month).toLowerCase()}`}
        description={`Se crea una cuota por alumno ${scopeText}: entera, o prorrateada por las clases que quedan si entró a mitad de mes o vuelve de una baja, y con su descuento. No se genera cuota a quien paga con bono ni a quien está de baja todo el mes. Las que ya existen (también las anuladas) no se tocan.`}
        confirmLabel="Generar cuotas"
        loading={generate.isPending}
        onClose={() => {
          if (!generate.isPending) setConfirmGenerate(false);
        }}
        onConfirm={() => generate.mutate()}
      />
      <ConfirmModal
        open={!!toRecalc}
        title="Recalcular la cuota"
        description={`La cuota de ${toRecalc ? who(toRecalc) : "este alumno"} se vuelve a calcular con los datos de hoy (descuento, baja temporal y clases que quedan). Si ya no toca cuota, se anula.`}
        confirmLabel="Recalcular"
        loading={recalc.isPending}
        onClose={() => {
          if (!recalc.isPending) setToRecalc(null);
        }}
        onConfirm={() => toRecalc && recalc.mutate(toRecalc)}
      />
      <ConfirmModal
        open={!!toCancel}
        danger
        title="Anular la cuota"
        description={`La cuota de ${toCancel ? who(toCancel) : "este alumno"} deja de contar como pendiente y no se vuelve a generar este mes.`}
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

/** Cambiar el importe o la nota de una cuota (un descuento puntual, un mes a medias); el importe no baja de lo ya pagado. */
function FeeEditDialog({
  clubId, fee, canAdjust, onDone, onClose,
}: { clubId: string; fee: SchoolFee; canAdjust: boolean; onDone: () => void; onClose: () => void }) {
  const [amount, setAmount] = useState(centsToFieldText(fee.amountCents));
  const [note, setNote] = useState(fee.note ?? "");
  const cents = eurosToCents(amount);
  const invalid = cents === null || cents > SCHOOL_MAX_PRICE_CENTS || cents < fee.paidCents;
  // Una cuota cobrada antes de los pagos por partes no cambia de importe sin quitar el cobro
  const legacyPaid = fee.payments.length === 0 && fee.paidAt !== null;

  const save = useMutation({
    mutationFn: () => {
      if (cents === null || invalid) throw new Error("Escribe un importe válido (por ejemplo 45 o 45,50)");
      return schoolBillingService.fees.update(clubId, fee.id, {
        ...(cents !== fee.amountCents ? { amountCents: cents } : {}),
        note: note.trim() || null,
      });
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
      <AmountField label="Importe de la cuota" value={amount} onChange={setAmount} invalid={invalid} disabled={save.isPending || legacyPaid || !canAdjust} />
      {fee.paidCents > 0 && !legacyPaid && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Ya lleva pagados {formatCents(fee.paidCents)}: el importe no puede ser menor.
        </p>
      )}
      {!canAdjust && (
        <p className="-mt-2 text-xs text-muted-foreground">El importe lo cambia el propietario o el gestor; tú puedes cambiar la nota.</p>
      )}
      {legacyPaid && (
        <p className="-mt-2 text-xs text-muted-foreground">Está cobrada: quítale el cobro para cambiar el importe.</p>
      )}
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
