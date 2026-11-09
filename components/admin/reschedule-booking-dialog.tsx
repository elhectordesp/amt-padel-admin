"use client";

/**
 * «Cambiar hora o pista» de una reserva: el club elige fecha, duración, pista
 * y hora entre los huecos libres (el de la propia reserva cuenta como libre) y
 * ve el precio nuevo antes de guardar. Los jugadores con cuenta reciben un
 * aviso. Se monta solo mientras está abierto, así que parte siempre de la
 * reserva tal como está.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { formatCents } from "@/lib/utils/booking-price";
import { zonedDayKey } from "@/lib/utils/time-zone";
import type { Booking } from "@/types/bookings";

interface Props {
  booking: Booking;
  /** Zona del club: el día y la hora de los huecos son los suyos. */
  timeZone: string;
  onClose: () => void;
}

const FIELD = "mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground";

/** «+3,00 €» / «−3,00 €» / «mismo precio» */
function differenceText(cents: number): string {
  if (cents === 0) return "mismo precio";
  return `${cents > 0 ? "+" : "−"}${formatCents(Math.abs(cents))}`;
}

export function RescheduleBookingDialog({ booking: b, timeZone, onClose }: Props) {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => zonedDayKey(b.startsAt, timeZone));
  const [duration, setDuration] = useState(b.durationMinutes);
  const [wantedCourtId, setWantedCourtId] = useState(b.courtId);
  const [wantedStartsAt, setWantedStartsAt] = useState(b.startsAt);

  const options = useQuery({
    queryKey: [...bookingsQK.bookingDetail(b.id), "reschedule-options", date, duration] as const,
    queryFn: () => bookingsService.bookings.rescheduleOptions(b.id, { date, durationMinutes: duration }),
    enabled: !!date,
  });

  const slots = useMemo(() => options.data?.slots ?? [], [options.data]);
  const courts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of slots) if (!seen.has(s.courtId)) seen.set(s.courtId, s.courtName);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [slots]);
  // La pista y la hora pedidas valen si siguen libres en este día y duración
  const courtId = courts.some((c) => c.id === wantedCourtId) ? wantedCourtId : "";
  const courtSlots = useMemo(() => slots.filter((s) => s.courtId === courtId), [slots, courtId]);
  const chosen = courtSlots.find((s) => s.startsAt === wantedStartsAt) ?? null;
  const durations = options.data?.durations ?? [b.durationMinutes];

  const save = useMutation({
    mutationFn: () =>
      bookingsService.bookings.update(b.id, {
        courtId: chosen!.courtId,
        startsAt: chosen!.startsAt,
        durationMinutes: chosen!.durationMinutes,
      }),
    onSuccess: ({ price }) => {
      if (price.kept && price.differenceCents !== 0) {
        toast.success(
          `Reserva cambiada. Estaba pagada y se queda en ${formatCents(price.previousCents)}; ` +
            `en el hueco nuevo costaría ${formatCents(price.newCents)} (${differenceText(price.differenceCents)}): ` +
            `arréglalo con el cliente.`,
          { duration: 10000 },
        );
      } else {
        toast.success("Reserva cambiada — jugadores avisados");
      }
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "No se ha podido cambiar la reserva";
      toast.error(msg);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bookingsQK.bookingDetail(b.id) });
      qc.invalidateQueries({ queryKey: ["bookings", "list"] });
    },
  });

  const unchanged =
    !!chosen && chosen.courtId === b.courtId && chosen.startsAt === b.startsAt && chosen.durationMinutes === b.durationMinutes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !save.isPending && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar hora o pista"
        className="relative w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg text-foreground">Cambiar hora o pista</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Elige el nuevo hueco. Se avisará a los jugadores con cuenta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-muted-foreground">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Duración</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={FIELD}>
              {[...new Set([...durations, duration])]
                .sort((x, y) => x - y)
                .map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
            </select>
          </label>
        </div>

        {options.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando huecos…
          </div>
        ) : options.isError ? (
          <p role="alert" className="text-sm text-destructive">
            No se han podido cargar los huecos. Cierra y vuelve a abrir.
          </p>
        ) : slots.length === 0 ? (
          <p className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-muted-foreground">
            No queda ningún hueco libre ese día con esa duración.
          </p>
        ) : (
          <>
            <label className="block">
              <span className="text-xs text-muted-foreground">Pista</span>
              <select
                value={courtId}
                onChange={(e) => setWantedCourtId(e.target.value)}
                className={FIELD}
              >
                <option value="">— elige una pista —</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Hora de inicio</span>
              <select
                value={chosen?.startsAt ?? ""}
                onChange={(e) => setWantedStartsAt(e.target.value)}
                disabled={!courtId}
                className={FIELD}
              >
                <option value="">{courtId ? "— elige una hora —" : "Primero elige la pista"}</option>
                {courtSlots.map((s) => (
                  <option key={s.startsAt} value={s.startsAt}>
                    {s.startsAtLocal}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {chosen && (
          <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
            <p>
              Precio en este hueco: <span className="font-medium">{formatCents(chosen.priceCents)}</span>{" "}
              <span className="text-muted-foreground">
                (ahora {formatCents(options.data!.currentPriceCents)} · {differenceText(chosen.differenceCents)})
              </span>
            </p>
            {options.data!.priceKept && chosen.differenceCents !== 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Está pagada: se queda en {formatCents(options.data!.currentPriceCents)} y la diferencia la arreglas con
                el cliente.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={save.isPending}>
            No cambiar
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => save.mutate()}
            disabled={!chosen || unchanged || save.isPending}
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar cambio
          </Button>
        </div>
      </div>
    </div>
  );
}
