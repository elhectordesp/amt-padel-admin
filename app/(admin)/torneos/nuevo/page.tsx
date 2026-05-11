"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import type { Gender, CategoryLevel } from "@/types";

// ── Schemas ──────────────────────────────────────────────────────────────
const infoSchema = z.object({
  name:      z.string().min(3, "Nombre requerido"),
  venue:     z.string().min(2, "Sede requerida"),
  city:      z.string().min(2, "Ciudad requerida"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate:   z.string().min(1, "Fecha de fin requerida"),
  prize:     z.string().optional(),
});

const catSchema = z.object({
  categories: z.array(z.object({
    gender:     z.enum(["M", "F"]),
    level:      z.string().min(1),
    totalSpots: z.number().min(4).max(128),
    price:      z.number().min(0),
  })).min(1, "Añade al menos una categoría"),
});

const configSchema = z.object({
  format:              z.string().min(1),
  scoringSystem:       z.string().min(1),
  registrationDeadline:z.string().optional(),
});

type InfoData   = z.infer<typeof infoSchema>;
type CatData    = z.infer<typeof catSchema>;
type ConfigData = z.infer<typeof configSchema>;

// ── Constants ─────────────────────────────────────────────────────────────
const LEVELS: { value: CategoryLevel; label: string }[] = [
  { value: "1a", label: "1ª" }, { value: "2a", label: "2ª" },
  { value: "3a", label: "3ª" }, { value: "4a", label: "4ª" },
  { value: "5a", label: "5ª" }, { value: "6a", label: "6ª" },
  { value: "iniciacion", label: "Iniciación" },
];

const STEPS = [
  { num: 1, label: "Información"  },
  { num: 2, label: "Categorías"   },
  { num: 3, label: "Configuración"},
  { num: 4, label: "Confirmación" },
];

// ── Helper components ─────────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────
export default function NuevoTorneoPage() {
  const router = useRouter();
  const qc     = useQueryClient();
  const [step, setStep] = useState(1);

  // Accumulated form data
  const [infoData,   setInfoData]   = useState<InfoData   | null>(null);
  const [catData,    setCatData]    = useState<CatData    | null>(null);
  const [configData, setConfigData] = useState<ConfigData | null>(null);

  // ── Step 1: Info ───────────────────────────────────────────────────────
  const infoForm = useForm<InfoData>({ resolver: zodResolver(infoSchema) });

  // ── Step 2: Categories ────────────────────────────────────────────────
  const catForm = useForm<CatData>({
    resolver: zodResolver(catSchema),
    defaultValues: { categories: [{ gender: "M", level: "4a", totalSpots: 32, price: 25 }] },
  });
  const { fields, append, remove } = useFieldArray({ control: catForm.control, name: "categories" });

  // ── Step 3: Config ────────────────────────────────────────────────────
  const configForm = useForm<ConfigData>({
    resolver: zodResolver(configSchema),
    defaultValues: { format: "eliminatoria", scoringSystem: "AMT+ELO+SPA" },
  });

  // ── Mutation ──────────────────────────────────────────────────────────
  const create = useMutation({
    mutationFn: () => adminService.tournaments.create({
      ...infoData!,
      ...configData!,
      categories: catData!.categories.map((c) => ({
        gender:     c.gender as Gender,
        level:      c.level  as CategoryLevel,
        totalSpots: c.totalSpots,
        price:      c.price,
      })),
    }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Torneo creado correctamente");
      router.push(`/torneos/${t.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const goNext = async () => {
    if (step === 1) {
      const ok = await infoForm.trigger();
      if (!ok) return;
      setInfoData(infoForm.getValues());
      setStep(2);
    } else if (step === 2) {
      const ok = await catForm.trigger();
      if (!ok) return;
      setCatData(catForm.getValues());
      setStep(3);
    } else if (step === 3) {
      const ok = await configForm.trigger();
      if (!ok) return;
      setConfigData(configForm.getValues());
      setStep(4);
    } else if (step === 4) {
      create.mutate();
    }
  };

  const goBack = () => setStep((s) => s - 1);

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Crear torneo" />

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">

        {/* Stepper */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const done    = step > s.num;
            const current = step === s.num;
            return (
              <div key={s.num} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                    done    ? "bg-[#D4AF37] border-[#D4AF37] text-[#0C0C0C]" :
                    current ? "border-[#D4AF37] text-[#D4AF37]" :
                              "border-border text-muted-foreground"
                  }`}>
                    {done ? <Check size={14} /> : s.num}
                  </div>
                  <span className={`text-[10px] font-medium ${current ? "text-[#D4AF37]" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-4 ${done ? "bg-[#D4AF37]" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content card */}
        <div className="bg-card border border-border rounded-lg p-6">

          {/* ── STEP 1: INFO ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-heading text-lg text-foreground">Información básica</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Datos generales del torneo</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nombre del torneo" error={infoForm.formState.errors.name?.message}>
                  <Input
                    {...infoForm.register("name")}
                    placeholder="AMT GOLD MADRID"
                  />
                </Field>
                <Field label="Club / Sede" error={infoForm.formState.errors.venue?.message}>
                  <Input
                    {...infoForm.register("venue")}
                    placeholder="Club La Moraleja"
                  />
                </Field>
                <Field label="Ciudad" error={infoForm.formState.errors.city?.message}>
                  <Input
                    {...infoForm.register("city")}
                    placeholder="Madrid"
                  />
                </Field>
                <Field label="Premio total" error={infoForm.formState.errors.prize?.message}>
                  <Input
                    {...infoForm.register("prize")}
                    placeholder="5.000 €"
                  />
                </Field>
                <Field label="Fecha de inicio" error={infoForm.formState.errors.startDate?.message}>
                  <Input
                    {...infoForm.register("startDate")}
                    type="date"
                  />
                </Field>
                <Field label="Fecha de fin" error={infoForm.formState.errors.endDate?.message}>
                  <Input
                    {...infoForm.register("endDate")}
                    type="date"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 2: CATEGORIES ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-lg text-foreground">Categorías del torneo</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Define las categorías y plazas disponibles</p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ gender: "M", level: "4a", totalSpots: 16, price: 25 })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.3)] text-xs text-[#D4AF37] font-medium hover:bg-[rgba(212,175,55,0.2)] transition-colors"
                >
                  <Plus size={13} /> Añadir categoría
                </button>
              </div>

              {catForm.formState.errors.categories?.root && (
                <p className="text-xs text-destructive">{catForm.formState.errors.categories.root.message}</p>
              )}

              <div className="space-y-3">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_1fr_100px_100px_36px] gap-3 px-1">
                  {["Género", "Nivel", "Plazas", "Precio (€)", ""].map((h) => (
                    <span key={h} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</span>
                  ))}
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[1fr_1fr_100px_100px_36px] gap-3 items-center p-3 bg-secondary/50 rounded-md border border-border">
                    <Select {...catForm.register(`categories.${index}.gender`)}>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                    </Select>
                    <Select {...catForm.register(`categories.${index}.level`)}>
                      {LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      {...catForm.register(`categories.${index}.totalSpots`, { valueAsNumber: true })}
                      min={4} max={128}
                    />
                    <Input
                      type="number"
                      {...catForm.register(`categories.${index}.price`, { valueAsNumber: true })}
                      min={0} step={0.5}
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="p-2 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: CONFIG ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-heading text-lg text-foreground">Configuración general</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Formato, puntuación y plazos</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Formato" error={configForm.formState.errors.format?.message}>
                  <Select {...configForm.register("format")}>
                    <option value="eliminatoria">Eliminatoria + Consolación</option>
                    <option value="grupos+eliminatoria">Grupos + Eliminatoria</option>
                    <option value="round-robin">Round Robin</option>
                  </Select>
                </Field>
                <Field label="Sistema de puntuación" error={configForm.formState.errors.scoringSystem?.message}>
                  <Select {...configForm.register("scoringSystem")}>
                    <option value="AMT+ELO+SPA">Puntos AMT + ELO + SPA</option>
                    <option value="AMT">Solo Puntos AMT</option>
                    <option value="ELO">Solo ELO</option>
                  </Select>
                </Field>
                <Field label="Cierre de inscripciones" error={configForm.formState.errors.registrationDeadline?.message}>
                  <Input
                    {...configForm.register("registrationDeadline")}
                    type="datetime-local"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 4: CONFIRMATION ── */}
          {step === 4 && infoData && catData && configData && (
            <div className="space-y-5">
              <div>
                <h3 className="font-heading text-lg text-foreground">Confirmar creación</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Revisa los datos antes de crear el torneo</p>
              </div>

              <div className="space-y-3">
                {/* Info summary */}
                <div className="bg-secondary/50 rounded-lg border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Información básica</p>
                  {[
                    ["Nombre",   infoData.name],
                    ["Sede",     infoData.venue],
                    ["Ciudad",   infoData.city],
                    ["Fechas",   `${infoData.startDate} → ${infoData.endDate}`],
                    ["Premio",   infoData.prize ?? "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground font-medium">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Categories summary */}
                <div className="bg-secondary/50 rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Categorías ({catData.categories.length})
                  </p>
                  <div className="space-y-1.5">
                    {catData.categories.map((c, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {c.gender === "M" ? "Masc." : "Fem."} {LEVELS.find((l) => l.value === c.level)?.label}
                        </span>
                        <span className="text-foreground">{c.totalSpots} plazas · {c.price} €/pareja</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Config summary */}
                <div className="bg-secondary/50 rounded-lg border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Configuración</p>
                  {[
                    ["Formato",     configData.format],
                    ["Puntuación",  configData.scoringSystem],
                    ["Cierre insc.", configData.registrationDeadline ?? "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={step === 1 ? () => router.push("/torneos") : goBack}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronLeft size={15} />
            {step === 1 ? "Cancelar" : "Anterior"}
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={create.isPending}
            className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-60 transition-colors"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            {step === 4 ? (create.isPending ? "Creando..." : "Crear torneo") : "Siguiente"}
            {step < 4 && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
