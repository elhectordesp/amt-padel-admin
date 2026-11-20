"use client";

import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/lib/services/admin";

/**
 * Si el club tiene encendido el módulo «Cuentas» (`Club.accountsEnabled`, lo
 * enciende AMT). Es la consulta del club de Mi club (`["my-club", clubId]`),
 * la misma que la zona horaria: no pide nada más. `known` es false mientras no
 * llega (o si falló): quien necesita decir «no está activado» espera a saberlo.
 */
export function useClubAccounts(clubId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: ["my-club", clubId],
    queryFn:  () => adminService.clubs.findOne(clubId!),
    enabled:  enabled && !!clubId,
  });
  return {
    on:      query.data?.accountsEnabled === true,
    known:   query.data !== undefined,
    isError: query.isLoadingError,
    refetch: query.refetch,
  };
}

/** Solo si está encendido; mientras no se sabe, false: el panel sigue como siempre. */
export function useAccountsEnabled(clubId: string | null, enabled = true): boolean {
  return useClubAccounts(clubId, enabled).on;
}
