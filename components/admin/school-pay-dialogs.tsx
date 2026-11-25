"use client";

/**
 * Cobros de la escuela: una cuota mensual (entera o por partes), todo lo que debe un alumno, todas las pendientes de un mes (en el mostrador) y un alumno de una
 * clase privada (en el mostrador o con una sesión de un bono suyo de clases
 * privadas). Los usan las pestañas de Escuela y «Pendiente de cobro» de la
 * caja. El importe de una clase privada es el del alumno: para cambiarlo se
 * edita antes, no al cobrar.
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { BizumReceiverPicker, type BizumReceiver } from "@/components/admin/bizum-receiver";
import CollectModal from "@/components/admin/collect-modal";
import { AmountField, PaymentMethodPicker } from "@/components/admin/payment-fields";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import type { ClubPartner } from "@/lib/services/accounts";
import { clubVouchersService } from "@/lib/services/club-vouchers";
import { schoolBillingQK, schoolBillingService } from "@/lib/services/school-billing";
import { formatCents } from "@/lib/utils/booking-price";
import { centsToEurosInput, eurosToCents, type CounterPaymentMethod } from "@/lib/utils/payment-methods";
import { allocateFeePayment, monthLabel, pendingFeesOf } from "@/lib/utils/school-billing";
import { expiryLabel, sessionsLabel } from "@/lib/utils/voucher";

interface Common {
  clubId:   string;
  /** Qué se cobra y a quién. */
  subtitle: string;
  /** Tras cobrar: recargar lo que corresponda. */
  onDone:   () => void;
  onClose:  () => void;
}

/**
 * Cobrar lo que falta de una cuota, todo o una parte: el método, el socio que
 * recibió el Bizum (módulo Cuentas) y el importe, que por defecto es lo pendiente
 * y no puede pasar de ahí. Un cobro parcial deja la cuota «parcial».
 */
export function SchoolFeeCollectModal({
  clubId, clubCustomerId, feeId, subtitle, pendingCents, bizumReceivers, onDone, onClose,
}: Common & {
  clubCustomerId: string;
  feeId:          string;
  /** Lo que falta por cobrar de la cuota, en céntimos. */
  pendingCents:   number;
  /** Con el módulo Cuentas: los socios activos, para el receptor de un Bizum. */
  bizumReceivers?: ClubPartner[];
}) {
  return (
    <CollectModal
      title="Cobrar cuota"
      subtitle={subtitle}
      defaultCents={pendingCents}
      maxCents={pendingCents}
      bizumReceivers={bizumReceivers}
      onSubmit={(method, amountCents, bizumPartnerId) =>
        schoolBillingService.fees.collect(clubId, {
          clubCustomerId,
          amountCents,
          paymentMethod: method,
          feeIds: [feeId],
          ...(bizumPartnerId !== undefined ? { bizumPartnerId } : {}),
        })}
      onDone={onDone}
      onClose={onClose}
    />
  );
}

/**
 * Cobrar a un alumno un importe: se reparte entre sus cuotas con algo pendiente,
 * de la más antigua a la más nueva, y el diálogo lo enseña antes de cobrar. Si
 * se escribe más de lo que debe, se cobra lo que debe y se enseña el cambio.
 */
