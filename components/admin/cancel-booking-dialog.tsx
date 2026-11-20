"use client";

/**
 * Confirmación de «Cancelar reserva», centrada en pantalla: antes se abría en
 * línea al final de la página (en la ficha, fuera de la ventana) y la
 * recepcionista creía que el botón no hacía nada. Sirve a la ficha y al
 * listado; se monta solo mientras está abierta, así que el motivo empieza
 * vacío cada vez.
 *
 * Una reserva cobrada en dinero deja apuntar lo que se devuelve al cliente
 * (opcional, como mucho lo cobrado): la caja lo resta el día de hoy y deja el
 * cobro en su día.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useMe } from "@/lib/use-me";
import { cancellationNoticeCount } from "@/lib/utils/booking-participants";
import { eurosToCents, formatCents } from "@/lib/utils/booking-price";
import { collectedCents } from "@/lib/utils/booking-refund";
import { formatInTimeZone, zonedTime } from "@/lib/utils/time-zone";
import type { Booking } from "@/types/bookings";

interface Props {
  booking: Booking;
  /** Zona del club: la hora de la reserva que se enseña para saber cuál se cancela. */
  timeZone: string;
  onClose: () => void;
}

export function CancelBookingDialog({ booking: b, timeZone, onClose }: Props) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [reason, setReason] = useState("");
  // Lo que se devuelve, en euros escritos; vacío, nada
  const [refund, setRefund] = useState("");
  // Sin cobro (o pagada con bono), 0: nada que devolver
  const collected = collectedCents(b) ?? 0;
  // Cobrada por partes, el back no devuelve la reserva entera: cada parte se devuelve en su hoja
  const hasPartsPaid = b.partsSummary != null && b.partsSummary.paid > 0;
  const canRefund = collected > 0 && !hasPartsPaid;
  const refundCents = refund.trim() === "" ? 0 : eurosToCents(refund);
  const refundError =
    !canRefund || refundCents === 0
      ? null
      : refundCents === null
        ? "Escribe un importe válido, p. ej. 12,50"
        : refundCents > collected
          ? `No puedes devolver más de lo cobrado (${formatCents(collected)})`
          : null;

  const cancel = useMutation({
    mutationFn: () =>
      refundCents
        ? bookingsService.bookings.cancel(b.id, reason || undefined, refundCents)
        : bookingsService.bookings.cancel(b.id, reason || undefined),
    onSuccess: () => {
      toast.success("Reserva cancelada — jugadores notificados");
      qc.invalidateQueries({ queryKey: bookingsQK.bookingDetail(b.id) });
      qc.invalidateQueries({ queryKey: ["bookings", "list"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error al cancelar";
      toast.error(msg);
    },
  });

  // Los que avisa el back: siguen en la reserva y tienen cuenta, menos quien
  // cancela. Sin saber aún quién es, no hay número (contaría al propio club)
  const noticeCount = me ? cancellationNoticeCount(b, me.id) : null;
  const notice =
    noticeCount === null
      ? "Se avisará por push y email a los jugadores con cuenta."
      : noticeCount === 0
        ? "No hay jugadores con cuenta a los que avisar."
        : `Se avisará por push y email a ${noticeCount === 1 ? "1 jugador" : `${noticeCount} jugadores`}.`;

  const day = formatInTimeZone(b.startsAt, timeZone, { weekday: "short", day: "numeric", month: "short" });
  const time = `${zonedTime(b.startsAt, timeZone)} - ${zonedTime(b.endsAt, timeZone)}`;

  return (
    <ConfirmModal
      open
      danger
      title="¿Cancelar esta reserva?"
      description={notice}
      confirmLabel="Sí, cancelar reserva"
      cancelLabel="No, volver"
      loading={cancel.isPending}
      onClose={onClose}
      onConfirm={() => {
        if (refundError) return;
        cancel.mutate();
      }}
    >
      <p className="text-sm font-medium text-foreground">
        {b.court?.name ?? "Pista"} · {day} · {time}
      </p>
      <input
        type="text"
        aria-label="Motivo de la cancelación"
        placeholder="Motivo (opcional, visible al jugador)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
      />
      {hasPartsPaid && (
        <p className="text-xs text-muted-foreground">
          Esta reserva se cobró por partes: el dinero que quieras devolver se apunta en cada parte, en su ficha.
        </p>
      )}
      {canRefund && (
        <div className="space-y-1">
          <label htmlFor="cancel-refund" className="block text-xs text-muted-foreground">
            Devolver al cliente (opcional). Cobrado: {formatCents(collected)}
          </label>
          <input
            id="cancel-refund"
            type="text"
            inputMode="decimal"
            aria-label="Importe a devolver"
            placeholder="0,00 €"
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          {refundError && (
            <p role="alert" className="text-xs text-destructive">
              {refundError}
            </p>
          )}
        </div>
      )}
    </ConfirmModal>
  );
}
