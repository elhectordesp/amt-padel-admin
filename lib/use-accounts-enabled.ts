"use client";

import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/lib/services/admin";

/**
 * Si el club tiene encendido el módulo «Cuentas» (`Club.accountsEnabled`, lo
 * enciende AMT). Es la consulta del club de Mi club (`["my-club", clubId]`):
 * mientras no se sabe, false (no se ofrece nada que dé 403).
 */
export function useAccountsEnabled(clubId: string | null): boolean {
  const query = useQuery({
    queryKey: ["my-club", clubId],
    queryFn:  () => adminService.clubs.findOne(clubId!),
    enabled:  !!clubId,
  });
  return (query.data as { accountsEnabled?: boolean } | undefined)?.accountsEnabled === true;
}
