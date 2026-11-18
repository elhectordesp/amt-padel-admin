/**
 * /mi-club/escuela/clases/[id] — la ficha de una clase de la escuela. Pasar
 * lista: cada alumno de la lista, presente, ausente o con la falta justificada;
 * lo hacen el entrenador del grupo y quien gestiona la escuela, el día de la
 * clase o después (no antes). Quien gestiona la escuela además avisa las
 * ausencias (que dan una recuperación si se avisa con margen), apunta a quien
 * recupera en el hueco que queda y puede cancelar la clase.
 */

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CalendarPlus, CheckCheck, Loader2, Save, Undo2, UserX } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { Header } from "@/components/admin/header";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolAbsenceDialog } from "@/components/admin/school-absence-dialog";
import { SchoolCancelSessionModal } from "@/components/admin/school-cancel-session-modal";
import { SchoolGuardianLine, SchoolMinorBadge } from "@/components/admin/school-minor-info";
import { SchoolRecoveryDialog } from "@/components/admin/school-recovery-dialog";
import { Button } from "@/components/ui/button";
import { invalidateSchool, schoolQK, schoolService } from "@/lib/services/school";
import { schoolRecoveryQK, schoolRecoveryService } from "@/lib/services/school-recovery";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useRole, isClub } from "@/lib/use-role";
import {
  ATTENDANCE_LABEL,
  attendanceTotals,
  canTakeAttendance,
  sessionLabel,
} from "@/lib/utils/school";
import { dateTimeText } from "@/lib/utils/school-recovery";
import type { SchoolAttendanceStatus, SchoolAttendanceStudent } from "@/types/school";

const OPTIONS: SchoolAttendanceStatus[] = ["PRESENT", "ABSENT", "EXCUSED"];

