"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingBag } from "lucide-react";
import { ErrorState } from "@/components/admin/error-state";
import { ShopSaleList } from "@/components/admin/shop-sale-list";
import { ShopSellDialog } from "@/components/admin/shop-sell-dialog";
import { Button } from "@/components/ui/button";
import { shopQK, shopService } from "@/lib/services/shop";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useShopAccess } from "@/lib/use-shop-access";
import type { BookingStatus } from "@/types/bookings";

interface Props {
  clubId:    string;
  bookingId: string;
  status:    BookingStatus;
  /** Tras vender, cobrar o anular: recargar la reserva y la caja. */
  onChanged: () => void;
}

/**
 * «Tienda» en la ficha de una reserva: lo vendido dentro de ella (bolas, grips...),
 * que se puede cobrar o anular, y «Vender en esta reserva». Solo con el módulo
 * Cuentas encendido; en una reserva cancelada solo se ve lo que hubo.
 */
export function BookingShopSales({ clubId, bookingId, status, onChanged }: Props) {
  const accountsOn = useAccountsEnabled(clubId);
  const canSell = useShopAccess(clubId);
  const [selling, setSelling] = useState(false);
  const query = useQuery({
    queryKey: shopQK.sales(clubId, `booking:${bookingId}`),
    queryFn: () => shopService.sales.list(clubId, { bookingId }),
    enabled: accountsOn,
  });
  if (!accountsOn) return null;
  const sales = query.data ?? [];
  // Sin permiso y sin nada vendido, la sección sobra
  if (!canSell && query.isSuccess && sales.length === 0) return null;
  const sellHere = canSell && status !== "CANCELLED";

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Tienda</h2>
        {sellHere && (
          <Button variant="outline" size="sm" onClick={() => setSelling(true)}>
            <ShoppingBag className="h-3.5 w-3.5" /> Vender en esta reserva
          </Button>
        )}
      </div>
      {query.isError ? (
        <ErrorState title="No se pudieron cargar las ventas" onRetry={() => query.refetch()} />
      ) : !query.data ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada vendido en esta reserva.</p>
      ) : (
        <ShopSaleList clubId={clubId} sales={sales} canWrite={canSell} onChanged={onChanged} />
      )}
      {selling && <ShopSellDialog clubId={clubId} bookingId={bookingId} onDone={onChanged} onClose={() => setSelling(false)} />}
    </div>
  );
}
