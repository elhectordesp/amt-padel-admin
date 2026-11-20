"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingBag } from "lucide-react";
import { ShopSaleList } from "@/components/admin/shop-sale-list";
import { ShopSellDialog } from "@/components/admin/shop-sell-dialog";
import { Button } from "@/components/ui/button";
import { shopQK, shopService } from "@/lib/services/shop";
import { useShopAccess } from "@/lib/use-shop-access";

/** El botón «Vender» (y su diálogo) del calendario o mostrador; solo con permiso y el módulo encendido. */
export function ShopSellButton({ clubId, className }: { clubId: string; className?: string }) {
  const canSell = useShopAccess(clubId);
  const [open, setOpen] = useState(false);
  if (!canSell) return null;
  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <ShoppingBag className="mr-1.5 h-3.5 w-3.5" /> Vender
      </Button>
      {open && <ShopSellDialog clubId={clubId} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * La tienda en la caja del día: «Vender» y las ventas creadas ese día, con
 * «Cobrar» (las pendientes) y «Anular» para corregir una equivocación. Sin el
 * módulo Cuentas, o sin ventas y sin permiso para vender, no pinta nada.
 */
export function ShopDaySales({ clubId, date }: { clubId: string; date: string }) {
  const canSell = useShopAccess(clubId);
  const query = useQuery({
    queryKey: shopQK.sales(clubId, `day:${date}`),
    queryFn: () => shopService.sales.list(clubId, { date }),
    enabled: canSell,
  });
  if (!canSell) return null;
  const sales = query.data ?? [];

  return (
    <section aria-label="Tienda" className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Tienda del día</h3>
        <ShopSellButton clubId={clubId} />
      </div>
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">No se pudieron cargar las ventas del día.</p>
      ) : !query.data ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : sales.length === 0 ? (
        <p className="text-sm text-muted-foreground">No se ha vendido nada este día.</p>
      ) : (
        <ShopSaleList clubId={clubId} sales={sales} canWrite />
      )}
    </section>
  );
}
