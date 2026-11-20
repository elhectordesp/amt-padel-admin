"use client";

import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";

/**
 * Si se puede vender en la tienda: el módulo Cuentas encendido y permiso de
 * escritura en la caja (recepción vende; quien solo lee, no).
 */
export function useShopAccess(clubId: string | null): boolean {
  const accountsOn = useAccountsEnabled(clubId);
  const { can } = useClubAccess();
  return accountsOn && can("cash", "write");
}
