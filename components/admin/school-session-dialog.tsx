"use client";

/**
 * Cambiar la pista, el día o la hora de una clase. El back comprueba que la
 * pista esté libre (bloqueos, partidos de torneo y reservas) y, si no, dice
 * quién la ocupa. «Sin pista» libera la pista de la clase.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";
import { invalidateSchool, schoolService } from "@/lib/services/school";
import { SCHOOL_MAX_DURATION, SCHOOL_MIN_DURATION, sessionDuration, sessionLabel } from "@/lib/utils/school";
import { zonedDayKey, zonedTime } from "@/lib/utils/time-zone";
import type { SchoolGroupSession, UpdateSchoolSessionPayload } from "@/types/school";

export function SchoolSessionDialog({
  clubId,
  session,
  timeZone,
  onClose,
}: {
  clubId: string;
  session: SchoolGroupSession;
  timeZone: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const initial = {
    courtId: session.court?.id ?? "",
    date: zonedDayKey(session.startsAt, timeZone),
    startTime: zonedTime(session.startsAt, timeZone),
    duration: String(sessionDuration(session, timeZone)),
  };
  const [form, setForm] = useState(initial);

  const courts = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId),
  });

  const save = useMutation({
    mutationFn: () => {
      const duration = Number(form.duration);
      if (!form.date) throw new Error("Elige el día de la clase");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.startTime)) throw new Error("Escribe la hora de inicio (HH:MM)");
      if (!Number.isInteger(duration) || duration < SCHOOL_MIN_DURATION || duration > SCHOOL_MAX_DURATION) {
        throw new Error(`La duración tiene que estar entre ${SCHOOL_MIN_DURATION} y ${SCHOOL_MAX_DURATION} minutos`);
      }
      const payload: UpdateSchoolSessionPayload = {};
      if (form.courtId !== initial.courtId) payload.courtId = form.courtId || null;
      if (form.date !== initial.date) payload.date = form.date;
      if (form.startTime !== initial.startTime) payload.startTime = form.startTime;
      if (String(duration) !== initial.duration) payload.durationMinutes = duration;
      if (Object.keys(payload).length === 0) throw new Error("No has cambiado nada");
      return schoolService.sessions.update(clubId, session.id, payload);
    },
    onSuccess: () => {
      invalidateSchool(qc, clubId);
      toast.success("Clase actualizada");
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const courtOptions = (courts.data ?? []).filter((c) => c.active || c.id === initial.courtId);

  return (
    <SchoolDialog title="Cambiar la clase" onClose={onClose} busy={save.isPending}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        noValidate
        className="space-y-4"
      >
        <p className="text-sm text-muted-foreground">{sessionLabel(session, timeZone)}</p>

        <label className="block text-xs text-muted-foreground">
          Pista
          <select
            value={form.courtId}
            onChange={(e) => setForm({ ...form, courtId: e.target.value })}
            className={`${schoolInputCls} mt-1 w-full`}
          >
            <option value="">Sin pista</option>
            {courtOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-3 block text-xs text-muted-foreground sm:col-span-1">
            Día
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={`${schoolInputCls} mt-1 w-full`}
            />
          </label>
          <label className="col-span-3 block text-xs text-muted-foreground sm:col-span-1">
            Hora
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className={`${schoolInputCls} mt-1 w-full`}
            />
          </label>
          <label className="col-span-3 block text-xs text-muted-foreground sm:col-span-1">
            Duración (min)
            <input
              type="number"
              min={SCHOOL_MIN_DURATION}
              max={SCHOOL_MAX_DURATION}
              step={15}
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className={`${schoolInputCls} mt-1 w-full`}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Si la pista está ocupada a esa hora, no se guarda y se dice quién la ocupa.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
