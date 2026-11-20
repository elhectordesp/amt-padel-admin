"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ShopSalePayDialog } from "@/components/admin/shop-sale-pay-dialog";
import { cashQK } from "@/lib/services/cash";
import { shopQK, shopService, type ShopSale } from "@/lib/services/shop";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { formatCents } from "@/lib/utils/booking-price";
import {
  SALE_REASON_MAX, SALE_REASON_MIN, cancelNeedsAccounts, cancelSaleText, saleActions, saleNeedsReason,
  saleStatusInfo, saleTitle, shopErrorText,
} from "@/lib/utils/shop";
import { schoolInputCls } from "@/components/admin/school-dialog";

const TONE: Record<ReturnType<typeof saleStatusInfo>["tone"], string> = {
  paid:      "bg-green-500/15 text-green-600 dark:text-green-400",
  debt:      "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  pending:   "bg-red-500/15 text-red-600 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

interface Props {
  clubId:    string;
  sales:     ShopSale[];
  /** Quien solo lee no cobra ni anula. */
  canWrite:  boolean;
  /** Tras cobrar o anular: recargar lo que corresponda además de la tienda y la caja. */
  onChanged?: () => void;
}

/** Las ventas de la tienda, cada una con su estado y, si se puede, «Cobrar» y «Anular». */
export function ShopSaleList({ clubId, sales, canWrite, onChanged }: Props) {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<ShopSale | null>(null);
  const [cancelling, setCancelling] = useState<ShopSale | null>(null);
  const [reason, setReason] = useState("");
  const canAccounts = useClubAccess().can("accounts", "write");
  const { timeZone } = useClubTimeZone(clubId);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: shopQK.all(clubId) });
    qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
    onChanged?.();
  };
  const cancel = useMutation({
    mutationFn: (sale: ShopSale) =>
      shopService.sales.cancel(clubId, sale.id, saleNeedsReason(sale) ? reason.trim() : undefined),
    onSuccess: () => { toast.success("Venta anulada"); setCancelling(null); refresh(); },
    onError: (err: unknown) => { setCancelling(null); toast.error(shopErrorText(err)); },
  });

  return (
    <>
      <ul className="divide-y divide-border">
        {sales.map((s) => {
          const info = saleStatusInfo(s);
          // Una cobrada otro día se anula con el área «accounts»; la de hoy, con la caja
          const actions = saleActions(s);
          const canCancel = actions.cancel && (canAccounts || !cancelNeedsAccounts(s, timeZone));
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${info.tone === "cancelled" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {saleTitle(s)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.personName ? `${s.personName} · ` : ""}vendió {s.soldByName}
                  {s.refundAmountCents ? ` · devueltos ${formatCents(s.refundAmountCents)}` : ""}
                </p>
              </div>
              <span className={`rounded-md px-2 py-0.5 text-xs ${TONE[info.tone]}`}>{info.label}</span>
              {canWrite && actions.pay && (
                <button
                  type="button"
                  onClick={() => setPaying(s)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-secondary"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Cobrar
                </button>
              )}
              {canWrite && canCancel && (
                <button
                  type="button"
                  aria-label={`Anular ${saleTitle(s)}`}
                  onClick={() => { setReason(""); setCancelling(s); }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Ban className="h-3.5 w-3.5" /> Anular
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {paying && (
        <ShopSalePayDialog
          clubId={clubId}
          saleId={paying.id}
          subtitle={`${paying.quantity} × ${paying.productName}${paying.personName ? ` · ${paying.personName}` : ""}`}
          amountCents={paying.amountCents}
          onDone={onChanged}
          onClose={() => setPaying(null)}
        />
      )}
      <ConfirmModal
        open={cancelling !== null}
        title="Anular la venta"
        description={cancelling ? `${saleTitle(cancelling)}. ${cancelSaleText(cancelling)}` : ""}
        confirmLabel="Anular venta"
        danger
        loading={cancel.isPending}
        confirmDisabled={
          cancelling !== null && saleNeedsReason(cancelling) && reason.trim().length < SALE_REASON_MIN
        }
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
      >
        {cancelling && saleNeedsReason(cancelling) && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Motivo (queda en el historial)
            </span>
            <input
              type="text"
              aria-label="Motivo de la anulación"
              value={reason}
              maxLength={SALE_REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              className={`w-full ${schoolInputCls}`}
            />
          </label>
        )}
      </ConfirmModal>
    </>
  );
}
