"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { BizumReceiverPicker, type BizumReceiver } from "@/components/admin/bizum-receiver";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { accountsQK, accountsService } from "@/lib/services/accounts";
import { cashQK } from "@/lib/services/cash";
import type { ClubCustomer } from "@/lib/services/club-customers";
import { shopQK, shopService, type SalePayment } from "@/lib/services/shop";
import { formatCents } from "@/lib/utils/booking-price";
import { PAYMENT_METHOD_OPTIONS, type CounterPaymentMethod } from "@/lib/utils/payment-methods";
import { SALE_MAX_QUANTITY, lowStockThreshold, saleStockWarning, shopErrorText, stockAfterWarning } from "@/lib/utils/shop";

type Way = CounterPaymentMethod | "DEBT" | "PENDING";

interface Props {
  clubId:     string;
  /** Vender dentro de una reserva: se ve en su ficha y admite «Pendiente» para cobrarlo al final. */
  bookingId?: string;
  /**
   * La reserva tiene cliente del club: si no se elige a nadie, «Debe» lo apunta a él. Sin cliente
   * (la reservó un jugador de la app o no consta), «Debe» pide elegir a alguien.
   */
  bookingHasCustomer?: boolean;
  /** Tras vender: recargar lo que corresponda además de la tienda y la caja. */
  onDone?:    () => void;
  onClose:    () => void;
}

const CHOICE = "min-h-11 rounded-md border px-3 text-sm font-medium transition-colors disabled:opacity-50";
const ON = "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border-[rgba(212,175,55,0.4)]";
const OFF = "bg-secondary text-muted-foreground border-border hover:border-[rgba(212,175,55,0.3)] hover:text-foreground";

/**
 * «Vender»: los productos activos en botones grandes, la cantidad con + y −,
 * quién compra (opcional) y cómo se cobra: método, «Debe» o, dentro de una
 * reserva, «Pendiente». Avisa si no queda stock, pero deja vender.
 */
