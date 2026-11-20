"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { adminService } from "@/lib/services/admin";
import type { ClubSetupProgress, ClubSetupStepCode } from "@/types";

const SETUP_STEP: Record<ClubSetupStepCode, { label: string; hint: string; href: string }> = {
  COURTS: { label: "Pistas", hint: "Da de alta al menos una pista activa.", href: "/mi-club/reservas/pistas" },
  SCHEDULE: { label: "Horario semanal", hint: "Los días y horas en que abre el club.", href: "/mi-club/reservas/horarios" },
  PRICES: { label: "Precios", hint: "El precio de cada duración de cada pista.", href: "/mi-club/reservas/precios" },
  RULES: {
    label: "Normas y configuración de reservas",
    hint: "El reglamento del club o los ajustes de reserva.",
    href: "/mi-club/reservas/normas",
  },
};

/** La tarjeta con los pasos; no pinta nada con todo hecho. */
export function ClubSetupSteps({ progress }: { progress: ClubSetupProgress }) {
  if (progress.complete) return null;
  const done = progress.steps.filter((s) => s.done).length;
  return (
    <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-5" aria-label="Puesta en marcha">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Puesta en marcha</h3>
        <span className="text-xs text-muted-foreground">{done} de {progress.steps.length} hechos</span>
      </div>
      <ul className="divide-y divide-border">
        {progress.steps.map((s) => {
          const info = SETUP_STEP[s.code];
          return (
            <li key={s.code}>
              <Link href={info.href} className="-mx-2 flex items-center gap-3 rounded px-2 py-2.5 hover:bg-secondary/40">
                {s.done
                  ? <CheckCircle2 size={16} className="shrink-0 text-green-500" />
                  : <Circle size={16} className="shrink-0 text-amber-500" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{info.label}</p>
                  {!s.done && <p className="text-xs text-muted-foreground">{info.hint}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{s.done ? "Hecho" : "Pendiente ›"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** «Puesta en marcha» de la portada del propietario. */
export function ClubSetupCard({ clubId }: { clubId: string }) {
  const progress = useQuery({
    queryKey: ["club-setup-progress", clubId],
    queryFn: () => adminService.clubs.setupProgress(clubId),
  });
  if (!progress.data) return null;
  return <ClubSetupSteps progress={progress.data} />;
}
