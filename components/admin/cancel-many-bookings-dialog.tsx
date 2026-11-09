"use client";

/**
 * Confirmación de «Cancelar seleccionadas (N)» del listado, con el motivo que
 * verán los jugadores. Se monta solo mientras está abierta (el motivo empieza
 * vacío cada vez). El resultado de cada reserva lo enseña el listado.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { bookingsService } from "@/lib/services/bookings";
import type { CancelManyResult } from "@/types/bookings";

interface Props {
  ids: string[];
  onDone: (result: CancelManyResult) => void;
  onClose: () => void;
}

export function CancelManyBookingsDialog({ ids, onDone, onClose }: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const cancel = useMutation({
    mutationFn: () => bookingsService.bookings.cancelMany(ids, reason.trim() || undefined),
    onSuccess: (result) => onDone(result),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "No se han podido cancelar las reservas";
      toast.error(msg);
    },
    // Aunque falle a medias, el listado se pone al día
    onSettled: () => qc.invalidateQueries({ queryKey: ["bookings", "list"] }),
  });

  const count = ids.length === 1 ? "1 reserva" : `${ids.length} reservas`;

  return (
    <ConfirmModal
      open
      danger
      title={`¿Cancelar ${count}?`}
      description="Se avisará por push y email a los jugadores con cuenta, con el motivo. No se puede deshacer."
      confirmLabel={`Sí, cancelar ${count}`}
      cancelLabel="No, volver"
      loading={cancel.isPending}
      onClose={onClose}
      onConfirm={() => cancel.mutate()}
    >
      <input
        type="text"
        aria-label="Motivo de la cancelación"
        placeholder="Motivo (p. ej. «Lluvia»; lo ven los jugadores)"
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
      />
    </ConfirmModal>
  );
}
