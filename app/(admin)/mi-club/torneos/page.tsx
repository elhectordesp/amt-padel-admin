/**
 * /mi-club/torneos — opciones de torneo del club: los valores con los que el
 * asistente de «Nuevo torneo» empieza cada torneo del club (cada torneo se
 * puede cambiar antes de crearlo y después, en Editar). Sin guardar, el back
 * da los de siempre. Guardar manda todos los campos.
 */

"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/admin/error-state";
import { Header } from "@/components/admin/header";
import { CustomSelect, Field, Input } from "@/components/admin/form";
import { PlainTextField, TournamentVisibilityFields } from "@/components/admin/tournament-options-fields";
import { Button } from "@/components/ui/button";
import { adminService, clubTournamentConfigQK } from "@/lib/services/admin";
import { useRole, isClub } from "@/lib/use-role";
import {
  TOURNAMENT_DESCRIPTION_MAX,
  TOURNAMENT_RULES_MAX,
  WIZARD_FORMAT_OPTIONS,
  matchDurationOptions,
  tournamentDefaultsFromConfig,
  tournamentDefaultsIssues,
  tournamentDefaultsPayload,
  type TournamentDefaults,
} from "@/lib/utils/tournament-options";

export default function MiClubTorneosPage() {
  const { role, clubId } = useRole();
  const qc = useQueryClient();
  const enabled = !!clubId && isClub(role);

  const query = useQuery({
    queryKey: clubTournamentConfigQK(clubId ?? ""),
    queryFn:  () => adminService.clubTournamentConfig.get(clubId!),
    enabled,
  });

  const [form, setForm] = useState<TournamentDefaults | null>(null);

  // Se rellena la primera vez que llegan: después el usuario ya está editando
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (query.data && !form) setForm(tournamentDefaultsFromConfig(query.data));
  }, [query.data, form]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const issues = form ? tournamentDefaultsIssues(form) : {};

  const save = useMutation({
    mutationFn: () => adminService.clubTournamentConfig.update(clubId!, tournamentDefaultsPayload(form!)),
    onSuccess: (saved) => {
      // El asistente las lee de aquí: el próximo torneo ya sale con las nuevas
      qc.setQueryData(clubTournamentConfigQK(clubId!), saved);
      toast.success("Opciones de torneo guardadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSave = () => {
    if (Object.keys(issues).length > 0) {
      toast.error("Revisa los campos marcados en rojo");
      return;
    }
    save.mutate();
  };

  const spinner = (
    <div className="flex h-full items-center justify-center p-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
  if (role === null) return spinner;
  if (!enabled) {
    return (
      <>
        <Header title="Opciones de torneo" />
        <p className="p-4 sm:p-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </>
    );
  }
  // Sin ellas no se enseña nada: con unas supuestas, guardar pisaría las del club
  if (!form && query.isError) {
    return (
      <>
        <Header title="Opciones de torneo" />
        <ErrorState
          message="No se pudieron cargar las opciones de torneo del club."
          onRetry={() => void query.refetch()}
        />
      </>
    );
  }
  if (!form) return spinner;

  const set = (patch: Partial<TournamentDefaults>) =>
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  const intField = (value: number) => (Number.isFinite(value) ? value : "");
  const toInt = (raw: string) => (raw === "" ? NaN : Number(raw));

  return (
    <>
      <Header title="Opciones de torneo" />
      <div className="p-4 sm:p-6 max-w-3xl space-y-6">
        <p className="text-sm text-muted-foreground">
          Con estos valores empieza cada torneo nuevo de tu club en «Nuevo torneo». En cada torneo los puedes cambiar antes de crearlo, y después en Editar; cambiarlos aquí no toca los torneos que ya existen.
        </p>

        {/* Guardar, en el contenido: la cabecera del panel va sola y a todo el ancho */}
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={save.isPending} size="sm">
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar
          </Button>
        </div>

        <Section title="Sobre el torneo y normas" description="Texto plano, sin formato: se enseña tal cual, con sus saltos de línea, en el visor público del torneo.">
          <PlainTextField
            label="Sobre el torneo"
            value={form.description}
            onChange={(description) => set({ description })}
            max={TOURNAMENT_DESCRIPTION_MAX}
            placeholder="Qué es el torneo, a quién va dirigido, qué incluye…"
            error={issues.description}
          />
          <PlainTextField
            label="Normas"
            value={form.rules}
            onChange={(rules) => set({ rules })}
            max={TOURNAMENT_RULES_MAX}
            rows={6}
            placeholder="Puntualidad, bolas, material, qué pasa si no se presenta una pareja…"
            error={issues.rules}
          />
        </Section>

        <Section title="Categorías nuevas" description="Cada categoría que añadas al crear un torneo empieza con este precio y estas plazas.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Precio por pareja (€)" error={issues.categoryPrice}>
              <Input
                type="number"
                aria-label="Precio por pareja (€)"
                min={0}
                step={1}
                value={intField(form.categoryPrice)}
                onChange={(e) => set({ categoryPrice: toInt(e.target.value) })}
              />
            </Field>
            <Field label="Plazas" error={issues.categorySpots}>
              <Input
                type="number"
                aria-label="Plazas"
                min={4}
                max={128}
                value={intField(form.categorySpots)}
                onChange={(e) => set({ categorySpots: toInt(e.target.value) })}
              />
            </Field>
          </div>
        </Section>

        <Section title="Formato">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Formato">
              <CustomSelect
                options={WIZARD_FORMAT_OPTIONS}
                value={form.format}
                onChange={(format) => set({ format })}
              />
            </Field>
            <Field label="Duración por partido" error={issues.matchDuration}>
              <CustomSelect
                options={matchDurationOptions(form.matchDuration)}
                value={String(form.matchDuration)}
                onChange={(v) => set({ matchDuration: Number(v) })}
              />
            </Field>
          </div>
          <CheckField
            label="Cabezas de serie (seeding por SPA)"
            help="Los equipos se distribuyen en grupos/cuadro según su ranking SPA. Sin activar, el sorteo es aleatorio."
            checked={form.useSeeding}
            onChange={(useSeeding) => set({ useSeeding })}
          />
          <CheckField
            label="Incluir camisetas"
            help="Los jugadores deberán indicar su talla al inscribirse"
            checked={form.hasShirts}
            onChange={(hasShirts) => set({ hasShirts })}
          />
          <CheckField
            label="Exigir el pago para confirmar"
            help="Ninguna pareja pasa a confirmada hasta que se marque pagado a cada uno de sus jugadores (el cobro se apunta a mano en Inscripciones)"
            checked={form.requirePaymentToConfirm}
            onChange={(requirePaymentToConfirm) => set({ requirePaymentToConfirm })}
          />
        </Section>

        <Section title="Lo que ven los jugadores">
          <TournamentVisibilityFields
            value={form}
            onChange={set}
            hideFromAppError={issues.hideFromAppAfterDays}
          />
        </Section>

        <Section title="Jornadas" description="Las jornadas del torneo se generan con este horario, de su primer a su último día.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Inicio de cada jornada" error={issues.dayStartTime}>
              <Input type="time" aria-label="Inicio de cada jornada" value={form.dayStartTime} onChange={(e) => set({ dayStartTime: e.target.value })} />
            </Field>
            <Field label="Fin de cada jornada" error={issues.dayEndTime}>
              <Input type="time" aria-label="Fin de cada jornada" value={form.dayEndTime} onChange={(e) => set({ dayEndTime: e.target.value })} />
            </Field>
            <Field label="Máx. franjas bloqueables en total" error={issues.maxUnavailableTotalHours}>
              <Input
                type="number"
                aria-label="Máx. franjas bloqueables en total"
                min={0}
                step={1}
                value={intField(form.maxUnavailableTotalHours)}
                onChange={(e) => set({ maxUnavailableTotalHours: toInt(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Las franjas que cada pareja puede marcar como no disponibles, sumando todas las jornadas (0 = sin límite · 1 franja = 30 min).
              </p>
            </Field>
          </div>
        </Section>
      </div>
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function CheckField({
  label, help, checked, onChange,
}: {
  label:    string;
  help:     string;
  checked:  boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-md border border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-[#D4AF37]"
      />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
    </label>
  );
}
