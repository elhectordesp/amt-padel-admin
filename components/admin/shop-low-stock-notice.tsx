"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PackageMinus } from "lucide-react";
import { shopQK, shopService } from "@/lib/services/shop";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";

/**
 * «Stock bajo» de la portada: los productos activos de la tienda que están por
 * debajo de su aviso (el mínimo o, sin él, una caja). Solo con el módulo
 * Cuentas encendido y para quien lee el catálogo; sin avisos, no pinta nada.
 */
export function ShopLowStockNotice({ clubId }: { clubId: string }) {
  const accountsOn = useAccountsEnabled(clubId);
  const { can } = useClubAccess();
  const allowed = accountsOn && can("settings", "read");
  const query = useQuery({
    queryKey: shopQK.products(clubId),
    queryFn: () => shopService.products.list(clubId),
    enabled: allowed,
  });
  const low = (query.data ?? []).filter((p) => p.active && p.lowStock);
  if (!allowed || low.length === 0) return null;
  const canEdit = can("settings", "write");

  return (
    <section aria-label="Stock bajo" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="mb-2 flex items-center gap-2">
        <PackageMinus size={16} className="shrink-0 text-amber-500" />
        <h4 className="text-sm font-semibold text-foreground">Stock bajo</h4>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-foreground">
        {low.map((p) => (
          <li key={p.id}>
            {p.name}: <span className="font-semibold">{p.stock <= 0 ? "agotado" : `quedan ${p.stock}`}</span>
          </li>
        ))}
      </ul>
      {canEdit && (
        <Link href="/mi-club/cuentas" className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Apuntar una compra en Cuentas
        </Link>
      )}
    </section>
  );
}
