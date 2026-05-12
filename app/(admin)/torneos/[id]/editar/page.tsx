"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";

const schema = z.object({
  name:                 z.string().min(3, "Nombre requerido"),
  venue:                z.string().min(2, "Sede requerida"),
  city:                 z.string().min(2, "Ciudad requerida"),
  startDate:            z.string().min(1, "Fecha de inicio requerida"),
  endDate:              z.string().min(1, "Fecha de fin requerida"),
  prize:                z.string().optional(),
  format:               z.string().optional(),
  scoringSystem:        z.string().optional(),
  registrationDeadline: z.string().optional(),
  status:               z.enum(["open", "ongoing", "finished"]),
});

type FormData = z.infer<typeof schema>;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors ${props.className ?? ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors ${props.className ?? ""}`}
    />
  );
}

export default function EditarTorneoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc     = useQueryClient();

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn:  () => adminService.tournaments.detail(id),
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!tournament) return;
    reset({
      name:                 tournament.name,
      venue:                tournament.venue,
      city:                 tournament.city ?? "",
      startDate:            tournament.startDate ?? "",
      endDate:              tournament.endDate   ?? "",
      prize:                tournament.prize     ?? "",
      format:               tournament.format    ?? "",
      scoringSystem:        tournament.scoringSystem        ?? "",
      registrationDeadline: tournament.registrationDeadline ?? "",
      status:               tournament.status,
    });
  }, [tournament, reset]);

  const save = useMutation({
    mutationFn: (data: FormData) => adminService.tournaments.update(id, data),
    onSuccess: () => {
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
        <div className="p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-card animate-pulse border border-border" />
          ))}
        </div>
      </div>
    );
  }

  if (!tournament) return null;

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
          <Link href={`/torneos/${id}`} className="hover:text-foreground">{tournament.name}</Link>
          <span>/</span>
          <span className="text-foreground">Editar</span>
        </div>

        <form onSubmit={handleSubmit((data) => save.mutate(data))} className="space-y-6">
          {/* Basic info */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-5">
            <div>
              <h3 className="font-heading text-lg text-foreground">Información básica</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Datos generales del torneo</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre del torneo" error={errors.name?.message}>
                <Input {...register("name")} placeholder="AMT GOLD MADRID" />
              </Field>
              <Field label="Club / Sede" error={errors.venue?.message}>
                <Input {...register("venue")} placeholder="Club La Moraleja" />
              </Field>
              <Field label="Ciudad" error={errors.city?.message}>
                <Input {...register("city")} placeholder="Madrid" />
              </Field>
              <Field label="Premio total" error={errors.prize?.message}>
                <Input {...register("prize")} placeholder="5.000 €" />
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
          <div className="bg-card border border-border rounded-lg p-6 space-y-5">
            <div>
              <h3 className="font-heading text-lg text-foreground">Configuración</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Formato, puntuación y estado</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Estado">
                <Select {...register("status")}>
                  <option value="open">Abierto</option>
                  <option value="ongoing">En curso</option>
                  <option value="finished">Finalizado</option>
                </Select>
              </Field>
              <Field label="Formato">
                <Select {...register("format")}>
                  <option value="">— Sin especificar —</option>
                  <option value="eliminatoria">Eliminatoria + Consolación</option>
                  <option value="grupos+eliminatoria">Grupos + Eliminatoria</option>
                  <option value="round-robin">Round Robin</option>
                </Select>
              </Field>
              <Field label="Sistema de puntuación">
                <Select {...register("scoringSystem")}>
                  <option value="">— Sin especificar —</option>
                  <option value="AMT+ELO+SPA">Puntos AMT + ELO + SPA</option>
                  <option value="AMT">Solo Puntos AMT</option>
                  <option value="ELO">Solo ELO</option>
                </Select>
              </Field>
              <Field label="Cierre de inscripciones">
                <Input {...register("registrationDeadline")} type="datetime-local" />
              </Field>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
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
