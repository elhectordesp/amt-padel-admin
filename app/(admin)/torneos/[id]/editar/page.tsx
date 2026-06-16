"use client";

import { Header } from "@/components/admin/header";
import { Field, Input, CustomSelect, TierPicker } from "@/components/admin/form";
import { TournamentImageUploader } from "@/components/admin/tournament-image-uploader";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { adminService } from "@/lib/services/admin";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// ── Schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  name:                 z.string().min(3, "Nombre requerido"),
  clubId:               z.string().min(1, "Club requerido"),
  imageUrl:             z.string().optional(),
  startDate:            z.string().min(1, "Fecha de inicio requerida"),
  endDate:              z.string().min(1, "Fecha de fin requerida"),
  prize:                z.string().optional(),
  tier:                 z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
  format:               z.string().optional(),
  scoringSystem:        z.string().optional(),
  matchDuration:             z.number().optional(),
  elimMatchDuration:         z.number().min(15).max(180).nullable().optional(),
  maxMatchesPerPlayerPerDay: z.number().min(1).max(10).nullable().optional(),
  registrationDeadline:      z.string().optional(),
  status:               z.enum(["DRAFT", "OPEN", "DRAW", "SCHEDULED", "ONGOING", "FINISHED", "CANCELLED"]),
}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "La fecha de fin no puede ser anterior a la de inicio" });
  }
  if (data.startDate && data.registrationDeadline) {
    const deadlineDate = data.registrationDeadline.split("T")[0];
    if (deadlineDate > data.startDate) {
      ctx.addIssue({ code: "custom", path: ["registrationDeadline"], message: "El cierre de inscripciones debe ser antes del inicio del torneo" });
    }
  }
});

type FormData = z.infer<typeof schema>;

