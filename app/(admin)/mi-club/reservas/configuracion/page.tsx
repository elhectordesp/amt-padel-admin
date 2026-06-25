/**
 * /mi-club/reservas/configuracion — config global del módulo reservas.
 *
 * Cancelación, antelación, open matches, resultados, social, notificaciones.
 * Patch parcial al guardar.
 */

"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import type { ClubBookingConfig } from "@/types/bookings";

type FormState = Pick<
  ClubBookingConfig,
  | "cancellationWindowHours"
  | "minBookingAheadMinutes"
  | "maxBookingAheadDays"
  | "openMatchEnabled"
  | "openMatchMinPlayers"
  | "openMatchAdminWarnHoursBefore"
  | "openMatchAutoCancelHoursBefore"
  | "resultEntryWindowDays"
  | "resultMaxExtensions"
  | "autoAcceptThreshold"
  | "allowGuestPlayers"
  | "welcomeMessageMarkdown"
  | "notifyAdminViaPush"
  | "notifyAdminViaEmail"
>;

export default function ConfiguracionPage() {
  const { role, clubId } = useRole();

  const query = useQuery({
    queryKey: bookingsQK.config(clubId ?? ""),
    queryFn: () => bookingsService.config.get(clubId!),
    enabled: !!clubId && isClub(role),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (query.data && !hydrated) {
      const {
        cancellationWindowHours,
        minBookingAheadMinutes,
        maxBookingAheadDays,
        openMatchEnabled,
        openMatchMinPlayers,
        openMatchAdminWarnHoursBefore,
        openMatchAutoCancelHoursBefore,
        resultEntryWindowDays,
        resultMaxExtensions,
        autoAcceptThreshold,
        allowGuestPlayers,
        welcomeMessageMarkdown,
        notifyAdminViaPush,
        notifyAdminViaEmail,
      } = query.data;
      setForm({
        cancellationWindowHours,
        minBookingAheadMinutes,
        maxBookingAheadDays,
        openMatchEnabled,
        openMatchMinPlayers,
        openMatchAdminWarnHoursBefore,
        openMatchAutoCancelHoursBefore,
        resultEntryWindowDays,
        resultMaxExtensions,
        autoAcceptThreshold,
        allowGuestPlayers,
        welcomeMessageMarkdown,
        notifyAdminViaPush,
        notifyAdminViaEmail,
      });
      setHydrated(true);
    }
  }, [query.data, hydrated]);

  const save = useMutation({
    mutationFn: () => bookingsService.config.update(clubId!, form!),
    onSuccess: () => {
      toast.success("Configuración guardada");
      qc.invalidateQueries({ queryKey: bookingsQK.config(clubId!) });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error";
      toast.error(msg);
    },
  });

  if (role === null || (isClub(role) && !form)) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isClub(role) || !clubId) {
    return (
      <div className="p-6">
        <BackLink />
        <Header title="Configuración" />
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </div>
    );
  }

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: val } : prev));

  return (
    <div className="p-6">
      <BackLink />
      <div className="flex items-center justify-between">
        <Header title="Configuración" />
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm">
          {save.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar
        </Button>
      </div>

      <div className="mt-6 space-y-8">
        {/* Cancelación + antelación */}
        <Section title="Cancelación y antelación">
          <NumberField
            label="Horas para cancelar sin coste"
            value={form!.cancellationWindowHours}
            onChange={(v) => set("cancellationWindowHours", v)}
            min={1} max={48}
            help="Si el jugador cancela con menos antelación, el club cobra la pista (offline)."
          />
          <NumberField
            label="Antelación mínima para reservar (minutos)"
            value={form!.minBookingAheadMinutes}
            onChange={(v) => set("minBookingAheadMinutes", v)}
            min={0} max={240}
            help="Buffer para que el club tenga tiempo de prepararse."
          />
          <NumberField
            label="Antelación máxima para reservar (días)"
            value={form!.maxBookingAheadDays}
            onChange={(v) => set("maxBookingAheadDays", v)}
            min={1} max={60}
          />
        </Section>

        {/* Open matches */}
        <Section title="Partidos abiertos">
          <BoolField
            label="Permitir partidos abiertos en el club"
            value={form!.openMatchEnabled}
            onChange={(v) => set("openMatchEnabled", v)}
            help="Si desactivas, los partidos abiertos no se podrán crear ni unirse en ningún slot de tu club."
          />
          <NumberField
            label="Mínimo de jugadores para que el partido salga adelante"
            value={form!.openMatchMinPlayers}
            onChange={(v) => set("openMatchMinPlayers", v)}
            min={2} max={4}
          />
          <NumberField
            label="Horas antes para avisar al admin si no se llena"
            value={form!.openMatchAdminWarnHoursBefore}
            onChange={(v) => set("openMatchAdminWarnHoursBefore", v)}
            min={1} max={72}
          />
          <NumberField
            label="Horas antes para auto-cancelar si no se llena"
            value={form!.openMatchAutoCancelHoursBefore}
            onChange={(v) => set("openMatchAutoCancelHoursBefore", v)}
            min={0} max={48}
          />
        </Section>

        {/* Resultados */}
        <Section title="Resultados">
          <NumberField
            label="Días para introducir el resultado"
            value={form!.resultEntryWindowDays}
            onChange={(v) => set("resultEntryWindowDays", v)}
            min={1} max={7}
          />
          <NumberField
            label="Máximo de extensiones permitidas"
            value={form!.resultMaxExtensions}
            onChange={(v) => set("resultMaxExtensions", v)}
            min={0} max={5}
            help="Si alguien cambia el resultado cerca del deadline, se extiende +1 día (hasta este máximo)."
          />
        </Section>

        {/* Social */}
        <Section title="Social">
          <NumberField
            label="Partidos juntos para auto-aceptar invitaciones"
            value={form!.autoAcceptThreshold}
            onChange={(v) => set("autoAcceptThreshold", v)}
            min={0} max={20}
            help="Si dos jugadores ya han jugado N veces juntos, las invitaciones futuras se auto-aceptan."
          />
          <BoolField
            label="Permitir invitados sin cuenta AMT"
            value={form!.allowGuestPlayers}
            onChange={(v) => set("allowGuestPlayers", v)}
            help="Útil cuando vienen amigos de fuera. Los invitados no cuentan para stats LSPA."
          />
        </Section>

        {/* Mensaje de bienvenida */}
        <Section title="Mensaje de bienvenida (opcional)">
          <textarea
            value={form!.welcomeMessageMarkdown ?? ""}
            onChange={(e) => set("welcomeMessageMarkdown", e.target.value)}
            rows={4}
            placeholder="Mensaje que verá el jugador la primera vez que reserve en tu club."
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </Section>

        {/* Notificaciones admin */}
        <Section title="Notificaciones admin">
          <BoolField
            label="Recibir push de eventos del módulo"
            value={form!.notifyAdminViaPush}
            onChange={(v) => set("notifyAdminViaPush", v)}
          />
          <BoolField
            label="Recibir email de eventos del módulo"
            value={form!.notifyAdminViaEmail}
            onChange={(v) => set("notifyAdminViaEmail", v)}
          />
        </Section>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-medium">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function NumberField({
  label, value, onChange, min, max, help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  help?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
      <div>
        <label className="text-sm">{label}</label>
        {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      </div>
      <input
        type="number"
        value={value}
        min={min} max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded border border-border bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function BoolField({
  label, value, onChange, help,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <div>
        <label className="text-sm">{label}</label>
        {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/mi-club/reservas"
      className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3" /> Volver a Reservas
    </Link>
  );
}
