"use client";

/**
 * Cobros de la escuela: una cuota mensual o todas las pendientes de un mes (en el mostrador) y un alumno de una
 * clase privada (en el mostrador o con una sesión de un bono suyo de clases
 * privadas). Los usan las pestañas de Escuela y «Pendiente de cobro» de la
 * caja. El importe es el de la cuota o el del alumno: para cambiarlo se edita
 * antes, no al cobrar.
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { PaymentMethodPicker } from "@/components/admin/payment-fields";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { clubVouchersService } from "@/lib/services/club-vouchers";
import { schoolBillingQK, schoolBillingService } from "@/lib/services/school-billing";
import { formatCents } from "@/lib/utils/booking-price";
import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";
import { expiryLabel, sessionsLabel } from "@/lib/utils/voucher";

interface Common {
  clubId:   string;
  /** Qué se cobra y a quién. */
  subtitle: string;
  /** Tras cobrar: recargar lo que corresponda. */
  onDone:   () => void;
  onClose:  () => void;
}

/** Cobrar una cuota mensual: el método del mostrador. */
export function SchoolFeePayDialog({
  clubId, feeId, subtitle, amountCents, onDone, onClose,
}: Common & { feeId: string; amountCents: number }) {
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");

  const pay = useMutation({
    mutationFn: () => schoolBillingService.fees.pay(clubId, feeId, method),
    onSuccess: () => {
      toast.success("Cuota cobrada");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  // Mientras guarda no se cierra: la respuesta cerraría el diálogo que se abriera después
  const close = () => { if (!pay.isPending) onClose(); };

  return (
    <SchoolDialog title="Cobrar cuota" onClose={close} busy={pay.isPending}>
      <p className="text-sm text-muted-foreground">
        {subtitle} · <strong className="text-foreground">{formatCents(amountCents)}</strong>
      </p>
      <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={pay.isPending}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={method === "" || pay.isPending} onClick={() => pay.mutate()}>
          {pay.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
          Cobrar
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
  clubId, voucherId, subtitle, amountCents, onDone, onClose,
}: Common & { voucherId: string; amountCents: number }) {
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");

  const pay = useMutation({
    mutationFn: () => clubVouchersService.setPayment(clubId, voucherId, method as CounterPaymentMethod),
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={pay.isPending}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={method === "" || pay.isPending} onClick={() => pay.mutate()}>
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
  clubId, classId, studentId, subtitle, priceCents, timeZone, onDone, onClose,
}: Common & { classId: string; studentId: string; priceCents: number; timeZone: string }) {
  const [mode, setMode] = useState<Mode>("counter");
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");
  const [voucherId, setVoucherId] = useState("");

  const vouchers = useQuery({
    queryKey: schoolBillingQK.classVouchers(clubId, classId, studentId),
    queryFn: () => schoolBillingService.privateClasses.vouchers(clubId, classId, studentId),
    enabled: mode === "voucher",
  });

  const pay = useMutation({
    mutationFn: () =>
      mode === "voucher"
        ? schoolBillingService.privateClasses.pay(clubId, classId, studentId, { voucherId })
        : schoolBillingService.privateClasses.pay(clubId, classId, studentId, { paymentMethod: method }),
    onSuccess: () => {
      toast.success(mode === "voucher" ? "Clase pagada con bono" : "Clase cobrada");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const close = () => { if (!pay.isPending) onClose(); };
  const list = vouchers.data ?? [];
  const canPay = !pay.isPending && (mode === "voucher" ? voucherId !== "" : method !== "");

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
        <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
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
