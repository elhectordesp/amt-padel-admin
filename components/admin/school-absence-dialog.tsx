"use client";

/**
 * Avisar de que un alumno falta a una clase. Si avisa con la antelación que
 * fija el club, gana una recuperación para gastar en otra clase con hueco; con
 * menos, la ausencia se apunta pero no se recupera. La hora del aviso se puede
 * cambiar: quien avisó ayer y se apunta hoy gana por la hora en que avisó.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { invalidateSchool } from "@/lib/services/school";
import { schoolRecoveryService } from "@/lib/services/school-recovery";
import { sessionLabel } from "@/lib/utils/school";
import { earnsRecovery, expiryText, marginText } from "@/lib/utils/school-recovery";
import { toZonedDateTimeInput, zonedDateTimeToIso } from "@/lib/utils/time-zone";
import type { SchoolSession } from "@/types/school";

export function SchoolAbsenceDialog({
  clubId,
  session,
  student,
  noticeHours,
  timeZone,
  onClose,
}: {
  clubId: string;
  session: Pick<SchoolSession, "id" | "startsAt" | "endsAt">;
  student: { clubCustomerId: string; name: string | null };
  /** Horas de antelación del club; null si aún no se sabe (no se avisa del margen). */
  noticeHours: number | null;
  timeZone: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [noticedAt, setNoticedAt] = useState(() => toZonedDateTimeInput(new Date(), timeZone));

  const iso = zonedDateTimeToIso(noticedAt, timeZone);
  const noticed = iso ? new Date(iso) : null;
  const margin = noticed ? new Date(session.startsAt).getTime() - noticed.getTime() : null;

  const register = useMutation({
    mutationFn: () => {
      if (!iso) throw new Error("Escribe cuándo avisó el alumno");
      // Que no sea futura lo comprueba el back (con su reloj, no el del navegador)
      return schoolRecoveryService.absences.register(clubId, session.id, {
        clubCustomerId: student.clubCustomerId,
        noticedAt: iso,
      });
    },
    onSuccess: (result) => {
      invalidateSchool(qc, clubId);
      toast.success(
        result.credit
          ? `Ausencia avisada: gana una recuperación (vale hasta el ${expiryText(result.credit.expiresAt, timeZone)})`
          : "Ausencia avisada: avisó con poco margen, no gana recuperación",
      );
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <SchoolDialog title="Avisar de una ausencia" onClose={onClose} busy={register.isPending}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate();
        }}
        noValidate
        className="space-y-4"
      >
        <p className="text-sm">
          <span className="font-medium">{student.name ?? "El alumno"}</span> no vendrá a la clase del{" "}
          {sessionLabel(session, timeZone)}.
        </p>

        <label className="block text-xs text-muted-foreground">
          Cuándo avisó
          <input
            type="datetime-local"
            value={noticedAt}
            onChange={(e) => setNoticedAt(e.target.value)}
            className={`${schoolInputCls} mt-1 w-full`}
          />
        </label>

        {margin !== null && noticeHours !== null && noticed && (
          <p
            role="status"
            className={`rounded-md border px-3 py-2 text-sm ${
              earnsRecovery(session.startsAt, noticed, noticeHours)
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            {margin <= 0
              ? "El aviso es de después de que empezara la clase: no gana recuperación."
              : earnsRecovery(session.startsAt, noticed, noticeHours)
                ? `Avisa con ${marginText(margin)} de margen: gana una recuperación.`
                : `Avisa con ${marginText(margin)} de margen y el club pide ${noticeHours} h: no gana recuperación.`}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={register.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={register.isPending}>
            {register.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Avisar ausencia
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
