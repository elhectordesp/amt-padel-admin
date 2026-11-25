"use client";

import { useQuery } from "@tanstack/react-query";
import { accountsQK, accountsService, type ClubPartner } from "@/lib/services/accounts";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";

/**
 * Con el módulo Cuentas encendido, los socios activos del club: a cuyo móvil puede llegar un Bizum.
 * `undefined` si el módulo está apagado o los socios aún no han llegado; entonces el cobro no pregunta
 * el receptor (el selector es el de `BizumReceiverPicker`).
 */
export function useBizumReceivers(clubId: string | null): ClubPartner[] | undefined {
  const accountsOn = useAccountsEnabled(clubId);
  const partners = useQuery({
    queryKey: accountsQK.partners(clubId ?? ""),
    queryFn: () => accountsService.partners.list(clubId as string),
    enabled: accountsOn && !!clubId,
  });
  return accountsOn && partners.data ? partners.data.filter((p) => p.active) : undefined;
}
