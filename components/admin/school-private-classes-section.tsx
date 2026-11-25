"use client";

/**
 * Clases privadas de la escuela: la lista por días con su pista, su entrenador
 * y sus alumnos, cada uno con su precio y su cobro (en el mostrador o con un
 * bono de clases privadas); crear, mover o cambiar alumnos y precios, y
 * cancelar (libera la pista y devuelve a su bono las sesiones gastadas). Todo
 * lo cobrado sale en la caja y lo pendiente, en «Pendiente de cobro».
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CreditCard, Loader2, Pencil, Plus, Undo2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolPrivateClassDialog } from "@/components/admin/school-private-class-dialog";
import { SchoolStudentPayDialog } from "@/components/admin/school-pay-dialogs";
import { Button } from "@/components/ui/button";
import { invalidateSchoolBilling, schoolBillingQK, schoolBillingService } from "@/lib/services/school-billing";
import { useBizumReceivers } from "@/lib/use-bizum-receivers";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { formatCents } from "@/lib/utils/booking-price";
import {
  classPaymentSummary,
  defaultPrivateClassRange,
  privateClassWhen,
  studentPaymentText,
} from "@/lib/utils/school-billing";
import { capitalizeFirst, formatDayKey, zonedDayKey } from "@/lib/utils/time-zone";
import type { SchoolPrivateClass, SchoolPrivateClassStudent } from "@/types/school-billing";

const DAY_HEADING: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };

export function SchoolPrivateClassesSection({ clubId, canWrite }: { clubId: string; canWrite: boolean }) {
  const { timeZone, isError, refetch } = useClubTimeZone(clubId);
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!timeZone) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  return <PrivateClassesList clubId={clubId} timeZone={timeZone} canWrite={canWrite} />;
}

function PrivateClassesList({ clubId, timeZone, canWrite }: { clubId: string; timeZone: string; canWrite: boolean }) {
  const showMoney = useClubAccess().can("cash");
  const bizumReceivers = useBizumReceivers(clubId);
  const qc = useQueryClient();
  const [range, setRange] = useState(() => defaultPrivateClassRange(new Date(), timeZone));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SchoolPrivateClass | null>(null);
  const [toCancel, setToCancel] = useState<SchoolPrivateClass | null>(null);
  const [reason, setReason] = useState("");
  const [paying, setPaying] = useState<{ cls: SchoolPrivateClass; student: SchoolPrivateClassStudent } | null>(null);
  const [unpaying, setUnpaying] = useState<{ cls: SchoolPrivateClass; student: SchoolPrivateClassStudent } | null>(null);

  const classes = useQuery({
    queryKey: schoolBillingQK.privateClasses(clubId, range.from, range.to),
    queryFn: () => schoolBillingService.privateClasses.list(clubId, range.from, range.to),
    enabled: range.from <= range.to,
  });

  const refresh = () => invalidateSchoolBilling(qc, clubId);

  const cancel = useMutation({
    mutationFn: (classId: string) => schoolBillingService.privateClasses.cancel(clubId, classId, reason.trim() || undefined),
    onSuccess: () => {
      refresh();
      toast.success("Clase cancelada: su pista queda libre");
      setToCancel(null);
      setReason("");
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setToCancel(null);
    },
  });

  const unpay = useMutation({
    mutationFn: ({ cls, student }: { cls: SchoolPrivateClass; student: SchoolPrivateClassStudent }) =>
      schoolBillingService.privateClasses.unpay(clubId, cls.id, student.id),
    onSuccess: () => {
      refresh();
      toast.success("Cobro quitado: el alumno vuelve a estar pendiente");
      setUnpaying(null);
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setUnpaying(null);
    },
  });

  const list = classes.data ?? [];
  const days = new Map<string, SchoolPrivateClass[]>();
  for (const c of list) {
    const key = zonedDayKey(c.startsAt, timeZone);
    days.set(key, [...(days.get(key) ?? []), c]);
  }

  return (
    <section aria-label="Clases privadas" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-xs text-muted-foreground">
            Desde
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
              className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Hasta
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva clase privada
          </Button>
        )}
      </div>

      {range.from > range.to ? (
        <p className="text-sm text-muted-foreground">El rango no puede acabar antes de empezar.</p>
      ) : classes.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : classes.isError ? (
        <ErrorState onRetry={() => void classes.refetch()} />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          <UserRound className="h-7 w-7 opacity-50" />
          No hay clases privadas en estos días.
        </div>
      ) : (
        <div className="space-y-4">
          {[...days.entries()].map(([day, items]) => (
            <section key={day} aria-label={formatDayKey(day, DAY_HEADING)} className="space-y-2">
              <h2 className="text-base font-medium">{capitalizeFirst(formatDayKey(day, DAY_HEADING))}</h2>
              <ul className="space-y-2">
                {items.map((c) => (
                  <li key={c.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {privateClassWhen(c, timeZone)}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {c.court ? c.court.name : "Sin pista"}
                        </span>
                        {c.status === "CANCELLED" && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Cancelada</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.coachName ? `Entrenador: ${c.coachName}` : "Sin entrenador"}
                        {showMoney && c.status === "SCHEDULED" && ` · ${classPaymentSummary(c)}`}
                      </span>
                    </div>
                    {c.status === "CANCELLED" && c.cancelReason && (
                      <p className="text-xs text-muted-foreground">Motivo: {c.cancelReason}</p>
                    )}
                    {!c.court && c.status === "SCHEDULED" && (
                      <p className="rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-500">
                        La pista de esta clase ya no existe: edítala para elegir otra.
                      </p>
                    )}

                    <ul className="divide-y divide-border rounded-md border border-border">
                      {c.students.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span>
                            <span className="font-medium">{s.name ?? "Sin nombre"}</span>
                            {/* El dinero es de recepción: el entrenador ve a quién da clase, no lo que paga */}
                            {showMoney && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {formatCents(s.priceCents)} · {studentPaymentText(s)}
                              </span>
                            )}
                          </span>
                          {canWrite && c.status === "SCHEDULED" && (
                            <span className="flex items-center gap-1">
                              {s.paid ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setUnpaying({ cls: c, student: s })}
                                  aria-label={`Quitar el cobro a ${s.name ?? "este alumno"}`}
                                >
                                  <Undo2 className="h-3.5 w-3.5" /> Quitar cobro
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPaying({ cls: c, student: s })}
                                  aria-label={`Cobrar a ${s.name ?? "este alumno"}`}
                                >
                                  <CreditCard className="h-3.5 w-3.5" /> Cobrar
                                </Button>
                              )}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}

                    {canWrite && c.status === "SCHEDULED" && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setToCancel(c)}>
                          <Ban className="h-3.5 w-3.5" /> Cancelar clase
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <SchoolPrivateClassDialog
          clubId={clubId}
          timeZone={timeZone}
          today={zonedDayKey(new Date(), timeZone)}
          privateClass={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {paying && (
        <SchoolStudentPayDialog
          clubId={clubId}
          classId={paying.cls.id}
          studentId={paying.student.id}
          subtitle={`${paying.student.name ?? "Alumno"} · ${privateClassWhen(paying.cls, timeZone)}`}
          priceCents={paying.student.priceCents}
          timeZone={timeZone}
          bizumReceivers={bizumReceivers}
          onDone={refresh}
          onClose={() => setPaying(null)}
        />
      )}

      <ConfirmModal
        open={!!unpaying}
        title="Quitar el cobro"
        description={
          unpaying?.student.paymentMethod === "VOUCHER"
            ? `${unpaying.student.name ?? "El alumno"} volverá a estar pendiente y la sesión vuelve a su bono.`
            : `${unpaying?.student.name ?? "El alumno"} volverá a estar pendiente de cobro. Si ya se contó en la caja de un día, ese cobro dejará de salir en ella (la caja se calcula con los cobros apuntados, no se guarda): úsalo solo si lo cobraste por error.`
        }
        confirmLabel="Quitar el cobro"
        loading={unpay.isPending}
        onClose={() => {
          if (!unpay.isPending) setUnpaying(null);
        }}
        onConfirm={() => unpaying && unpay.mutate(unpaying)}
      />

      <ConfirmModal
        open={!!toCancel}
        danger
        title="Cancelar la clase privada"
        description="Se libera la pista y las sesiones de bono gastadas vuelven a su bono. Si algún alumno ha pagado en dinero, quítale antes el cobro."
        confirmLabel="Cancelar clase"
        cancelLabel="Volver"
        loading={cancel.isPending}
        onClose={() => {
          if (!cancel.isPending) {
            setToCancel(null);
            setReason("");
          }
        }}
        onConfirm={() => toCancel && cancel.mutate(toCancel.id)}
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Motivo (opcional)
          </span>
          <input
            type="text"
            aria-label="Motivo de la cancelación"
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={cancel.isPending}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
        </label>
      </ConfirmModal>
    </section>
  );
}
