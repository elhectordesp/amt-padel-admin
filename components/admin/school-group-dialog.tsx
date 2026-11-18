"use client";

/**
 * Alta y edición de un grupo de la escuela: nombre, nivel, entrenador (del
 * equipo con rol de entrenador), plazas, temporada y horario semanal con la
 * pista preferida de cada franja. Al guardar puede generar (o regenerar) las
 * clases de la temporada: el sistema reserva la pista de cada una.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";
import { invalidateSchool, schoolQK, schoolService } from "@/lib/services/school";
import {
  SCHOOL_MAX_SLOTS,
  WEEKDAYS,
  checkGroupForm,
  emptyGroupForm,
  generateSummaryText,
  groupFormOf,
  newSlotForm,
  scheduleChanged,
  type GroupFormValues,
  type SlotFormValues,
} from "@/lib/utils/school";
import type { GenerateSessionsResult, SchoolGroupDetail } from "@/types/school";

export function SchoolGroupDialog({
  clubId,
  group,
  onClose,
  onSaved,
}: {
  clubId: string;
  /** El grupo que se edita; sin él, uno nuevo. */
  group?: SchoolGroupDetail | null;
  onClose: () => void;
  onSaved: (groupId: string) => void;
}) {
  const qc = useQueryClient();
  const editing = !!group;
  const [form, setForm] = useState<GroupFormValues>(() => (group ? groupFormOf(group) : emptyGroupForm()));
  const [generate, setGenerate] = useState(true);

  const coaches = useQuery({
    queryKey: schoolQK.coaches(clubId),
    queryFn: () => schoolService.coaches.list(clubId),
  });
  const courts = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId),
  });

  const coachOptions = [...(coaches.data ?? []).map((c) => ({ value: c.staffId, label: c.name }))];
  if (group?.coach && !coachOptions.some((o) => o.value === group.coach!.staffId)) {
    coachOptions.push({ value: group.coach.staffId, label: `${group.coach.name} (ya no es entrenador)` });
  }

  const setSlot = (key: string, patch: Partial<SlotFormValues>) =>
    setForm((f) => ({ ...f, slots: f.slots.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));

  const save = useMutation({
    mutationFn: async () => {
      const checked = checkGroupForm(form);
      if (!checked.ok) throw new Error(checked.message);
      const saved = group
        ? await schoolService.groups.update(clubId, group.id, checked.value)
        : await schoolService.groups.create(clubId, checked.value);
      const mustGenerate = generate && (!group || scheduleChanged(group, checked.value));
      let generated: GenerateSessionsResult | null = null;
      let generateError: string | null = null;
      if (mustGenerate) {
        try {
          generated = await schoolService.sessions.generate(clubId, saved.id);
        } catch (err) {
          // El grupo ya está guardado: se avisa de lo que falló sin perder lo hecho
          generateError = errorText(err);
        }
      }
      return { saved, generated, generateError };
    },
    onSuccess: ({ saved, generated, generateError }) => {
      invalidateSchool(qc, clubId);
      toast.success(editing ? "Grupo guardado" : "Grupo creado");
      if (generated) {
        const text = generateSummaryText(generated);
        if (generated.withoutCourt > 0) toast.warning(text);
        else toast.success(text);
      }
      if (generateError) {
        toast.error(`El grupo se ha guardado, pero no se han podido generar las clases: ${generateError}`);
      }
      onSaved(saved.id);
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const checked = checkGroupForm(form);
    if (!checked.ok) {
      toast.error(checked.message);
      return;
    }
    save.mutate();
  };

  return (
    <SchoolDialog title={editing ? "Editar grupo" : "Nuevo grupo"} onClose={onClose} busy={save.isPending} wide>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">
            Nombre del grupo
            <input
              type="text"
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Iniciación martes y jueves"
              className={`${schoolInputCls} mt-1 w-full`}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Nivel (opcional)
            <input
              type="text"
              maxLength={40}
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              placeholder="Iniciación, intermedio..."
              className={`${schoolInputCls} mt-1 w-full`}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Entrenador
            <select
              value={form.coachStaffId}
              onChange={(e) => setForm({ ...form, coachStaffId: e.target.value })}
              className={`${schoolInputCls} mt-1 w-full`}
            >
              <option value="">Sin entrenador</option>
              {coachOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">
            Plazas
            <input
              type="number"
              min={1}
              max={40}
              value={form.maxStudents}
              onChange={(e) => setForm({ ...form, maxStudents: e.target.value })}
              className={`${schoolInputCls} mt-1 w-full`}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Inicio de la temporada
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className={`${schoolInputCls} mt-1 w-full`}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Fin de la temporada
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className={`${schoolInputCls} mt-1 w-full`}
            />
          </label>
        </div>
        {!coaches.isLoading && coachOptions.length === 0 && (
          <p className="-mt-2 text-xs text-muted-foreground">
            Aún no hay nadie con el rol de entrenador en el equipo del club: se asigna desde Equipo.
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Horario semanal
          </legend>
          {form.slots.map((s, index) => (
            <div
              key={s.key}
              role="group"
              aria-label={`Franja ${index + 1}`}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto]"
            >
              <label className="block text-xs text-muted-foreground">
                Día
                <select
                  value={s.weekday}
                  onChange={(e) => setSlot(s.key, { weekday: e.target.value })}
                  className={`${schoolInputCls} mt-1 w-full`}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Hora
                <input
                  type="time"
                  value={s.startTime}
                  onChange={(e) => setSlot(s.key, { startTime: e.target.value })}
                  className={`${schoolInputCls} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Duración (min)
                <input
                  type="number"
                  min={15}
                  max={240}
                  step={15}
                  value={s.durationMinutes}
                  onChange={(e) => setSlot(s.key, { durationMinutes: e.target.value })}
                  className={`${schoolInputCls} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Pista preferida
                <select
                  value={s.preferredCourtId}
                  onChange={(e) => setSlot(s.key, { preferredCourtId: e.target.value })}
                  className={`${schoolInputCls} mt-1 w-full`}
                >
                  <option value="">La primera libre</option>
                  {(courts.data ?? [])
                    .filter((c) => c.active || c.id === s.preferredCourtId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={form.slots.length === 1}
                onClick={() => setForm((f) => ({ ...f, slots: f.slots.filter((x) => x.key !== s.key) }))}
                aria-label={`Quitar la franja ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={form.slots.length >= SCHOOL_MAX_SLOTS}
            onClick={() => setForm((f) => ({ ...f, slots: [...f.slots, newSlotForm()] }))}
          >
            <Plus className="h-3.5 w-3.5" /> Añadir franja
          </Button>
        </fieldset>

        <label className="block text-xs text-muted-foreground">
          Notas (opcional)
          <textarea
            rows={2}
            maxLength={1000}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={`${schoolInputCls} mt-1 w-full`}
          />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={generate}
            onChange={(e) => setGenerate(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {editing
              ? "Si cambio el horario o las fechas, regenerar las clases futuras"
              : "Generar ahora las clases de la temporada y reservar sus pistas"}
            <span className="block text-xs text-muted-foreground">
              {editing
                ? "Se rehacen las clases futuras sin asistencia (también las que hayas movido a mano). No se tocan las pasadas, las canceladas ni las que ya tienen asistencia."
                : "Se crea una clase por franja y semana hasta el fin de la temporada, saltando los días que el club cierra."}
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editing ? "Guardar grupo" : "Crear grupo"}
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
