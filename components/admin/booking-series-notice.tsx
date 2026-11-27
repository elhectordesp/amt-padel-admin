"use client";

/**
 * En la ficha de una reserva que es de una reserva fija: de quién es, qué día y
 * hora, hasta cuándo, y el enlace a la reserva fija entera. Si no se pudo leer
 * la reserva fija, no estorba: la marca «Fija» de la cabecera ya lo dice.
 */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { bookingSeriesQK, bookingSeriesService } from "@/lib/services/booking-series";
import { seriesNoticeText } from "@/lib/utils/booking-series";

export function BookingSeriesNotice({ clubId, seriesId }: { clubId: string; seriesId: string }) {
  const query = useQuery({
    queryKey: bookingSeriesQK.detail(clubId, seriesId),
    queryFn: () => bookingSeriesService.detail(clubId, seriesId),
  });
  if (!query.data) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <Repeat className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>{seriesNoticeText(query.data)}</span>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <Link
        href={`/mi-club/reservas/fijas?serie=${seriesId}`}
        className="font-medium text-primary underline-offset-2 hover:underline max-[1024px]:py-2"
      >
        Ver
      </Link>
    </div>
  );
}
