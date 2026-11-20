"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { BizumReceiverPicker, type BizumReceiver } from "@/components/admin/bizum-receiver";
import { PaymentMethodPicker } from "@/components/admin/payment-fields";
import { accountsQK, accountsService } from "@/lib/services/accounts";
import { cashQK } from "@/lib/services/cash";
import { shopQK, shopService } from "@/lib/services/shop";
import { formatCents } from "@/lib/utils/booking-price";
import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";
import { shopErrorText } from "@/lib/utils/shop";

interface Props {
  clubId:      string;
  saleId:      string;
  /** Qué se cobra y a quién («2 × Bolas · Ana»). */
  subtitle:    string;
  amountCents: number;
  /** Tras cobrar: recargar lo que corresponda además de la tienda y la caja. */
  onDone?:     () => void;
  onClose:     () => void;
}

/** Cobra una venta pendiente: método (y a qué móvil llegó un Bizum). El importe es el de la venta. */
export function ShopSalePayDialog({ clubId, saleId, subtitle, amountCents, onDone, onClose }: Props) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");
  const [receiver, setReceiver] = useState<BizumReceiver>(undefined);
  const partners = useQuery({
    queryKey: accountsQK.partners(clubId),
    queryFn: () => accountsService.partners.list(clubId),
  });

  const pay = useMutation({
    mutationFn: () =>
      shopService.sales.pay(clubId, saleId, {
        method: method as CounterPaymentMethod,
        ...(method === "BIZUM" ? { bizumPartnerId: receiver as string | null } : {}),
      }),
    onSuccess: () => {
      toast.success("Cobrado");
      qc.invalidateQueries({ queryKey: shopQK.all(clubId) });
      qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
      onDone?.();
      onClose();
    },
    onError: (err: unknown) => toast.error(shopErrorText(err)),
  });

  const close = () => { if (!pay.isPending) onClose(); };
  const askReceiver = method === "BIZUM";
  const blockedReason =
    method === "" ? "Elige cómo paga"
    : askReceiver && (receiver === undefined || partners.data === undefined) ? "Elige a qué móvil llegó el Bizum"
    : null;
  const canSave = method !== "" && (!askReceiver || (receiver !== undefined && partners.data !== undefined)) && !pay.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div role="dialog" aria-label="Cobrar la venta" className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">Cobrar {formatCents(amountCents)}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          </div>
          <button onClick={close} disabled={pay.isPending} aria-label="Cerrar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-40">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
          {askReceiver && partners.data && (
            <BizumReceiverPicker
              partners={partners.data.filter((p) => p.active)}
              value={receiver}
              onChange={setReceiver}
              disabled={pay.isPending}
            />
          )}
        </div>
        {blockedReason && (
          <p aria-live="polite" className="px-5 pb-3 text-sm font-medium text-amber-600 dark:text-amber-400">{blockedReason}</p>
        )}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={close}
            disabled={pay.isPending}
            className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() => pay.mutate()}
            disabled={!canSave}
            className="flex-1 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {pay.isPending ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><CreditCard size={14} /> Cobrar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
