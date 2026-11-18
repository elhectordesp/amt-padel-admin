/**
 * /mi-club/escuela/clases/[id] — pasar lista de una clase de la escuela: cada
 * alumno de la lista, presente, ausente o con la falta justificada. Lo hacen
 * el entrenador del grupo y quien gestiona la escuela, el día de la clase o
 * después (no antes).
 */

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCheck, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/admin/error-state";
import { Header } from "@/components/admin/header";
import { errorText } from "@/components/admin/price-seasons-panel";
import { Button } from "@/components/ui/button";
import { invalidateSchool, schoolQK, schoolService } from "@/lib/services/school";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useRole, isClub } from "@/lib/use-role";
import {
  ATTENDANCE_LABEL,
  attendanceTotals,
  canTakeAttendance,
  sessionLabel,
} from "@/lib/utils/school";
import type { SchoolAttendanceStatus } from "@/types/school";

const OPTIONS: SchoolAttendanceStatus[] = ["PRESENT", "ABSENT", "EXCUSED"];

export default function ClaseEscuelaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, clubId } = useRole();
  const enabled = !!clubId && isClub(role);
  const qc = useQueryClient();
  const { timeZone, isError: timeZoneError, refetch: refetchTimeZone } = useClubTimeZone(clubId, enabled);
  const [now] = useState(() => new Date());
  // Lo cambiado en pantalla y aún sin guardar, por cliente
  const [edits, setEdits] = useState<Record<string, SchoolAttendanceStatus>>({});

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
            <div>
              <h2 className="text-base font-medium">{data.group.name}</h2>
              <p className="text-sm text-muted-foreground">
                {sessionLabel(data.session, timeZone)}
                {data.session.court ? ` · ${data.session.court.name}` : " · Sin pista"}
              </p>
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
                              .filter((s) => s.status !== "PRESENT")
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
                    <li key={s.clubCustomerId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="font-medium">{s.name ?? "Sin nombre"}</span>
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
    </>
  );
}
