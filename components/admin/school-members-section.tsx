"use client";

/**
 * Alumnos de un grupo: son clientes del club, que se buscan con el buscador de
 * clientes (y se dan de alta ahí mismo si no están). El aforo lo manda el
 * grupo; la baja no borra al alumno (queda su historial de asistencia).
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { errorText } from "@/components/admin/price-seasons-panel";
import { Button } from "@/components/ui/button";
import { invalidateSchool, schoolService } from "@/lib/services/school";
import { formatInTimeZone } from "@/lib/utils/time-zone";
import type { SchoolGroupDetail, SchoolMember } from "@/types/school";

const DAY_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export function SchoolMembersSection({
  clubId,
  group,
  timeZone,
  canWrite,
}: {
  clubId: string;
  group: SchoolGroupDetail;
  timeZone: string;
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const [toLeave, setToLeave] = useState<SchoolMember | null>(null);

  const active = group.members.filter((m) => m.leftAt === null);
  const left = group.members.filter((m) => m.leftAt !== null);
  const full = active.length >= group.maxStudents;
  const editable = canWrite && !group.archivedAt;

  const add = useMutation({
    mutationFn: (clubCustomerId: string) => schoolService.members.add(clubId, group.id, clubCustomerId),
    onSuccess: (member) => {
      invalidateSchool(qc, clubId);
      toast.success(`${member.name ?? "El alumno"} se ha apuntado al grupo`);
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const leave = useMutation({
    mutationFn: (memberId: string) => schoolService.members.leave(clubId, group.id, memberId),
    onSuccess: () => {
      invalidateSchool(qc, clubId);
      toast.success("Alumno dado de baja");
      setToLeave(null);
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <section aria-label="Alumnos" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">
          Alumnos{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {active.length} de {group.maxStudents} plazas
          </span>
        </h2>
      </div>

      {editable &&
        (full ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            El grupo está completo. Da de baja a alguien o sube las plazas desde Editar para apuntar a más.
          </p>
        ) : (
          <div className="max-w-md">
            <BookingCustomerPicker
              clubId={clubId}
              value={null}
              onChange={(customer) => {
                if (customer && !add.isPending) add.mutate(customer.id);
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Busca a un cliente del club por nombre o teléfono para apuntarlo al grupo.
            </p>
          </div>
        ))}

      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          <Users className="h-7 w-7 opacity-50" />
          Aún no hay alumnos en este grupo.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {active.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span>
                <span className="font-medium">{m.name ?? "Sin nombre"}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  desde {formatInTimeZone(m.joinedAt, timeZone, DAY_FMT)}
                </span>
              </span>
              {editable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setToLeave(m)}
                  aria-label={`Dar de baja a ${m.name ?? "este alumno"}`}
                >
                  <UserMinus className="h-3.5 w-3.5" /> Baja
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {left.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Bajas ({left.length})</summary>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {left.map((m) => (
              <li key={m.id} className="px-3 py-2 text-muted-foreground">
                {m.name ?? "Sin nombre"}
                <span className="ml-2 text-xs">
                  baja el {formatInTimeZone(m.leftAt, timeZone, DAY_FMT)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ConfirmModal
        open={!!toLeave}
        title={`Dar de baja a ${toLeave?.name ?? "este alumno"}`}
        description="Deja de salir en la lista de las clases que le queden. Se conserva su historial de asistencia y puede volver a apuntarse."
        confirmLabel="Dar de baja"
        loading={leave.isPending}
        onClose={() => {
          if (!leave.isPending) setToLeave(null);
        }}
        onConfirm={() => toLeave && leave.mutate(toLeave.id)}
      />
    </section>
  );
}
