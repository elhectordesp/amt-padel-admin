"use client";

/**
 * Alta y edición de una clase privada de la escuela: entrenador, pista, día,
 * hora y duración, y de 1 a 4 alumnos (clientes del club) con su precio. El
 * precio de cada alumno se propone con la tarifa del entrenador por las horas
 * de la clase, repartida entre los alumnos, y se puede cambiar. Un alumno ya
 * cobrado ni se quita ni cambia de precio: se le quita antes el cobro. La
 * pista la reserva el sistema (un bloqueo): si está ocupada, avisa.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";
import { schoolQK, schoolService } from "@/lib/services/school";
import { invalidateSchoolBilling, schoolBillingService } from "@/lib/services/school-billing";
import { formatCents } from "@/lib/utils/booking-price";
import { SCHOOL_MAX_DURATION, SCHOOL_MIN_DURATION } from "@/lib/utils/school";
import {
  SCHOOL_PRIVATE_CLASS_MAX_STUDENTS,
  checkPrivateClassForm,
  emptyPrivateClassForm,
  privateClassFormOf,
  proposedStudentPriceCents,
  withProposedPrices,
  type PrivateClassFormValues,
} from "@/lib/utils/school-billing";
import type { SchoolPrivateClass } from "@/types/school-billing";

export function SchoolPrivateClassDialog({
  clubId,
  timeZone,
  today,
  privateClass,
  onClose,
}: {
  clubId: string;
  timeZone: string;
  /** El día de hoy en la zona del club («AAAA-MM-DD»): el de una clase nueva. */
  today: string;
  /** La clase que se edita; sin ella, una nueva. */
  privateClass?: SchoolPrivateClass | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!privateClass;
  const [form, setForm] = useState<PrivateClassFormValues>(() =>
    privateClass ? privateClassFormOf(privateClass, timeZone) : emptyPrivateClassForm(today),
  );

  const coaches = useQuery({
    queryKey: schoolQK.coaches(clubId),
    queryFn: () => schoolService.coaches.list(clubId),
  });
  const courts = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId),
  });

  const coachList = coaches.data ?? [];
  const coachOptions = coachList.map((c) => ({ value: c.staffId, label: c.name }));
  if (privateClass?.coachStaffId && !coachOptions.some((o) => o.value === privateClass.coachStaffId)) {
    coachOptions.push({ value: privateClass.coachStaffId, label: `${privateClass.coachName ?? "Entrenador"} (ya no es entrenador)` });
  }
  const rateOf = (staffId: string) => coachList.find((c) => c.staffId === staffId)?.privateClassRateCents ?? null;
  const rate = rateOf(form.coachStaffId);

  /** Cambia el formulario y vuelve a proponer el precio de los alumnos que nadie ha tocado. */
  const change = (patch: Partial<PrivateClassFormValues>) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      return withProposedPrices(next, rateOf(next.coachStaffId));
    });

  const proposed = proposedStudentPriceCents(rate, Number(form.durationMinutes), form.students.length);

  const save = useMutation({
    mutationFn: () => {
      const checked = checkPrivateClassForm(form);
      if (!checked.ok) throw new Error(checked.message);
      return privateClass
        ? schoolBillingService.privateClasses.update(clubId, privateClass.id, checked.value)
        : schoolBillingService.privateClasses.create(clubId, checked.value);
    },
    onSuccess: () => {
      invalidateSchoolBilling(qc, clubId);
      toast.success(editing ? "Clase privada guardada" : "Clase privada creada: su pista queda reservada");
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const checked = checkPrivateClassForm(form);
    if (!checked.ok) {
      toast.error(checked.message);
      return;
    }
    save.mutate();
  };

  const close = () => { if (!save.isPending) onClose(); };
  const full = form.students.length >= SCHOOL_PRIVATE_CLASS_MAX_STUDENTS;

  return (
    <SchoolDialog title={editing ? "Editar clase privada" : "Nueva clase privada"} onClose={close} busy={save.isPending} wide>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">
            Entrenador
            <select
              value={form.coachStaffId}
              onChange={(e) => change({ coachStaffId: e.target.value })}
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
            Pista
            <select
              value={form.courtId}
              onChange={(e) => change({ courtId: e.target.value })}
              className={`${schoolInputCls} mt-1 w-full`}
            >
              <option value="">Elige una pista</option>
              {(courts.data ?? [])
                .filter((c) => c.active || c.id === form.courtId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">
            Día
            <input
              type="date"
              value={form.date}
              onChange={(e) => change({ date: e.target.value })}
              className={`${schoolInputCls} mt-1 w-full`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted-foreground">
              Hora
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => change({ startTime: e.target.value })}
                className={`${schoolInputCls} mt-1 w-full`}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Duración (min)
              <input
                type="number"
                min={SCHOOL_MIN_DURATION}
                max={SCHOOL_MAX_DURATION}
                step={15}
                value={form.durationMinutes}
                onChange={(e) => change({ durationMinutes: e.target.value })}
                className={`${schoolInputCls} mt-1 w-full`}
              />
            </label>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Alumnos ({form.students.length} de {SCHOOL_PRIVATE_CLASS_MAX_STUDENTS})
          </legend>
          {form.students.length === 0 && (
            <p className="text-sm text-muted-foreground">Busca a un cliente del club para añadirlo a la clase.</p>
          )}
          {form.students.map((s) => (
            <div
              key={s.clubCustomerId}
              role="group"
              aria-label={`Alumno ${s.name}`}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {s.name}
                {s.paid && <span className="ml-2 text-xs font-normal text-muted-foreground">Cobrado</span>}
              </span>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Precio (€)
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Precio de ${s.name}`}
                  value={s.price}
                  disabled={s.paid}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      students: f.students.map((x) =>
                        x.clubCustomerId === s.clubCustomerId ? { ...x, price: e.target.value, priceTouched: true } : x,
                      ),
                    }))
                  }
                  className={`${schoolInputCls} w-24`}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={s.paid}
                onClick={() => change({ students: form.students.filter((x) => x.clubCustomerId !== s.clubCustomerId) })}
                aria-label={`Quitar a ${s.name}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
          {full ? (
            <p className="text-xs text-muted-foreground">
              La clase está completa ({SCHOOL_PRIVATE_CLASS_MAX_STUDENTS} alumnos).
            </p>
          ) : (
            <div className="max-w-md">
              <BookingCustomerPicker
                clubId={clubId}
                value={null}
                onChange={(customer) => {
                  if (!customer) return;
                  if (form.students.some((x) => x.clubCustomerId === customer.id)) {
                    toast.error("Ese alumno ya está en la clase");
                    return;
                  }
                  change({
                    students: [
                      ...form.students,
                      { clubCustomerId: customer.id, name: customer.name ?? "Sin nombre", price: "", priceTouched: false, paid: false },
                    ],
                  });
                }}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {proposed !== null
              ? `Precio propuesto: ${formatCents(proposed)} por alumno (tarifa del entrenador × horas ÷ alumnos). Puedes cambiarlo.`
              : form.coachStaffId
                ? "El entrenador no tiene tarifa de clase privada (se pone en Entrenadores): escribe el precio de cada alumno."
                : "Elige un entrenador con tarifa para proponer el precio, o escríbelo a mano."}
          </p>
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

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editing ? "Guardar clase" : "Crear clase"}
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
