"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { errorText } from "@/components/admin/price-seasons-panel";
import {
  clubVouchersQK,
  clubVouchersService,
} from "@/lib/services/club-vouchers";
import { expiryLabel, sessionsLabel } from "@/lib/utils/voucher";

interface Props {
  clubId:    string;
  bookingId: string;
  /** Qué se paga (reserva, pista y hora). */
  subtitle:  string;
  /** Zona horaria del club: la caducidad se lee en ella. */
  timeZone:  string;
  /** Tras pagar: recargar lo que corresponda. */
  onDone:    () => void;
  onClose:   () => void;
}

/**
 * «Pagar con bono»: los bonos de su cliente con saldo, sin cancelar y vigentes
 * a la fecha de la reserva; se descuenta una sesión del elegido y la reserva
 * queda pagada (importe 0: el dinero entró al vender el bono). Un bono
 * pendiente de cobro también se puede gastar.
 */
export function PayWithVoucherModal({ clubId, bookingId, subtitle, timeZone, onDone, onClose }: Props) {
  const usable = useQuery({
    queryKey: clubVouchersQK.usable(clubId, bookingId),
    queryFn: () => clubVouchersService.booking.usable(clubId, bookingId),
  });
  // null: sin tocar. Con un solo bono que sirva, ya sale elegido
  const [picked, setPicked] = useState<string | null>(null);
  const vouchers = usable.data ?? [];
  const voucherId = picked ?? (vouchers.length === 1 ? vouchers[0].id : "");

  const pay = useMutation({
    mutationFn: () => clubVouchersService.booking.use(clubId, bookingId, voucherId),
    onSuccess: () => {
      toast.success("Reserva pagada con bono");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  // Mientras guarda no se cierra: la respuesta cerraría el modal que se abriera después
  const close = () => { if (!pay.isPending) onClose(); };
  const canPay = voucherId !== "" && !pay.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div role="dialog" aria-label="Pagar con bono" className="relative flex w-full max-w-sm flex-col rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">Pagar con bono</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            onClick={close}
            disabled={pay.isPending}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-40"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          {usable.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : usable.isError ? (
            <p className="text-sm text-destructive">No se han podido cargar los bonos del cliente.</p>
          ) : vouchers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              El cliente no tiene ningún bono con sesiones, sin cancelar y que valga para la fecha de
              esta reserva.
            </p>
          ) : (
            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bono
              </legend>
              {vouchers.map((v) => (
                <label key={v.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="voucher"
                    value={v.id}
                    checked={voucherId === v.id}
                    onChange={() => setPicked(v.id)}
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
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={close}
            disabled={pay.isPending}
            className="flex-1 rounded-md border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() => pay.mutate()}
            disabled={!canPay}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#D4AF37] py-2 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#C49F2A] disabled:opacity-60"
          >
            {pay.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Guardando…</>
            ) : (
              <><Ticket size={14} /> Pagar con bono</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
