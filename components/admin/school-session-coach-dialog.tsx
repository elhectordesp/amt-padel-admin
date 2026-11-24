"use client";

/**
 * «Entrenador de la clase» (F8-C3): quién da esta clase en concreto, que puede
 * no ser el del grupo (una sustitución). De ahí salen las horas que se le pagan
 * al entrenador. Cambiar el entrenador del grupo no toca las sustituciones ya
 * puestas ni las clases pasadas.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { invalidateSchool, schoolQK, schoolService } from "@/lib/services/school";
import type { SchoolSession } from "@/types/school";

export function SchoolSessionCoachDialog({
  clubId, session, onClose,
}: {
  clubId:  string;
  session: Pick<SchoolSession, "id" | "coachStaffId" | "coachName">;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [staffId, setStaffId] = useState(session.coachStaffId ?? "");

  const coaches = useQuery({
    queryKey: schoolQK.coaches(clubId),
    queryFn: () => schoolService.coaches.list(clubId),
  });

  // El actual, aunque ya no sea entrenador del equipo, para no perderlo de la lista
  const options = (coaches.data ?? []).map((c) => ({ value: c.staffId, label: c.name }));
  if (session.coachStaffId && !options.some((o) => o.value === session.coachStaffId)) {
    options.push({ value: session.coachStaffId, label: `${session.coachName ?? "Entrenador"} (ya no es entrenador)` });
  }

  const save = useMutation({
    mutationFn: () => schoolService.sessions.setCoach(clubId, session.id, staffId || null),
    onSuccess: () => {
      invalidateSchool(qc, clubId);
      toast.success("Entrenador de la clase cambiado");
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!save.isPending) onClose(); };

  return (
    <SchoolDialog title="Entrenador de la clase" onClose={close} busy={save.isPending}>
      <p className="text-sm text-muted-foreground">
        Elige quién da esta clase si no es el entrenador del grupo (una sustitución). Las horas que se le pagan salen de
        las clases que da.
      </p>
      <label className="block text-xs text-muted-foreground">
        Entrenador
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          disabled={save.isPending || coaches.isLoading}
          className={`${schoolInputCls} mt-1 w-full`}
        >
          <option value="">Sin entrenador</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={save.isPending || staffId === (session.coachStaffId ?? "")}
          onClick={() => save.mutate()}
        >
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Guardar
        </Button>
      </div>
    </SchoolDialog>
  );
}
