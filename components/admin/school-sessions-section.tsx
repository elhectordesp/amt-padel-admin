"use client";

/**
 * Clases de un grupo: las de toda la temporada con su pista (o «sin pista»),
 * generar o regenerar desde el horario semanal, cambiar pista, día u hora,
 * cancelar y pasar lista. La pista de cada clase la reserva el sistema: es un
 * bloqueo que el calendario y las reservas ya ven.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarClock, ClipboardCheck, Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolSessionDialog } from "@/components/admin/school-session-dialog";
import { Button } from "@/components/ui/button";
import { invalidateSchool, schoolService } from "@/lib/services/school";
import { canTakeAttendance, generateSummaryText, sessionLabel } from "@/lib/utils/school";
import type { SchoolGroupDetail, SchoolGroupSession } from "@/types/school";

type Filter = "upcoming" | "past";

export function SchoolSessionsSection({
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
  const [now] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [editing, setEditing] = useState<SchoolGroupSession | null>(null);
  const [toCancel, setToCancel] = useState<SchoolGroupSession | null>(null);
  const [reason, setReason] = useState("");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const editable = canWrite && !group.archivedAt;
  const isUpcoming = (s: SchoolGroupSession) => new Date(s.endsAt) > now;
  const upcoming = group.sessions.filter(isUpcoming);
  const past = group.sessions.filter((s) => !isUpcoming(s)).reverse();
  const withoutCourt = upcoming.filter((s) => s.status === "SCHEDULED" && !s.court).length;
  const shown = filter === "upcoming" ? upcoming : past;

  const generate = useMutation({
    mutationFn: () => schoolService.sessions.generate(clubId, group.id),
    onSuccess: (result) => {
      invalidateSchool(qc, clubId);
      const text = generateSummaryText(result);
      if (result.withoutCourt > 0) toast.warning(text);
      else toast.success(text);
      setConfirmRegenerate(false);
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setConfirmRegenerate(false);
    },
  });

  const cancel = useMutation({
    mutationFn: (sessionId: string) => schoolService.sessions.cancel(clubId, sessionId, reason.trim() || undefined),
    onSuccess: () => {
      invalidateSchool(qc, clubId);
      toast.success("Clase cancelada: su pista queda libre");
      setToCancel(null);
      setReason("");
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const hasSessions = group.sessions.length > 0;

  return (
    <section aria-label="Clases" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">
          Clases{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {upcoming.length} {upcoming.length === 1 ? "próxima" : "próximas"}
          </span>
          {withoutCourt > 0 && (
            <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-500">
              {withoutCourt} sin pista
            </span>
          )}
        </h2>
        {editable && (
          <Button
            variant={hasSessions ? "outline" : "default"}
            size="sm"
            disabled={generate.isPending}
            onClick={() => (hasSessions ? setConfirmRegenerate(true) : generate.mutate())}
          >
            {generate.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : hasSessions ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5" />
            )}
            {hasSessions ? "Regenerar clases" : "Generar clases de la temporada"}
          </Button>
        )}
      </div>

      {!hasSessions ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          <CalendarClock className="h-7 w-7 opacity-50" />
          {editable
            ? "Aún no hay clases. Genera las de la temporada y el sistema reserva la pista de cada una."
            : "Aún no hay clases."}
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Clases próximas o pasadas" className="flex gap-1 text-sm">
            {(
              [
                ["upcoming", `Próximas (${upcoming.length})`],
                ["past", `Pasadas (${past.length})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  filter === value
                    ? "bg-[rgba(212,175,55,0.12)] font-semibold text-[#D4AF37]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
              {filter === "upcoming" ? "No quedan clases por dar." : "Aún no hay clases pasadas."}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {shown.map((s) => {
                const cancelled = s.status === "CANCELLED";
                const canList = canTakeAttendance(s, now, timeZone);
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <span className={`font-medium ${cancelled ? "text-muted-foreground line-through" : ""}`}>
                        {sessionLabel(s, timeZone)}
                      </span>
                      {cancelled ? (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                          Cancelada{s.cancelReason ? `: ${s.cancelReason}` : ""}
                        </span>
                      ) : s.court ? (
                        <span className="ml-2 text-muted-foreground">{s.court.name}</span>
                      ) : (
                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-500">
                          Sin pista
                        </span>
                      )}
                      {s.attendanceCount > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.attendanceCount} {s.attendanceCount === 1 ? "apuntado" : "apuntados"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {canList && (
                        <Link
                          href={`/mi-club/escuela/clases/${s.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[0.8rem] hover:bg-muted max-[1024px]:h-11"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          {s.attendanceCount > 0 ? "Ver lista" : "Pasar lista"}
                        </Link>
                      )}
                      {editable && !cancelled && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditing(s)}
                            aria-label={`Cambiar la clase del ${sessionLabel(s, timeZone)}`}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          {s.attendanceCount === 0 && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setReason("");
                                setToCancel(s);
                              }}
                              aria-label={`Cancelar la clase del ${sessionLabel(s, timeZone)}`}
                            >
                              <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {editing && (
        <SchoolSessionDialog clubId={clubId} session={editing} timeZone={timeZone} onClose={() => setEditing(null)} />
      )}

      <ConfirmModal
        open={confirmRegenerate}
        title="Regenerar las clases"
        description="Se rehacen las clases futuras que siguen programadas y no tienen asistencia, con el horario y las fechas actuales del grupo (también las que hayas movido o cambiado de pista a mano). No se tocan las pasadas, las canceladas ni las que ya tienen asistencia."
        confirmLabel="Regenerar clases"
        loading={generate.isPending}
        onClose={() => {
          if (!generate.isPending) setConfirmRegenerate(false);
        }}
        onConfirm={() => generate.mutate()}
      />

      <ConfirmModal
        open={!!toCancel}
        danger
        title="Cancelar la clase"
        description={
          toCancel
            ? `${sessionLabel(toCancel, timeZone)}. La clase queda cancelada y se libera su pista. Lo que se apunte como motivo lo verá todo el equipo.`
            : ""
        }
        confirmLabel="Cancelar clase"
        cancelLabel="Volver"
        loading={cancel.isPending}
        onClose={() => {
          if (!cancel.isPending) setToCancel(null);
        }}
        onConfirm={() => toCancel && cancel.mutate(toCancel.id)}
      >
        <label className="block text-xs text-muted-foreground">
          Motivo (opcional)
          <input
            type="text"
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lluvia, festivo, obras..."
            className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </ConfirmModal>
    </section>
  );
}
