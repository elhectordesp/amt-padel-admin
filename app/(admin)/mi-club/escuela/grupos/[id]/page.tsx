/**
 * /mi-club/escuela/grupos/[id] — la ficha de un grupo de la escuela: sus datos
 * y horario semanal, sus alumnos (con aforo y bajas) y las clases de la
 * temporada con su pista (generar o regenerar, cambiar, cancelar y pasar
 * lista). Quien solo lee la escuela (el entrenador) ve el grupo y pasa lista,
 * sin cambiar nada.
 */

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { Header } from "@/components/admin/header";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolGroupDialog } from "@/components/admin/school-group-dialog";
import { SchoolMembersSection } from "@/components/admin/school-members-section";
import { SchoolSessionsSection } from "@/components/admin/school-sessions-section";
import { Button } from "@/components/ui/button";
import { invalidateSchool, schoolQK, schoolService } from "@/lib/services/school";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useRole, isClub } from "@/lib/use-role";
import { formatCents } from "@/lib/utils/booking-price";
import { slotsSummary } from "@/lib/utils/school";
import { formatDayKey } from "@/lib/utils/time-zone";

const SEASON_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

export default function GrupoEscuelaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, clubId } = useRole();
  const enabled = !!clubId && isClub(role);
  const qc = useQueryClient();
  const { can } = useClubAccess();
  const canWrite = can("school", "write");
  const { timeZone, isError: timeZoneError, refetch: refetchTimeZone } = useClubTimeZone(clubId, enabled);
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const group = useQuery({
    queryKey: schoolQK.group(clubId ?? "", id),
    queryFn: () => schoolService.groups.get(clubId!, id),
    enabled,
  });

  const archive = useMutation({
    mutationFn: () => schoolService.groups.archive(clubId!, id),
    onSuccess: () => {
      invalidateSchool(qc, clubId!);
      toast.success("Grupo archivado: se ha liberado la pista de sus clases futuras");
      setConfirmArchive(false);
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setConfirmArchive(false);
    },
  });

  const restore = useMutation({
    mutationFn: () => schoolService.groups.restore(clubId!, id),
    onSuccess: () => {
      invalidateSchool(qc, clubId!);
      toast.success("Grupo restaurado: genera sus clases para volver a reservar las pistas");
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const title = group.data?.name ?? "Grupo";

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
        <Header title="Escuela" />
        <p className="p-4 sm:p-6 text-sm text-muted-foreground">Requiere usuario CLUB con club asignado.</p>
      </>
    );
  }

  const g = group.data;

  return (
    <>
      <Header title={title} />
      <div className="space-y-6 p-4 sm:p-6">
        <Link
          href="/mi-club/escuela"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a Escuela
        </Link>

        {group.isLoading || (!timeZone && !timeZoneError) ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : group.isError ? (
          <ErrorState
            title="No se ha podido cargar el grupo"
            message="Puede que no exista o que no sea de tu club."
            onRetry={() => void group.refetch()}
          />
        ) : timeZoneError || !timeZone ? (
          <ErrorState
            title="No se ha podido cargar la zona horaria del club"
            message="Sin ella no se pueden enseñar las horas de las clases."
            onRetry={() => void refetchTimeZone()}
          />
        ) : g ? (
          <>
            <section aria-label="Datos del grupo" className="space-y-2 rounded-lg border border-border p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-medium">
                    {g.name}
                    {g.level && <span className="ml-2 text-sm font-normal text-muted-foreground">{g.level}</span>}
                    {g.archivedAt && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Archivado</span>}
                  </h2>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-2">
                    {!g.archivedAt && (
                      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    )}
                    {g.archivedAt ? (
                      <Button variant="outline" size="sm" disabled={restore.isPending} onClick={() => restore.mutate()}>
                        {restore.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        )}
                        Restaurar
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
                        <Archive className="h-3.5 w-3.5" /> Archivar
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-muted-foreground sm:grid-cols-2">
                <div>
                  <dt className="inline">Entrenador: </dt>
                  <dd className="inline text-foreground">{g.coach?.name ?? "Sin entrenador"}</dd>
                </div>
                <div>
                  <dt className="inline">Plazas: </dt>
                  <dd className="inline text-foreground">
                    {g.activeStudents} de {g.maxStudents}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Cuota mensual: </dt>
                  <dd className="inline text-foreground">
                    {g.monthlyFeeCents === null ? "Sin cuota" : `${formatCents(g.monthlyFeeCents)} por alumno`}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Temporada: </dt>
                  <dd className="inline text-foreground">
                    {formatDayKey(g.startDate, SEASON_FMT)} – {formatDayKey(g.endDate, SEASON_FMT)}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Horario: </dt>
                  <dd className="inline text-foreground">{slotsSummary(g.slots)}</dd>
                </div>
              </dl>
              {g.notes && <p className="whitespace-pre-line text-muted-foreground">{g.notes}</p>}
            </section>

            <SchoolMembersSection clubId={clubId!} group={g} timeZone={timeZone} canWrite={canWrite} />
            <SchoolSessionsSection clubId={clubId!} group={g} timeZone={timeZone} canWrite={canWrite} />

            {editing && (
              <SchoolGroupDialog
                clubId={clubId!}
                group={g}
                onClose={() => setEditing(false)}
                onSaved={() => setEditing(false)}
              />
            )}

            <ConfirmModal
              open={confirmArchive}
              danger
              title={`Archivar «${g.name}»`}
              description="El grupo deja de salir en la lista y se libera la pista de sus clases futuras sin asistencia. Las clases pasadas y su asistencia se conservan, y se puede restaurar."
              confirmLabel="Archivar grupo"
              loading={archive.isPending}
              onClose={() => {
                if (!archive.isPending) setConfirmArchive(false);
              }}
              onConfirm={() => archive.mutate()}
            />
          </>
        ) : null}
      </div>
    </>
  );
}