export function SchoolStudentFeesDialog({
  clubId, clubCustomerId, studentName, bizumReceivers, onDone, onClose,
}: {
  clubId:         string;
  clubCustomerId: string;
  studentName:    string;
  bizumReceivers?: ClubPartner[];
  onDone:         () => void;
  onClose:        () => void;
}) {
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");
  const [receiver, setReceiver] = useState<BizumReceiver>(undefined);
  const [amount, setAmount] = useState<string | null>(null);

  const fees = useQuery({
    queryKey: schoolBillingQK.fees(clubId, { clubCustomerId }),
    queryFn: () => schoolBillingService.fees.list(clubId, { clubCustomerId }),
  });
  const pending = pendingFeesOf(fees.data ?? []);
  const totalCents = pending.reduce((sum, f) => sum + f.pendingCents, 0);
  // Mientras no se escribe nada, se propone todo lo que debe
  const text = amount ?? centsToEurosInput(totalCents);
  const cents = eurosToCents(text);
  const { shares, changeCents } = allocateFeePayment(pending, cents ?? 0);
  const chargedCents = shares.reduce((sum, s) => sum + s.amountCents, 0);
  const askReceiver = method === "BIZUM" && bizumReceivers !== undefined;

  const pay = useMutation({
    mutationFn: () =>
      schoolBillingService.fees.collect(clubId, {
        clubCustomerId,
        amountCents: chargedCents,
        paymentMethod: method,
        ...(askReceiver ? { bizumPartnerId: receiver as string | null } : {}),
      }),
    onSuccess: () => {
      toast.success(`Cobrado a ${studentName}: ${formatCents(chargedCents)}`);
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!pay.isPending) onClose(); };
  const canPay =
    !pay.isPending && method !== "" && cents !== null && chargedCents > 0 && (!askReceiver || receiver !== undefined);
  const shareOf = (id: string) => shares.find((s) => s.feeId === id)?.amountCents ?? 0;

  return (
    <SchoolDialog title="Cobrar al alumno" onClose={close} busy={pay.isPending}>
      <p className="text-sm text-muted-foreground">
        {studentName}
        {fees.isSuccess && pending.length > 0 && (
          <> · debe <strong className="text-foreground">{formatCents(totalCents)}</strong></>
        )}
      </p>

      {fees.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : fees.isError ? (
        <p className="text-sm text-destructive">No se han podido cargar las cuotas del alumno.</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">El alumno no debe ninguna cuota.</p>
      ) : (
        <>
          <ul aria-label="Reparto" className="divide-y divide-border rounded-md border border-border text-sm">
            {pending.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{monthLabel(f.month)} · {f.groupName}</span>
                  <span className="block text-xs text-muted-foreground">Falta {formatCents(f.pendingCents)}</span>
                </span>
                <span className={shareOf(f.id) > 0 ? "font-medium text-[#D4AF37]" : "text-muted-foreground"}>
                  {shareOf(f.id) > 0 ? formatCents(shareOf(f.id)) : "—"}
                </span>
              </li>
            ))}
          </ul>
          <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
          {askReceiver && (
            <BizumReceiverPicker partners={bizumReceivers} value={receiver} onChange={setReceiver} disabled={pay.isPending} />
          )}
          <AmountField label="Importe recibido" value={text} onChange={setAmount} invalid={cents === null} disabled={pay.isPending} />
          {changeCents > 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              Cambio a devolver: <strong className="text-foreground">{formatCents(changeCents)}</strong>
            </p>
          )}
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={pay.isPending}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={!canPay} onClick={() => pay.mutate()}>
          {pay.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
          Cobrar {formatCents(chargedCents)}
        </Button>
      </div>
    </SchoolDialog>
  );
}

/** Cobrar de golpe las cuotas pendientes de un mes (de un grupo o de todos): un método y el total a la vista. */
export function SchoolFeesPayAllDialog({
  clubId, month, groupId, subtitle, count, totalCents, onDone, onClose,
}: Common & { month: string; groupId?: string; count: number; totalCents: number }) {
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");

  const pay = useMutation({
    mutationFn: () => schoolBillingService.fees.payPending(clubId, month, method, groupId),
    onSuccess: (result) => {
      toast.success(
        result.paid === 0
          ? "No quedaba ninguna cuota pendiente"
          : `${result.paid} ${result.paid === 1 ? "cuota cobrada" : "cuotas cobradas"}: ${formatCents(result.totalCents)}`,
      );
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!pay.isPending) onClose(); };

  return (
    <SchoolDialog title="Cobrar todas las cuotas pendientes" onClose={close} busy={pay.isPending}>
      <p className="text-sm text-muted-foreground">
        {subtitle}: {count} {count === 1 ? "cuota" : "cuotas"}, <strong className="text-foreground">{formatCents(totalCents)}</strong> en total.
        Se cobran todas con el mismo método.
      </p>
      <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={pay.isPending}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={method === "" || pay.isPending} onClick={() => pay.mutate()}>
          {pay.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
          Cobrar {formatCents(totalCents)}
        </Button>
      </div>
    </SchoolDialog>
  );
}

/** Cobrar un bono vendido y pendiente: el método del mostrador; el importe es su precio. */
export function VoucherPayDialog({
  clubId, voucherId, subtitle, amountCents, bizumReceivers, onDone, onClose,
}: Common & {
  voucherId:    string;
  amountCents:  number;
  /** Con el módulo Cuentas: los socios activos, para el receptor de un Bizum. */
  bizumReceivers?: ClubPartner[];
}) {
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");
  const [receiver, setReceiver] = useState<BizumReceiver>(undefined);
  const askReceiver = method === "BIZUM" && bizumReceivers !== undefined;

  const pay = useMutation({
    mutationFn: () =>
      askReceiver
        ? clubVouchersService.setPayment(clubId, voucherId, method as CounterPaymentMethod, receiver as string | null)
        : clubVouchersService.setPayment(clubId, voucherId, method as CounterPaymentMethod),
    onSuccess: () => {
      toast.success("Bono cobrado");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!pay.isPending) onClose(); };

  return (
    <SchoolDialog title="Cobrar bono" onClose={close} busy={pay.isPending}>
      <p className="text-sm text-muted-foreground">
        {subtitle} · <strong className="text-foreground">{formatCents(amountCents)}</strong>
      </p>
      <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
      {askReceiver && (
        <BizumReceiverPicker partners={bizumReceivers} value={receiver} onChange={setReceiver} disabled={pay.isPending} />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={pay.isPending}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={method === "" || (askReceiver && receiver === undefined) || pay.isPending}
          onClick={() => pay.mutate()}
        >
          {pay.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
          Cobrar
        </Button>
      </div>
    </SchoolDialog>
  );
}

type Mode = "counter" | "voucher";

/** Cobrar a un alumno de una clase privada: en el mostrador o con un bono de clases privadas suyo. */
export function SchoolStudentPayDialog({
  clubId, classId, studentId, subtitle, priceCents, timeZone, bizumReceivers, onDone, onClose,
}: Common & {
  classId:      string;
  studentId:    string;
  priceCents:   number;
  timeZone:     string;
  /** Con el módulo Cuentas: los socios activos, para el receptor de un Bizum. */
  bizumReceivers?: ClubPartner[];
}) {
  const [mode, setMode] = useState<Mode>("counter");
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");
  const [receiver, setReceiver] = useState<BizumReceiver>(undefined);
  const [voucherId, setVoucherId] = useState("");
  const askReceiver = mode === "counter" && method === "BIZUM" && bizumReceivers !== undefined;

  const vouchers = useQuery({
    queryKey: schoolBillingQK.classVouchers(clubId, classId, studentId),
    queryFn: () => schoolBillingService.privateClasses.vouchers(clubId, classId, studentId),
    enabled: mode === "voucher",
  });

  const pay = useMutation({
    mutationFn: () =>
      mode === "voucher"
        ? schoolBillingService.privateClasses.pay(clubId, classId, studentId, { voucherId })
        : schoolBillingService.privateClasses.pay(clubId, classId, studentId, {
            paymentMethod: method,
            ...(askReceiver ? { bizumPartnerId: receiver as string | null } : {}),
          }),
    onSuccess: () => {
      toast.success(mode === "voucher" ? "Clase pagada con bono" : "Clase cobrada");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const close = () => { if (!pay.isPending) onClose(); };
  const list = vouchers.data ?? [];
  const canPay =
    !pay.isPending && (mode === "voucher" ? voucherId !== "" : method !== "" && (!askReceiver || receiver !== undefined));

  return (
    <SchoolDialog title="Cobrar clase privada" onClose={close} busy={pay.isPending}>
      <p className="text-sm text-muted-foreground">
        {subtitle} · <strong className="text-foreground">{formatCents(priceCents)}</strong>
      </p>

      <div role="group" aria-label="Cómo se cobra" className="grid grid-cols-2 gap-2">
        {(
          [
            ["counter", "En el mostrador"],
            ["voucher", "Con bono"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            disabled={pay.isPending}
            onClick={() => setMode(value)}
            className={`rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
              mode === value
                ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "counter" ? (
        <>
          <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
          {askReceiver && (
            <BizumReceiverPicker partners={bizumReceivers} value={receiver} onChange={setReceiver} disabled={pay.isPending} />
          )}
        </>
      ) : vouchers.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : vouchers.isError ? (
        <p className="text-sm text-destructive">No se han podido cargar los bonos del alumno.</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          El alumno no tiene ningún bono de clases privadas con sesiones, sin cancelar y que valga para la fecha de
          esta clase. Se vende desde su ficha de cliente.
        </p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bono</legend>
          {list.map((v) => (
            <label key={v.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <input
                type="radio"
                name="school-voucher"
                value={v.id}
                checked={voucherId === v.id}
                onChange={() => setVoucherId(v.id)}
                disabled={pay.isPending}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{v.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {sessionsLabel(v)} · {expiryLabel(v.expiresAt, timeZone)}
                  {!v.paid && " · pendiente de cobro"}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={pay.isPending}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={!canPay} onClick={() => pay.mutate()}>
          {pay.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : mode === "voucher" ? (
            <Ticket className="h-3.5 w-3.5" />
          ) : (
            <CreditCard className="h-3.5 w-3.5" />
          )}
          {mode === "voucher" ? "Pagar con bono" : "Cobrar"}
        </Button>
      </div>
    </SchoolDialog>
  );
}