export default function ClaseEscuelaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, clubId } = useRole();
  const enabled = !!clubId && isClub(role);
  const qc = useQueryClient();
  const { can } = useClubAccess();
  // Avisar ausencias, apuntar recuperaciones y cancelar son de quien escribe la escuela; el entrenador pasa lista
  const canWrite = can("school", "write");
  const { timeZone, isError: timeZoneError, refetch: refetchTimeZone } = useClubTimeZone(clubId, enabled);
  const [now] = useState(() => new Date());
  // Lo cambiado en pantalla y aún sin guardar, por cliente
  const [edits, setEdits] = useState<Record<string, SchoolAttendanceStatus>>({});
  const [absenceOf, setAbsenceOf] = useState<SchoolAttendanceStudent | null>(null);
  const [undoAbsenceOf, setUndoAbsenceOf] = useState<SchoolAttendanceStudent | null>(null);
  const [giveBackTo, setGiveBackTo] = useState<SchoolAttendanceStudent | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const sheet = useQuery({
    queryKey: schoolQK.session(clubId ?? "", id),
    queryFn: () => schoolService.sessions.sheet(clubId!, id),
    enabled,
  });

  const save = useMutation({
    mutationFn: () =>
      schoolService.sessions.setAttendance(
        clubId!,
        id,
        Object.entries(edits).map(([clubCustomerId, status]) => ({ clubCustomerId, status })),
      ),
    onSuccess: (saved) => {
      qc.setQueryData(schoolQK.session(clubId!, id), saved);
      invalidateSchool(qc, clubId!);
      setEdits({});
      toast.success("Asistencia guardada");
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const config = useQuery({
    queryKey: schoolRecoveryQK.config(clubId ?? ""),
    queryFn: () => schoolRecoveryService.config.get(clubId!),
    enabled: enabled && canWrite,
  });

  const undoAbsence = useMutation({
    mutationFn: (clubCustomerId: string) => schoolRecoveryService.absences.undo(clubId!, id, clubCustomerId),
    onSuccess: (result) => {
      invalidateSchool(qc, clubId!);
      toast.success(result.creditRemoved ? "Aviso deshecho: se quita también su recuperación" : "Aviso deshecho");
      setUndoAbsenceOf(null);
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setUndoAbsenceOf(null);
    },
  });

  const giveBack = useMutation({
    mutationFn: (creditId: string) => schoolRecoveryService.recoveries.giveBack(clubId!, id, creditId),
    onSuccess: () => {
      invalidateSchool(qc, clubId!);
      toast.success("Recuperación quitada: el alumno recupera su crédito");
      setGiveBackTo(null);
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setGiveBackTo(null);
    },
  });

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!enabled) {
    return (
      <>
        <Header title="Pasar lista" />
        <p className="p-4 sm:p-6 text-sm text-muted-foreground">Requiere usuario CLUB con club asignado.</p>
      </>
    );
  }

  const data = sheet.data;
  const students = (data?.students ?? []).map((s) => ({ ...s, status: edits[s.clubCustomerId] ?? s.status }));
  const totals = attendanceTotals(students);
  const dirty = Object.keys(edits).length > 0;
  const open = data && timeZone ? canTakeAttendance(data.session, now, timeZone) : false;
  const scheduled = data?.session.status === "SCHEDULED";
  const started = data ? new Date(data.session.startsAt) <= now : false;
  const freeSpots = data?.capacity.freeSpots ?? 0;
  const inClass = new Set((data?.students ?? []).map((s) => s.clubCustomerId));

  return (
    <>
      <Header title="Pasar lista" />
      <div className="space-y-4 p-4 sm:p-6">
        <Link
          href={data ? `/mi-club/escuela/grupos/${data.group.id}` : "/mi-club/escuela"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {data ? `Volver a ${data.group.name}` : "Volver a Escuela"}
        </Link>

        {sheet.isLoading || (!timeZone && !timeZoneError) ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : sheet.isError ? (
          <ErrorState
            title="No se ha podido cargar la clase"
            message="Puede que no exista o que no sea de uno de tus grupos."
            onRetry={() => void sheet.refetch()}
          />
        ) : timeZoneError || !timeZone ? (
          <ErrorState
            title="No se ha podido cargar la zona horaria del club"
            message="Sin ella no se pueden enseñar las horas de las clases."
            onRetry={() => void refetchTimeZone()}
          />
        ) : data ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium">{data.group.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {sessionLabel(data.session, timeZone)}
                  {data.session.court ? ` · ${data.session.court.name}` : " · Sin pista"}
                </p>
                {scheduled && (
                  <p className="text-xs text-muted-foreground">
                    {freeSpots} {freeSpots === 1 ? "hueco libre" : "huecos libres"} de {data.capacity.maxStudents} plazas
                  </p>
                )}
              </div>
              {canWrite && scheduled && (
                <div className="flex flex-wrap gap-2">
                  {!started && (
                    <Button variant="outline" size="sm" disabled={freeSpots === 0} onClick={() => setShowRecovery(true)}>
                      <CalendarPlus className="h-3.5 w-3.5" /> Apuntar recuperación
                    </Button>
                  )}
                  {data.session.attendanceCount === 0 && (
                    <Button variant="outline" size="sm" onClick={() => setShowCancel(true)}>
                      <Ban className="h-3.5 w-3.5" /> Cancelar clase
                    </Button>
                  )}
                </div>
              )}
            </div>

            {!open && (
              <p role="status" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {data.session.status === "CANCELLED"
                  ? "La clase está cancelada: no se pasa lista."
                  : "Aún no es el día de la clase: podrás pasar lista ese día."}
              </p>
            )}

            {students.length === 0 ? (
              <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
                El grupo no tiene alumnos en la lista de esta clase.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {totals.present} presentes · {totals.absent} ausentes · {totals.excused} justificadas ·{" "}
                    {totals.pending} sin apuntar
                  </p>
                  {open && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEdits((prev) => ({
                          ...prev,
                          ...Object.fromEntries(
                            students
                              // Quien avisó de que faltaba se queda como está: pasarlo a presente le quitaría su recuperación
                              .filter((s) => s.status !== "PRESENT" && !s.noticedAt)
                              .map((s) => [s.clubCustomerId, "PRESENT" as const]),
                          ),
                        }))
                      }
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Marcar todos presentes
                    </Button>
                  )}
                </div>

                <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                  {students.map((s) => (
                    <li key={s.clubCustomerId} className="space-y-1.5 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {s.name ?? "Sin nombre"}
                          {s.recovery && (
                            <span className="ml-2 rounded bg-[rgba(212,175,55,0.15)] px-1.5 py-0.5 text-xs font-medium text-[#D4AF37]">
                              Recupera
                            </span>
                          )}
                          <SchoolMinorBadge student={s} />
                        </span>
                        <div role="group" aria-label={`Asistencia de ${s.name ?? "alumno"}`} className="flex gap-1">
                          {OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              disabled={!open}
                              aria-pressed={s.status === option}
                              onClick={() => setEdits((prev) => ({ ...prev, [s.clubCustomerId]: option }))}
                              className={`rounded-md border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 max-[1024px]:min-h-11 ${
                                s.status === option
                                  ? option === "PRESENT"
                                    ? "border-emerald-500/50 bg-emerald-500/15 font-semibold text-emerald-500"
                                    : option === "ABSENT"
                                      ? "border-red-500/50 bg-red-500/15 font-semibold text-red-500"
                                      : "border-amber-500/50 bg-amber-500/15 font-semibold text-amber-500"
                                  : "border-border text-muted-foreground hover:bg-secondary"
                              }`}
                            >
                              {ATTENDANCE_LABEL[option]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <SchoolGuardianLine student={s} />
                      {!s.recovery && s.noticedAt && (
                        <p className="text-xs text-muted-foreground">
                          Avisó de que falta el {dateTimeText(s.noticedAt, timeZone)}
                          {s.earnedCreditId ? " · gana una recuperación" : " · avisó con poco margen: sin recuperación"}
                        </p>
                      )}
                      {s.recovery && (
                        <p className="text-xs text-muted-foreground">Viene a recuperar una clase de otro día.</p>
                      )}

                      {canWrite && scheduled && (
                        <div className="flex flex-wrap gap-1">
                          {!s.recovery && !s.noticedAt && s.status !== "PRESENT" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAbsenceOf(s)}
                              aria-label={`Avisar de la ausencia de ${s.name ?? "este alumno"}`}
                            >
                              <UserX className="h-3.5 w-3.5" /> Avisa ausencia
                            </Button>
                          )}
                          {!s.recovery && s.noticedAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUndoAbsenceOf(s)}
                              aria-label={`Deshacer el aviso de ${s.name ?? "este alumno"}`}
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Deshacer aviso
                            </Button>
                          )}
                          {s.recovery && !started && s.usedCreditId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setGiveBackTo(s)}
                              aria-label={`Quitar la recuperación de ${s.name ?? "este alumno"}`}
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Quitar recuperación
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {open && (
                  <div className="flex justify-end">
                    <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                      {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Guardar asistencia
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        ) : null}
      </div>

      {data && timeZone && absenceOf && (
        <SchoolAbsenceDialog
          clubId={clubId!}
          session={data.session}
          student={absenceOf}
          noticeHours={config.data?.recoveryNoticeHours ?? null}
          timeZone={timeZone}
          onClose={() => setAbsenceOf(null)}
        />
      )}
      {data && timeZone && showRecovery && (
        <SchoolRecoveryDialog
          clubId={clubId!}
          session={data.session}
          inClass={inClass}
          timeZone={timeZone}
          onClose={() => setShowRecovery(false)}
        />
      )}
      {data && timeZone && showCancel && (
        <SchoolCancelSessionModal
          clubId={clubId!}
          session={data.session}
          timeZone={timeZone}
          onClose={() => setShowCancel(false)}
        />
      )}
      <ConfirmModal
        open={!!undoAbsenceOf}
        title="Deshacer el aviso de ausencia"
        description={`${undoAbsenceOf?.name ?? "El alumno"} vuelve a la lista de esta clase y se quita la recuperación que ganó con el aviso. Si ya la ha gastado en otra clase, no se puede deshacer.`}
        confirmLabel="Deshacer aviso"
        cancelLabel="Volver"
        loading={undoAbsence.isPending}
        onClose={() => {
          if (!undoAbsence.isPending) setUndoAbsenceOf(null);
        }}
        onConfirm={() => undoAbsenceOf && undoAbsence.mutate(undoAbsenceOf.clubCustomerId)}
      />
      <ConfirmModal
        open={!!giveBackTo}
        title="Quitar la recuperación"
        description={`${giveBackTo?.name ?? "El alumno"} deja de venir a esta clase y recupera su crédito para apuntarse a otra.`}
        confirmLabel="Quitar recuperación"
        cancelLabel="Volver"
        loading={giveBack.isPending}
        onClose={() => {
          if (!giveBack.isPending) setGiveBackTo(null);
        }}
        onConfirm={() => giveBackTo?.usedCreditId && giveBack.mutate(giveBackTo.usedCreditId)}
      />
    </>
  );
}
