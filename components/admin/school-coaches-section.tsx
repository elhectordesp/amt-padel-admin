"use client";

/**
 * Entrenadores de la escuela: el equipo del club con el rol de entrenador, los
 * grupos que lleva cada uno y su perfil (bio), que edita el club y servirá para
 * el futuro directorio de profesores. Quién es entrenador se decide en Equipo.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/admin/error-state";
import { errorText } from "@/components/admin/price-seasons-panel";
import { Button } from "@/components/ui/button";
import { schoolQK, schoolService } from "@/lib/services/school";
import { schoolBillingService } from "@/lib/services/school-billing";
import { SCHOOL_BIO_MAX } from "@/lib/utils/school";
import { centsToFieldText, checkRate } from "@/lib/utils/school-money";
import type { SchoolCoach } from "@/types/school";

function CoachCard({ clubId, coach, canWrite }: { clubId: string; coach: SchoolCoach; canWrite: boolean }) {
  const qc = useQueryClient();
  const [bio, setBio] = useState(coach.coachBio ?? "");
  const dirty = bio.trim() !== (coach.coachBio ?? "");
  const [rate, setRate] = useState(centsToFieldText(coach.privateClassRateCents));
  const checkedRate = checkRate(rate);
  const rateDirty = rate.trim() !== centsToFieldText(coach.privateClassRateCents);

  const save = useMutation({
    mutationFn: () => schoolService.coaches.update(clubId, coach.staffId, bio.trim() || null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: schoolQK.coaches(clubId) });
      toast.success("Perfil del entrenador guardado");
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const saveRate = useMutation({
    mutationFn: () => {
      if (!checkedRate.ok) throw new Error(checkedRate.message);
      return schoolBillingService.coachRate.update(clubId, coach.staffId, checkedRate.value);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: schoolQK.coaches(clubId) });
      toast.success("Tarifa de clase privada guardada");
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <li className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{coach.name}</span>
        <span className="text-xs text-muted-foreground">
          {coach.groups.length === 0 ? (
            "Sin grupos"
          ) : (
            <>
              {coach.groups.length === 1 ? "Grupo: " : "Grupos: "}
              {coach.groups.map((g, i) => (
                <span key={g.id}>
                  {i > 0 && ", "}
                  <Link href={`/mi-club/escuela/grupos/${g.id}`} className="underline-offset-2 hover:underline">
                    {g.name}
                  </Link>
                </span>
              ))}
            </>
          )}
        </span>
      </div>
      <label className="block text-xs text-muted-foreground">
        Perfil
        <textarea
          rows={3}
          maxLength={SCHOOL_BIO_MAX}
          value={bio}
          readOnly={!canWrite}
          onChange={(e) => setBio(e.target.value)}
          placeholder={canWrite ? "Experiencia, titulación, a quién se dirige..." : "Sin perfil"}
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      {canWrite && (
        <div className="flex justify-end">
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar perfil
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="block text-xs text-muted-foreground">
          Tarifa de clase privada (€ por hora, precio total de la clase)
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            readOnly={!canWrite}
            onChange={(e) => setRate(e.target.value)}
            placeholder={canWrite ? "Vacío: sin tarifa" : "Sin tarifa"}
            className="mt-1 block w-44 rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        {canWrite && (
          <Button
            size="sm"
            disabled={!rateDirty || saveRate.isPending}
            onClick={() => {
              if (!checkedRate.ok) {
                toast.error(checkedRate.message);
                return;
              }
              saveRate.mutate();
            }}
          >
            {saveRate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar tarifa
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Al crear una clase privada se propone a cada alumno la tarifa por las horas de la clase, repartida entre los
        alumnos.
      </p>
    </li>
  );
}

export function SchoolCoachesSection({ clubId, canWrite }: { clubId: string; canWrite: boolean }) {
  const coaches = useQuery({
    queryKey: schoolQK.coaches(clubId),
    queryFn: () => schoolService.coaches.list(clubId),
  });

  if (coaches.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (coaches.isError) return <ErrorState onRetry={() => void coaches.refetch()} />;
  const list = coaches.data ?? [];

  return (
    <section aria-label="Entrenadores" className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Las personas del equipo con el rol de entrenador. Para añadir a alguien, dale ese rol desde Equipo.
      </p>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          <GraduationCap className="h-7 w-7 opacity-50" />
          Aún no hay nadie con el rol de entrenador en el equipo.
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            // La clave incluye la bio y la tarifa guardadas: al refrescar, los campos se reinician con lo guardado
            <CoachCard
              key={`${c.staffId}:${c.coachBio ?? ""}:${c.privateClassRateCents ?? ""}`}
              clubId={clubId}
              coach={c}
              canWrite={canWrite}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
