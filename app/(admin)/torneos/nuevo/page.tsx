"use client";

import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Header } from "@/components/admin/header";
import { Field, Input, CustomSelect, TierPicker } from "@/components/admin/form";
import { adminService } from "@/lib/services/admin";
import { TIER_LABEL } from "@/lib/constants";
import type { CategoryLevel, Gender } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// ── Schemas ──────────────────────────────────────────────────────────────
const infoSchema = z.object({
  name:      z.string().min(3, "Nombre requerido"),
  clubId:    z.string().min(1, "Club requerido"),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate:   z.string().min(1, "Fecha de fin requerida"),
  prize:     z.string().optional(),
  imageUrl:  z.string().url("Debe ser una URL válida").optional().or(z.literal("")),
}).refine(
  (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate,
  { message: "La fecha de fin debe ser igual o posterior al inicio", path: ["endDate"] },
);

const catSchema = z.object({
  categories: z.array(z.object({
    gender:            z.enum(["M", "F"]),
    level:             z.string().min(1),
    totalSpots:        z.number().min(4).max(128),
    price:             z.number().min(0),
    prizeChampion:     z.string().optional(),
    prizeRunnerUp:     z.string().optional(),
    prizeConsolation:  z.string().optional(),
    hasConsolation:    z.boolean().optional(),
  })).min(1, "Añade al menos una categoría"),
});

const configSchema = z.object({
  tier:                z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
  format:              z.string().min(1),
  scoringSystem:       z.string().min(1),
  matchDuration:       z.number().int().min(10).max(180),
  registrationDeadline:z.string().min(1, "La fecha de cierre de inscripciones es obligatoria"),
  hasShirts:           z.boolean(),
  useSeeding:          z.boolean(),
  courts:              z.string().min(1, "Añade al menos una pista (necesario para programar partidos automáticamente)"),
});

const DAY_TYPE_OPTIONS = [
  { value: "AMBOS",         label: "Grupos + Eliminatorias" },
  { value: "GRUPOS",        label: "Solo grupos" },
  { value: "ELIMINATORIAS", label: "Solo eliminatorias" },
] as const;

const scheduleSchema = z.object({
  days: z.array(z.object({
    date: z.string().min(1, "La fecha de la jornada es obligatoria"),
    type: z.enum(["GRUPOS", "ELIMINATORIAS", "AMBOS"]).default("AMBOS"),
    blocks: z.array(z.object({
      start: z.string(),
      end:   z.string(),
    })).min(1, "Añade al menos un bloque horario"),
  })).min(1, "Añade al menos una jornada"),
});

type InfoData     = z.infer<typeof infoSchema>;
type CatData      = z.infer<typeof catSchema>;
type ConfigData   = z.infer<typeof configSchema>;
type ScheduleData = z.infer<typeof scheduleSchema>;

// ── Constants ─────────────────────────────────────────────────────────────
const LEVELS: { value: CategoryLevel; label: string }[] = [
  { value: "1a", label: "1ª" }, { value: "2a", label: "2ª" },
  { value: "3a", label: "3ª" }, { value: "4a", label: "4ª" },
  { value: "5a", label: "5ª" }, { value: "6a", label: "6ª" },
  { value: "iniciacion", label: "Iniciación" },
];

const FORMAT_LABEL: Record<string, string> = {
  "eliminatoria":        "Eliminatoria + Consolación",
  "grupos+eliminatoria": "Grupos + Eliminatoria",
  "round-robin":         "Round Robin",
  "cuadro":              "Cuadro",
};

const SCORING_LABEL: Record<string, string> = {
  "AMT+ELO+SPA": "Puntos AMT + ELO + SPA",
  "AMT":         "Solo Puntos AMT",
  "ELO":         "Solo ELO",
};


const STEPS = [
  { num: 1, label: "Información"  },
  { num: 2, label: "Categorías"   },
  { num: 3, label: "Configuración"},
  { num: 4, label: "Horarios"     },
  { num: 5, label: "Confirmación" },
];

// ── Main ──────────────────────────────────────────────────────────────────
export default function NuevoTorneoPage() {
  const router = useRouter();
  const qc     = useQueryClient();
  const [step, setStep] = useState(1);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Accumulated form data
  const [infoData,     setInfoData]     = useState<InfoData     | null>(null);
  const [catData,      setCatData]      = useState<CatData      | null>(null);
  const [configData,   setConfigData]   = useState<ConfigData   | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);

  // ── Clubs list for selector ───────────────────────────────────────────
  const { data: clubs = [] } = useQuery({
    queryKey: ["admin-clubs"],
    queryFn:  () => adminService.clubs.list(),
  });

  // ── Step 1: Info ───────────────────────────────────────────────────────
  const infoForm = useForm<InfoData>({
    resolver:      zodResolver(infoSchema),
    defaultValues: infoData ?? undefined,
  });

  // Warn on accidental navigation away (must be after infoForm declaration)
  useEffect(() => {
    const dirty = step > 1 || infoForm.formState.isDirty;
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step, infoForm.formState.isDirty]);

  const handleCancel = () => {
    const dirty = step > 1 || infoForm.formState.isDirty;
    if (dirty) setShowLeaveModal(true);
    else router.push("/torneos");
  };

  // ── Step 2: Categories ────────────────────────────────────────────────
  const catForm = useForm<CatData>({
    resolver:      zodResolver(catSchema),
    defaultValues: catData ?? { categories: [{ gender: "M", level: "4a", totalSpots: 32, price: 25, prizeChampion: "", prizeRunnerUp: "", prizeConsolation: "", hasConsolation: false }] },
  });
  const { fields, append, remove } = useFieldArray({ control: catForm.control, name: "categories" });

  // ── Step 3: Config ────────────────────────────────────────────────────
  const configForm = useForm<ConfigData>({
    resolver:      zodResolver(configSchema),
    defaultValues: configData ?? { tier: "BRONZE", format: "eliminatoria", scoringSystem: "AMT+ELO+SPA", matchDuration: 60, hasShirts: false, useSeeding: false, courts: "" },
  });

  // ── Step 4: Schedule ──────────────────────────────────────────────────
  const scheduleForm = useForm<ScheduleData>({
    resolver:      zodResolver(scheduleSchema) as any,
    defaultValues: scheduleData ?? { days: [] },
  });

  // Auto-generate days when reaching step 4
  useEffect(() => {
    if (step === 4 && infoData && (scheduleForm.getValues().days.length === 0)) {
      const start = new Date(infoData.startDate);
      const end   = new Date(infoData.endDate);
      const days: ScheduleData["days"] = [];
      const curr = new Date(start);
      while (curr <= end) {
        days.push({
          date:   curr.toISOString().split("T")[0],
          type:   "AMBOS" as const,
          blocks: [{ start: "16:00", end: "21:00" }],
        });
        curr.setDate(curr.getDate() + 1);
      }
      scheduleForm.reset({ days });
    }
  }, [step, infoData, scheduleForm]);

  // ── Mutation ──────────────────────────────────────────────────────────
  const create = useMutation({
    mutationFn: () => adminService.tournaments.create({
      ...infoData!,
      tier:        configData!.tier,
      format:      configData!.format,
      scoringSystem: configData!.scoringSystem,
      matchDuration: configData!.matchDuration,
      registrationDeadline: configData!.registrationDeadline || undefined,
      hasShirts:   configData!.hasShirts,
      useSeeding:  configData!.useSeeding,
      courts:      configData!.courts
        ? configData!.courts.split(",").map((c) => c.trim()).filter(Boolean)
        : [],
      categories: catData!.categories.map((c) => ({
        gender:          c.gender as Gender,
        level:           c.level  as CategoryLevel,
        totalSpots:      c.totalSpots,
        price:           c.price,
        prizeChampion:   c.prizeChampion   || undefined,
        prizeRunnerUp:   c.prizeRunnerUp   || undefined,
        prizeConsolation:c.hasConsolation ? (c.prizeConsolation || undefined) : undefined,
        hasConsolation:  c.hasConsolation  ?? false,
      })),
      schedule: scheduleData?.days.map(d => ({
        date: d.date,
        blocks: d.blocks
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
      const cfg = configForm.getValues();
      if (cfg.registrationDeadline) {
        const deadline = new Date(cfg.registrationDeadline);
        const now      = new Date();
        const startDate = infoData?.startDate ? new Date(infoData.startDate) : null;
        const endDate   = infoData?.endDate   ? new Date(infoData.endDate)   : null;

        if (deadline <= now) {
          configForm.setError("registrationDeadline", {
            message: "El cierre de inscripciones debe ser una fecha futura",
          });
          return;
        }
        if (startDate && deadline >= startDate) {
          configForm.setError("registrationDeadline", {
            message: "El cierre de inscripciones debe ser anterior al inicio del torneo",
          });
          return;
        }
        if (endDate && deadline > endDate) {
          configForm.setError("registrationDeadline", {
            message: "El cierre de inscripciones no puede ser posterior a la fecha fin del torneo",
          });
          return;
        }
      }
      setConfigData(cfg);
      setStep(4);
    } else if (step === 4) {
      const ok = await scheduleForm.trigger();
      if (!ok) return;
      setScheduleData(scheduleForm.getValues());
      setStep(5);
    } else if (step === 5) {
      if (submitted) return;
      setSubmitted(true);
      create.mutate();
    }
  };

  const goBack = () => {
    if (step === 2 && infoData)   infoForm.reset(infoData);
    if (step === 3 && catData)    catForm.reset({ categories: catData.categories });
    if (step === 4 && configData) configForm.reset(configData);
    if (step === 5 && scheduleData) scheduleForm.reset(scheduleData);
    setStep((s) => s - 1);
  };

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
                <Field label="Club" error={infoForm.formState.errors.clubId?.message}>
                  <CustomSelect
                    value={infoForm.watch("clubId") ?? ""}
                    onChange={(v) => infoForm.setValue("clubId", v, { shouldValidate: true })}
                    options={[
                      { value: "", label: "Selecciona un club…" },
                      ...clubs.map((c) => ({ value: c.id, label: `${c.name} — ${c.city}` })),
                    ]}
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
                  {(() => {
                    const v = infoForm.watch("startDate");
                    return v && v < new Date().toISOString().slice(0, 10) ? (
                      <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                        ⚠️ La fecha de inicio es anterior a hoy.
                      </p>
                    ) : null;
                  })()}
                </Field>
                <Field label="Fecha de fin" error={infoForm.formState.errors.endDate?.message}>
                  <Input
                    {...infoForm.register("endDate")}
                    type="date"
                  />
                </Field>
              </div>
              <Field label="URL de imagen del banner (opcional)" error={infoForm.formState.errors.imageUrl?.message}>
                <div className="flex flex-col gap-3">
                  <Input
                    {...infoForm.register("imageUrl")}
                    placeholder="https://example.com/banner.jpg"
                  />
                  {infoForm.watch("imageUrl") && (
                    <img
                      src={infoForm.watch("imageUrl")}
                      alt="Preview banner"
                      className="w-full h-32 object-cover rounded-md border border-border"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      onLoad={(e) => { (e.target as HTMLImageElement).style.display = "block"; }}
                    />
                  )}
                </div>
              </Field>
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
                  onClick={() => append({ gender: "M", level: "4a", totalSpots: 16, price: 25, prizeChampion: "", prizeRunnerUp: "", prizeConsolation: "", hasConsolation: false })}
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

                {fields.map((field, index) => {
                  const genderVal       = catForm.watch(`categories.${index}.gender`);
                  const levelVal        = catForm.watch(`categories.${index}.level`);
                  const hasConsolation  = catForm.watch(`categories.${index}.hasConsolation`);
                  return (
                    <div key={field.id} className="p-3 bg-secondary/50 rounded-md border border-border space-y-3">
                      {/* Fila principal */}
                      <div className="grid grid-cols-[1fr_1fr_100px_100px_36px] gap-3 items-center">
                        <CustomSelect
                          compact
                          options={[
                            { value: "M", label: "Masculino" },
                            { value: "F", label: "Femenino" },
                          ]}
                          value={genderVal}
                          onChange={(v) => catForm.setValue(`categories.${index}.gender`, v as "M" | "F")}
                        />
                        <CustomSelect
                          compact
                          options={LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                          value={levelVal}
                          onChange={(v) => catForm.setValue(`categories.${index}.level`, v)}
                        />
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

                      {/* Premios por categoría */}
                      <div className="border-t border-border/50 pt-2.5 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Premios</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#D4AF37] font-semibold w-24 shrink-0">🥇 Campeón</span>
                            <Input
                              {...catForm.register(`categories.${index}.prizeChampion`)}
                              placeholder="Ej: Pala Head + 300€"
                              className="text-xs h-8"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground font-semibold w-24 shrink-0">🥈 Subcampeón</span>
                            <Input
                              {...catForm.register(`categories.${index}.prizeRunnerUp`)}
                              placeholder="Ej: 150€"
                              className="text-xs h-8"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer w-fit">
                          <input
                            type="checkbox"
                            {...catForm.register(`categories.${index}.hasConsolation`)}
                            className="w-3.5 h-3.5 accent-[#D4AF37]"
                          />
                          <span className="text-[11px] text-muted-foreground">Hay premio de consolación</span>
                        </label>
                        {hasConsolation && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground font-semibold w-24 shrink-0">🏅 Consolación</span>
                            <Input
                              {...catForm.register(`categories.${index}.prizeConsolation`)}
                              placeholder="Ej: Material deportivo"
                              className="text-xs h-8"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 3: CONFIG ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-heading text-lg text-foreground">Configuración general</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Formato, puntuación y plazos</p>
              </div>

              {/* Grupo 1: Formato del torneo */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2">
                  Formato del torneo
                </p>
                <Field label="Tier del torneo">
                  <TierPicker
                    value={configForm.watch("tier")}
                    onChange={(v) => configForm.setValue("tier", v as ConfigData["tier"], { shouldValidate: true })}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Formato" error={configForm.formState.errors.format?.message}>
                    <CustomSelect
                      options={[
                        { value: "eliminatoria",        label: "Eliminatoria + Consolación" },
                        { value: "grupos+eliminatoria", label: "Grupos + Eliminatoria" },
                        { value: "round-robin",         label: "Round Robin" },
                        { value: "cuadro",              label: "Cuadro" },
                      ]}
                      value={configForm.watch("format")}
                      onChange={(v) => configForm.setValue("format", v, { shouldValidate: true })}
                    />
                  </Field>
                  <Field label="Sistema de puntuación" error={configForm.formState.errors.scoringSystem?.message}>
                    <CustomSelect
                      options={[
                        { value: "AMT+ELO+SPA", label: "Puntos AMT + ELO + SPA" },
                        { value: "AMT",         label: "Solo Puntos AMT" },
                        { value: "ELO",         label: "Solo ELO" },
                      ]}
                      value={configForm.watch("scoringSystem")}
                      onChange={(v) => configForm.setValue("scoringSystem", v, { shouldValidate: true })}
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-3 p-3 rounded-md border border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition-colors">
                  <input
                    type="checkbox"
                    {...configForm.register("useSeeding")}
                    className="w-4 h-4 accent-[#D4AF37]"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Cabezas de serie (seeding por SPA)</p>
                    <p className="text-xs text-muted-foreground">Los equipos se distribuyen en grupos/cuadro según su ranking SPA. Sin activar, el sorteo es aleatorio.</p>
                  </div>
                </label>
              </div>

              {/* Grupo 2: Logística */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2">
                  Logística
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Duración por partido" error={configForm.formState.errors.matchDuration?.message}>
                    <CustomSelect
                      options={[
                        { value: "60",  label: "60 minutos" },
                        { value: "90",  label: "90 minutos" },
                        { value: "120", label: "120 minutos" },
                      ]}
                      value={String(configForm.watch("matchDuration"))}
                      onChange={(v) => configForm.setValue("matchDuration", Number(v), { shouldValidate: true })}
                    />
                  </Field>
                  <Field label="Cierre de inscripciones" error={configForm.formState.errors.registrationDeadline?.message}>
                    <Input
                      {...configForm.register("registrationDeadline")}
                      type="datetime-local"
                    />
                  </Field>
                  <Field label="Pistas disponibles">
                    <Input
                      {...configForm.register("courts")}
                      placeholder="Pista 1, Pista 2, Pista 3..."
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Separadas por coma</p>
                  </Field>
                </div>
                <label className="flex items-center gap-3 p-3 rounded-md border border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition-colors">
                  <input
                    type="checkbox"
                    {...configForm.register("hasShirts")}
                    className="w-4 h-4 accent-[#D4AF37]"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Incluir camisetas</p>
                    <p className="text-xs text-muted-foreground">Los jugadores deberán indicar su talla al inscribirse</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ── STEP 4: SCHEDULE ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-heading text-lg text-foreground">Horarios por jornada</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Configura los tramos de mañana y tarde para cada día</p>
              </div>
              
              <div className="space-y-4">
                {scheduleForm.watch("days").map((day, dIdx) => (
                  <div key={day.date} className="p-4 bg-secondary/30 rounded-lg border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground capitalize">
                        {new Date(day.date).toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const blocks = [...scheduleForm.getValues().days[dIdx].blocks, { start: "16:00", end: "21:00" }];
                          scheduleForm.setValue(`days.${dIdx}.blocks`, blocks);
                        }}
                        className="text-[10px] font-bold text-[#D4AF37] uppercase hover:underline"
                      >
                        + Añadir tramo
                      </button>
                    </div>

                    {/* Tipo de jornada */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Tipo de jornada:</span>
                      <div className="flex gap-1">
                        {DAY_TYPE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => scheduleForm.setValue(`days.${dIdx}.type`, opt.value)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                              scheduleForm.watch(`days.${dIdx}.type`) === opt.value
                                ? "bg-[#D4AF37]/20 border-[#D4AF37]/60 text-[#D4AF37]"
                                : "border-border text-muted-foreground hover:border-border/80"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {day.blocks.map((block, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-3">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <Field label="Inicio">
                              <input
                                type="time"
                                defaultValue={block.start}
                                onBlur={(e) => {
                                  const b = [...scheduleForm.getValues().days[dIdx].blocks];
                                  b[bIdx] = { ...b[bIdx], start: e.target.value };
                                  scheduleForm.setValue(`days.${dIdx}.blocks`, b, { shouldDirty: true });
                                }}
                                className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
                              />
                            </Field>
                            <Field label="Fin">
                              <input
                                type="time"
                                defaultValue={block.end}
                                onBlur={(e) => {
                                  const b = [...scheduleForm.getValues().days[dIdx].blocks];
                                  b[bIdx] = { ...b[bIdx], end: e.target.value };
                                  scheduleForm.setValue(`days.${dIdx}.blocks`, b, { shouldDirty: true });
                                }}
                                className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
                              />
                            </Field>
                          </div>
                          {day.blocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const b = scheduleForm.getValues().days[dIdx].blocks.filter((_, i) => i !== bIdx);
                                scheduleForm.setValue(`days.${dIdx}.blocks`, b);
                              }}
                              className="p-2 mt-5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 5: CONFIRMATION ── */}
          {step === 5 && infoData && catData && configData && (
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
                  <div className="space-y-2.5">
                    {catData.categories.map((c, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground font-medium">
                            {c.gender === "M" ? "Masc." : "Fem."} {LEVELS.find((l) => l.value === c.level)?.label}
                          </span>
                          <span className="text-foreground">{c.totalSpots} plazas · {c.price} €/pareja</span>
                        </div>
                        {(c.prizeChampion || c.prizeRunnerUp) && (
                          <div className="text-xs text-muted-foreground pl-2 space-y-0.5">
                            {c.prizeChampion  && <p>🥇 Campeón: <span className="text-foreground">{c.prizeChampion}</span></p>}
                            {c.prizeRunnerUp  && <p>🥈 Subcampeón: <span className="text-foreground">{c.prizeRunnerUp}</span></p>}
                            {c.hasConsolation && c.prizeConsolation && <p>🏅 Consolación: <span className="text-foreground">{c.prizeConsolation}</span></p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Config summary */}
                <div className="bg-secondary/50 rounded-lg border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Configuración</p>
                  {[
                    ["Tier",         TIER_LABEL[configData.tier] ?? configData.tier],
                    ["Formato",      FORMAT_LABEL[configData.format] ?? configData.format],
                    ["Puntuación",   SCORING_LABEL[configData.scoringSystem] ?? configData.scoringSystem],
                    ["Duración part.", `${configData.matchDuration} mins`],
                    ["Cierre insc.", configData.registrationDeadline
                      ? new Date(configData.registrationDeadline).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—"],
                    ["Camisetas",    configData.hasShirts  ? "Sí" : "No"],
                    ["Cabezas de serie", configData.useSeeding ? "Sí (por SPA)" : "No (sorteo)"],
                    ["Pistas",       configData.courts || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground font-medium">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Schedule summary */}
                <div className="bg-secondary/50 rounded-lg border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Horarios</p>
                  {scheduleData?.days.map((d) => (
                    <div key={d.date} className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">
                        {new Date(d.date).toLocaleDateString("es-ES", { weekday: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-foreground">
                        {d.blocks.map(b => `${b.start}-${b.end}`).join(", ")}
                      </span>
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
            onClick={step === 1 ? handleCancel : goBack}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronLeft size={15} />
            {step === 1 ? "Cancelar" : "Anterior"}
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={create.isPending || submitted}
            className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-60 transition-colors"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            {step === 5 ? (create.isPending ? "Creando..." : "Crear torneo") : "Siguiente"}
            {step < 5 && <ChevronRight size={15} />}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showLeaveModal}
        title="¿Salir sin guardar?"
        description="Perderás todos los datos introducidos en el formulario."
        confirmLabel="Salir"
        danger
        onClose={() => setShowLeaveModal(false)}
        onConfirm={() => router.push("/torneos")}
      />
    </div>
  );
}