export function ShopSellDialog({ clubId, bookingId, bookingHasCustomer = false, onDone, onClose }: Props) {
  const qc = useQueryClient();
  const [productId, setProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState<ClubCustomer | null>(null);
  const [label, setLabel] = useState("");
  const [way, setWay] = useState<Way | "">("");
  const [receiver, setReceiver] = useState<BizumReceiver>(undefined);

  const products = useQuery({
    queryKey: shopQK.products(clubId),
    queryFn: () => shopService.products.list(clubId),
  });
  const partners = useQuery({
    queryKey: accountsQK.partners(clubId),
    queryFn: () => accountsService.partners.list(clubId),
  });
  const active = (products.data ?? []).filter((p) => p.active);
  const product = active.find((p) => p.id === productId) ?? null;
  const warning = product ? saleStockWarning(product, quantity) : null;
  const total = product ? product.priceCents * quantity : 0;
  const personName = label.trim();

  const sell = useMutation({
    mutationFn: () => {
      const payment: SalePayment =
        way === "DEBT" ? { debt: true }
        : way === "PENDING" ? { pending: true }
        : { method: way as CounterPaymentMethod, ...(way === "BIZUM" ? { bizumPartnerId: receiver as string | null } : {}) };
      return shopService.sales.sell(clubId, {
        productId: productId as string,
        quantity,
        ...(bookingId ? { bookingId } : {}),
        ...(customer ? { clubCustomerId: customer.id } : personName ? { label: personName } : {}),
        payment,
      });
    },
    onSuccess: (res) => {
      toast.success(`Vendido: ${res.sale.quantity} × ${res.sale.productName} · ${formatCents(res.sale.amountCents)}`);
      const after = product ? stockAfterWarning(product.name, res.stockAfter, lowStockThreshold(product)) : null;
      if (after) toast.warning(after);
      qc.invalidateQueries({ queryKey: shopQK.all(clubId) });
      qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
      onDone?.();
      onClose();
    },
    onError: (err: unknown) => toast.error(shopErrorText(err)),
  });

  const close = () => { if (!sell.isPending) onClose(); };
  // A deber no sabe quién debe si no se elige a nadie y no hay un cliente de la reserva al que apuntarlo
  const debtFallsOnBooking = bookingId !== undefined && bookingHasCustomer;
  const needsPerson = way === "DEBT" && !debtFallsOnBooking && !customer && personName === "";
  const needsReceiver = way === "BIZUM" && (receiver === undefined || partners.data === undefined);
  const canSell = product !== null && way !== "" && !needsPerson && !needsReceiver && !sell.isPending;

  // Por qué «Cobrar» está apagado, a la vista (no solo un botón gris)
  const blockedReason =
    product === null ? null
    : way === "" ? "Elige cómo paga"
    : needsPerson ? "Falta indicar quién debe"
    : needsReceiver ? "Elige a qué móvil llegó el Bizum"
    : null;

  const submitLabel = way === "DEBT" ? "Dejar a deber" : way === "PENDING" ? "Dejar pendiente" : "Cobrar";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div role="dialog" aria-label="Vender" className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-lg text-foreground">Vender{bookingId ? " en esta reserva" : ""}</h2>
          <button onClick={close} disabled={sell.isPending} aria-label="Cerrar" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-40">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {products.isError ? (
            <p role="alert" className="text-sm text-destructive">No se pudieron cargar los productos.</p>
          ) : !products.data ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : active.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay productos activos. Se dan de alta en Cuentas → Tienda.
            </p>
          ) : (
            <div role="group" aria-label="Producto" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {active.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={productId === p.id}
                  onClick={() => setProductId(p.id)}
                  className={`min-h-16 rounded-lg border px-3 py-2 text-left transition-colors ${productId === p.id ? ON : OFF}`}
                >
                  <span className="block text-sm font-semibold text-foreground">{p.name}</span>
                  <span className="block text-xs">{formatCents(p.priceCents)}</span>
                  {p.stock !== null && (
                    <span className={`block text-xs ${p.lowStock ? "text-amber-500" : ""}`}>
                      {p.stock <= 0 ? "Sin stock" : `Quedan ${p.stock}`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {product && (
            <>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cantidad</span>
                <button
                  type="button"
                  aria-label="Una menos"
                  disabled={quantity <= 1 || sell.isPending}
                  onClick={() => setQuantity((q) => q - 1)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span aria-label="Cantidad" className="w-8 text-center text-lg font-semibold tabular-nums">{quantity}</span>
                <button
                  type="button"
                  aria-label="Una más"
                  disabled={quantity >= SALE_MAX_QUANTITY || sell.isPending}
                  onClick={() => setQuantity((q) => q + 1)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="ml-auto text-lg font-semibold text-[#D4AF37]">{formatCents(total)}</span>
              </div>

              {warning && (
                <p role="status" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {warning.text}
                </p>
              )}

              <div className="space-y-2">
                <BookingCustomerPicker clubId={clubId} value={customer} onChange={setCustomer} />
                {!customer && (
                  <input
                    type="text"
                    aria-label="Nombre de quien compra"
                    placeholder="O un nombre, si no es cliente (opcional)"
                    value={label}
                    maxLength={80}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                )}
              </div>

              <div role="group" aria-label="Cómo se cobra">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cobro</span>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <button key={o.value} type="button" aria-pressed={way === o.value} disabled={sell.isPending} onClick={() => setWay(o.value)} className={`${CHOICE} ${way === o.value ? ON : OFF}`}>
                      {o.label}
                    </button>
                  ))}
                  <button type="button" aria-pressed={way === "DEBT"} disabled={sell.isPending} onClick={() => setWay("DEBT")} className={`${CHOICE} ${way === "DEBT" ? ON : OFF}`}>
                    Debe
                  </button>
                  {bookingId && (
                    <button type="button" aria-pressed={way === "PENDING"} disabled={sell.isPending} onClick={() => setWay("PENDING")} className={`${CHOICE} ${way === "PENDING" ? ON : OFF}`}>
                      Pendiente
                    </button>
                  )}
                </div>
                {way === "DEBT" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {debtFallsOnBooking
                      ? "Debe quien elijas arriba; si no eliges a nadie, debe quien reservó."
                      : "Elige quién debe: un cliente o un nombre."}
                  </p>
                )}
                {way === "PENDING" && (
                  <p className="mt-2 text-xs text-muted-foreground">Se cobra al final, desde la ficha de la reserva o en «Pendiente de cobro».</p>
                )}
              </div>

              {way === "BIZUM" && partners.data && (
                <BizumReceiverPicker partners={partners.data.filter((p) => p.active)} value={receiver} onChange={setReceiver} disabled={sell.isPending} />
              )}
            </>
          )}
        </div>

        {blockedReason && (
          <p aria-live="polite" className="border-t border-border px-5 pt-3 text-sm font-medium text-amber-600 dark:text-amber-400">
            {blockedReason}
          </p>
        )}
        <div className={`flex gap-3 px-5 py-4 ${blockedReason ? "" : "border-t border-border"}`}>
          <button
            onClick={close}
            disabled={sell.isPending}
            className="flex-1 rounded-md border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() => sell.mutate()}
            disabled={!canSell}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#D4AF37] py-2 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#C49F2A] disabled:opacity-60"
          >
            {sell.isPending ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><ShoppingBag size={14} /> {submitLabel}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
