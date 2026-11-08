"use client";

import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/lib/services/admin";
import { tournamentTimeZone } from "@/lib/utils/time-zone";

/**
 * La zona horaria del club (`Club.timezone`): en ella van sus reservas (el
 * día de «hoy», las horas y las fechas que se enseñan o se mandan), como en
 * el back. Es la consulta del club de Mi club (`["my-club", clubId]`): al
 * cambiar allí la zona, se refresca también aquí.
 *
 * `timeZone` es null mientras no se sabe: quien la usa no pinta ninguna hora
 * con una zona supuesta, enseña que carga (o el error, si no llegó).
 */
export function useClubTimeZone(clubId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: ["my-club", clubId],
    queryFn:  () => adminService.clubs.findOne(clubId!),
    enabled:  enabled && !!clubId,
  });
  return {
    timeZone: query.data ? tournamentTimeZone(query.data) : null,
    // Solo si no llegó: un refresco que falla deja la zona que ya había
    isError:  query.isLoadingError,
    refetch:  query.refetch,
  };
}