// ── Main Page ─────────────────────────────────────────────────────────────
export default function EditarTorneoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc     = useQueryClient();
  const [pendingData, setPendingData] = useState<FormData | null>(null);

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["admin-tournament", id],
    queryFn:  () => adminService.tournaments.adminDetail(id),
  });

  const { data: clubs = [] } = useQuery({
    queryKey: ["admin-clubs"],
    queryFn:  () => adminService.clubs.list(),
  });

  const { data: activeRegistrations = 0 } = useQuery({
    queryKey: ["admin-tournament-reg-count", id],
    queryFn:  () => adminService.registrations.count(id),
    enabled:  !!id,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!tournament) return;

    // Convierte una fecha a string YYYY-MM-DD en hora local (no UTC)
    const toDateInput = (val: string | null | undefined): string => {
      if (!val) return "";
      const d = new Date(val);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Convierte a string YYYY-MM-DDTHH:mm en UTC para evitar drift de timezone en cada edición
    const toDateTimeInput = (val: string | null | undefined): string => {
      if (!val) return "";
      return new Date(val).toISOString().slice(0, 16);
    };

    const startStr   = toDateInput(tournament.startDate);
    const endStr     = toDateInput(tournament.endDate);
    const regDeadline = toDateTimeInput(tournament.registrationDeadline);

    reset({
      name:                 tournament.name,
      clubId:               tournament.club?.id ?? "",
      imageUrl:             tournament.imageUrl ?? "",
      startDate:            startStr,
      endDate:              endStr,
      prize:                tournament.prize ?? "",
      format:               tournament.format ?? "",
      scoringSystem:        tournament.scoringSystem ?? "",
      matchDuration:             tournament.matchDuration ?? 60,
      elimMatchDuration:         tournament.elimMatchDuration ?? null,
      maxMatchesPerPlayerPerDay: tournament.maxMatchesPerPlayerPerDay ?? null,
      registrationDeadline:      regDeadline,
      status:               tournament.status as FormData["status"],
      tier:                 tournament.tier ?? "BRONZE",
    });
  }, [tournament, reset]);

  const save = useMutation({
    mutationFn: (data: FormData) => adminService.tournaments.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tournament", id] });
      qc.invalidateQueries({ queryKey: ["tournament", id] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Torneo actualizado correctamente");
      router.push(`/torneos/${id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Editar torneo" />
        <div className="p-6 space-y-4 max-w-3xl mx-auto w-full">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-card animate-pulse border border-border" />
          ))}
        </div>
      </div>
    );
  }

  if (!tournament) return null;

  const imageUrlValue = watch("imageUrl") ?? "";

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Editar torneo" />

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/torneos" className="hover:text-foreground flex items-center gap-1">
            <ChevronLeft size={14} /> Torneos
          </Link>
          <span>/</span>
          <Link href={`/torneos/${id}`} className="hover:text-foreground truncate max-w-[200px]">
            {tournament.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">Editar</span>
        </div>

        {activeRegistrations > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-400">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              Este torneo tiene <strong>{activeRegistrations} inscripciones activas</strong>. Los cambios en fechas o formato pueden afectarles.
            </span>
          </div>
        )}

        <ConfirmModal
          open={!!pendingData}
          title="Cambio de estado"
          description={`¿Confirmas cambiar el estado a "${pendingData?.status}"? Esta acción puede afectar a inscripciones y partidos en curso.`}
          confirmLabel="Sí, cambiar estado"
          danger
          onConfirm={() => { if (pendingData) save.mutate(pendingData); setPendingData(null); }}
          onClose={() => setPendingData(null)}
        />

        <form
          onSubmit={handleSubmit((data) => {
            const DESTRUCTIVE = ["DRAW", "SCHEDULED", "ONGOING", "FINISHED", "CANCELLED"];
            const statusChanged = tournament && data.status !== tournament.status?.toUpperCase();
            if (statusChanged && DESTRUCTIVE.includes(data.status)) {
              setPendingData(data);
            } else {
              save.mutate(data);
            }
          })}
          className="space-y-6"
        >
          {/* Basic info */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-5 shadow-sm">
            <div>
              <h3 className="font-heading text-lg text-foreground">Información básica</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Datos generales del torneo</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre del torneo" error={errors.name?.message}>
                <Input {...register("name")} placeholder="AMT GOLD MADRID" />
              </Field>
              <Field label="Imagen del banner">
                <TournamentImageUploader
                  value={imageUrlValue}
                  onChange={(url) => setValue("imageUrl", url, { shouldDirty: true })}
                />
              </Field>
              <Field label="Club" error={errors.clubId?.message}>
                <CustomSelect
                  value={watch("clubId") ?? ""}
                  onChange={(v) => setValue("clubId", v, { shouldValidate: true, shouldDirty: true })}
                  options={[
                    { value: "", label: "Selecciona un club…" },
                    ...clubs.map((c) => ({ value: c.id, label: `${c.name} — ${c.city}` })),
                  ]}
                />
              </Field>
              <Field label="Premio (descripción)" error={errors.prize?.message}>
                <Input {...register("prize")} placeholder="5.000 € + trofeo" />
              </Field>
              <Field label="Fecha de inicio" error={errors.startDate?.message}>
                <Input {...register("startDate")} type="date" />
              </Field>
              <Field label="Fecha de fin" error={errors.endDate?.message}>
                <Input {...register("endDate")} type="date" />
              </Field>
            </div>
          </div>

          {/* Config */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-5 shadow-sm">
            <div>
              <h3 className="font-heading text-lg text-foreground">Configuración</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Formato, puntuación y estado</p>
            </div>
            
            <Field label="Tier del torneo">
              <TierPicker
                value={watch("tier") ?? "BRONZE"}
                onChange={(v) => setValue("tier", v as FormData["tier"], { shouldValidate: true, shouldDirty: true })}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Field label="Estado">
                <CustomSelect
                  options={[
                    { value: "DRAFT",     label: "🔵 Borrador" },
                    { value: "OPEN",      label: "🟢 Abierto (Inscripciones)" },
                    { value: "DRAW",      label: "🟣 Sorteo (Generando cuadro)" },
                    { value: "SCHEDULED", label: "🩵 Programado (Cuadro listo)" },
                    { value: "ONGOING",   label: "🟡 En curso" },
                    { value: "FINISHED",  label: "⚫ Finalizado" },
                    { value: "CANCELLED", label: "🔴 Cancelado" },
                  ]}
                  value={watch("status") ?? "OPEN"}
                  onChange={(v) => setValue("status", v as FormData["status"], { shouldValidate: true, shouldDirty: true })}
                />
              </Field>
              <Field label="Formato">
                <CustomSelect
                  options={[
                    { value: "", label: "— Sin especificar —" },
                    { value: "eliminatoria",                    label: "Eliminatoria directa" },
                    { value: "eliminatoria+consolacion",        label: "Eliminatoria + Consolación" },
                    { value: "grupos+eliminatoria",             label: "Grupos + Eliminatoria" },
                    { value: "grupos+eliminatoria+consolacion", label: "Grupos + Elim. + Consolación" },
                    { value: "round-robin",                     label: "Round Robin" },
                  ]}
                  value={watch("format") ?? ""}
                  onChange={(v) => setValue("format", v, { shouldValidate: true, shouldDirty: true })}
                />
              </Field>
              <Field label="Sistema de puntuación">
                <CustomSelect
                  options={[
                    { value: "", label: "— Sin especificar —" },
                    { value: "AMT+ELO+SPA", label: "Puntos AMT + ELO + SPA" },
                    { value: "AMT",         label: "Solo Puntos AMT" },
                    { value: "ELO",         label: "Solo ELO" },
                  ]}
                  value={watch("scoringSystem") ?? ""}
                  onChange={(v) => setValue("scoringSystem", v, { shouldValidate: true, shouldDirty: true })}
                />
              </Field>
              <Field label="Duración por partido (grupos)">
                <CustomSelect
                  options={[
                    { value: "60", label: "60 minutos" },
                    { value: "90", label: "90 minutos" },
                    { value: "120", label: "120 minutos" },
                  ]}
                  value={String(watch("matchDuration") ?? 60)}
                  onChange={(v) => setValue("matchDuration", Number(v), { shouldValidate: true, shouldDirty: true })}
                />
              </Field>
              <Field label="Duración por partido (eliminatoria)">
                <CustomSelect
                  options={[
                    { value: "", label: "Igual que grupos" },
                    { value: "60", label: "60 minutos" },
                    { value: "90", label: "90 minutos" },
                    { value: "120", label: "120 minutos" },
                  ]}
                  value={String(watch("elimMatchDuration") ?? "")}
                  onChange={(v) => setValue("elimMatchDuration", v === "" ? null : Number(v), { shouldValidate: true, shouldDirty: true })}
                />
              </Field>
              <Field label="Máx. partidos por jugador/día">
                <CustomSelect
                  options={[
                    { value: "", label: "Sin límite" },
                    { value: "1", label: "1 partido" },
                    { value: "2", label: "2 partidos" },
                    { value: "3", label: "3 partidos" },
                    { value: "4", label: "4 partidos" },
                  ]}
                  value={String(watch("maxMatchesPerPlayerPerDay") ?? "")}
                  onChange={(v) => setValue("maxMatchesPerPlayerPerDay", v === "" ? null : Number(v), { shouldValidate: true, shouldDirty: true })}
                />
              </Field>
              <Field label="Cierre de inscripciones">
                <Input {...register("registrationDeadline")} type="datetime-local" />
              </Field>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Link
              href={`/torneos/${id}`}
              className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={save.isPending || !isDirty}
              className="flex items-center gap-2 px-5 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-60 transition-colors"
            >
              {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {save.isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
