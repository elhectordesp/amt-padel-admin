"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { BizumReceiverPicker, type BizumReceiver } from "@/components/admin/bizum-receiver";
import { AmountField, PaymentMethodPicker } from "@/components/admin/payment-fields";
import type { ClubPartner } from "@/lib/services/accounts";
import { formatCents } from "@/lib/utils/booking-price";
import { centsToEurosInput, eurosToCents, type CounterPaymentMethod } from "@/lib/utils/payment-methods";

interface Props {
  title:        string;
  /** Qué se cobra y a quién (reserva, inscripción…). */
  subtitle:     string;
  /** El importe que se propone, en céntimos; se puede cambiar. */
  defaultCents: number;
  /**
   * El tope del importe, en céntimos, si lo hay (p. ej. lo que falta de una
   * cuota: cobrar menos la deja parcial, más no se puede). Pasado, no se cobra.
   */
  maxCents?:    number;
  /**
   * Con el módulo Cuentas: los socios activos del club. Al elegir Bizum se
   * pregunta a qué móvil llegó (un socio o «Club») y se manda como tercer
   * argumento (solo con Bizum).
   */
  bizumReceivers?: ClubPartner[];
  /** Hace el cobro; si falla, el modal sigue abierto con lo escrito. */
  onSubmit:     (method: CounterPaymentMethod, amountCents: number, bizumPartnerId?: string | null) => Promise<unknown>;
  /** Tras cobrar: recargar lo que corresponda. */
  onDone:       () => void;
  onClose:      () => void;
}

/**
 * Cobro de un solo pago (una reserva o un jugador de una inscripción): el
 * método de la lista única y el importe. Lo usan el detalle de la reserva y la
 * caja; el modal de «Estado de pago» y «Cobrar pareja» llevan los mismos
 * campos (payment-fields.tsx).
 */
export default function CollectModal({ title, subtitle, defaultCents, maxCents, bizumReceivers, onSubmit, onDone, onClose }: Props) {
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");
  const [amount, setAmount] = useState(centsToEurosInput(defaultCents));
  const [receiver, setReceiver] = useState<BizumReceiver>(undefined);
  const cents = eurosToCents(amount);
  // Con el módulo encendido, un Bizum sin saber a qué móvil llegó no se guarda
  const askReceiver = method === "BIZUM" && bizumReceivers !== undefined;

  const saveMut = useMutation({
    mutationFn: () =>
      askReceiver
        ? onSubmit(method as CounterPaymentMethod, cents as number, receiver as string | null)
        : onSubmit(method as CounterPaymentMethod, cents as number),
    onSuccess: () => {
      toast.success("Cobrado");
      onDone();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo cobrar"),
  });

  // Mientras guarda no se cierra: la respuesta cerraría el modal que se abriera después
  const close = () => { if (!saveMut.isPending) onClose(); };
  const overMax = cents !== null && maxCents !== undefined && cents > maxCents;
  const canSave = method !== "" && cents !== null && !(maxCents !== undefined && cents === 0) && !overMax && (!askReceiver || receiver !== undefined) && !saveMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div role="dialog" aria-label={title} className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          </div>
          <button onClick={close} disabled={saveMut.isPending} aria-label="Cerrar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-40">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <PaymentMethodPicker value={method} onChange={setMethod} disabled={saveMut.isPending} />
          {askReceiver && (
            <BizumReceiverPicker partners={bizumReceivers} value={receiver} onChange={setReceiver} disabled={saveMut.isPending} />
          )}
          <AmountField value={amount} onChange={setAmount} invalid={cents === null || overMax} disabled={saveMut.isPending} />
          {overMax && maxCents !== undefined && (
            <p role="alert" className="-mt-2 text-xs text-destructive">
              No puede pasar de lo que falta por cobrar ({formatCents(maxCents)}).
            </p>
          )}
          {!overMax && maxCents !== undefined && cents !== null && cents > 0 && cents < maxCents && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Cobras una parte: quedarán {formatCents(maxCents - cents)} por cobrar.
            </p>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={close}
            disabled={saveMut.isPending}
            className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={!canSave}
            className="flex-1 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saveMut.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Guardando…</>
            ) : (
              <><CreditCard size={14} /> Cobrar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
