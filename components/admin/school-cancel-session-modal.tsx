"use client";

/**
 * Cancelar una clase de la escuela: queda cancelada y se libera su pista. Con
 * la casilla marcada (lo normal), cada alumno de su lista gana una clase para
 * recuperar; a quien se había apuntado a recuperar en ella se le devuelve su
 * crédito siempre.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { errorText } from "@/components/admin/price-seasons-panel";
import { invalidateSchool, schoolService } from "@/lib/services/school";
import { cancelRecoveriesText } from "@/lib/utils/school-recovery";
import { sessionLabel } from "@/lib/utils/school";
import type { SchoolSession } from "@/types/school";

export function SchoolCancelSessionModal({
  clubId,
  session,
  timeZone,
  onClose,
}: {
  clubId: string;
  session: Pick<SchoolSession, "id" | "startsAt" | "endsAt">;
  timeZone: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [grantRecovery, setGrantRecovery] = useState(true);

  const cancel = useMutation({
    mutationFn: () => schoolService.sessions.cancel(clubId, session.id, reason.trim() || undefined, grantRecovery),
    onSuccess: (result) => {
      invalidateSchool(qc, clubId);
      const recoveries = cancelRecoveriesText(result.recoveries);
      toast.success(`Clase cancelada: su pista queda libre${recoveries ? ` · ${recoveries}` : ""}`);
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <ConfirmModal
      open
      danger
      title="Cancelar la clase"
      description={`${sessionLabel(session, timeZone)}. La clase queda cancelada y se libera su pista. Lo que se apunte como motivo lo verá todo el equipo.`}
      confirmLabel="Cancelar clase"
      cancelLabel="Volver"
      loading={cancel.isPending}
      onClose={onClose}
      onConfirm={() => cancel.mutate()}
    >
      <label className="block text-xs text-muted-foreground">
        Motivo (opcional)
        <input
          type="text"
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lluvia, festivo, obras..."
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={grantRecovery}
          onChange={(e) => setGrantRecovery(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Dar recuperación a los alumnos
          <span className="block text-xs text-muted-foreground">
            Cada alumno de la lista gana una clase para recuperar. Quien se había apuntado a recuperar en esta clase
            recupera su crédito siempre.
          </span>
        </span>
      </label>
    </ConfirmModal>
  );
}
