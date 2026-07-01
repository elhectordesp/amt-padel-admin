/**
 * /mi-club/reservas/horarios — editor de horarios + excepciones.
 *
 * Sección 1: horario semanal (lunes-domingo) con horas open/close por día.
 * Sección 2: excepciones por fecha (festivos, cierres, horarios reducidos).
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarOff,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import type {
  ClubOperatingHours,
  ClubScheduleException,
  OperatingHourInput,
} from "@/types/bookings";

const DAY_NAMES = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type DayRow = {
  dayOfWeek: number;
  active: boolean;
  openTime: string;
  closeTime: string;
};

const DEFAULT_DAY_ROWS: DayRow[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
  dayOfWeek: d,
  active: false,
  openTime: "09:00",
  closeTime: "23:00",
}));

export default function HorariosPage() {
  const { role, clubId } = useRole();

  if (role === null) {
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
        <Header title="Horarios" />
        <p className="mt-6 text-sm text-muted-foreground">
          Esta página requiere un usuario con rol CLUB y club asignado.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BackLink />
      <Header title="Horarios" />
      <p className="mt-2 text-sm text-muted-foreground">
        Define el horario de apertura semanal del club. Las excepciones por
        fecha (festivos, cierres puntuales) sobreescriben el horario regular.
      </p>

      <div className="mt-8 space-y-10">
        <WeeklyHoursSection clubId={clubId} />
        <ExceptionsSection clubId={clubId} />
      </div>
    </div>
  );
}

// ── Horario semanal ─────────────────────────────────────────────────────────

function WeeklyHoursSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<DayRow[]>(DEFAULT_DAY_ROWS);
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({
    queryKey: bookingsQK.operatingHours(clubId),
    queryFn: () => bookingsService.operatingHours.list(clubId),
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!query.data || hydrated) return;
    const map = new Map<number, ClubOperatingHours>(
      query.data.map((h) => [h.dayOfWeek, h]),
    );
    setRows(
      DEFAULT_DAY_ROWS.map((d) => {
        const found = map.get(d.dayOfWeek);
        return found
          ? {
              dayOfWeek: d.dayOfWeek,
              active: found.active,
              openTime: found.openTime,
              closeTime: found.closeTime,
            }
          : { ...d };
      }),
    );
    setHydrated(true);
  }, [query.data, hydrated]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useMutation({
    mutationFn: (hours: OperatingHourInput[]) =>
      bookingsService.operatingHours.replace(clubId, { hours }),
    onSuccess: () => {
      toast.success("Horarios guardados");
      qc.invalidateQueries({ queryKey: bookingsQK.operatingHours(clubId) });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error guardando horarios";
      toast.error(msg);
    },
  });

  const updateRow = (idx: number, patch: Partial<DayRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleSave = () => {
    const activeRows = rows.filter((r) => r.active);
    // Validación cliente: open < close
    for (const r of activeRows) {
      if (r.openTime >= r.closeTime) {
        toast.error(`${DAY_NAMES[r.dayOfWeek]}: la apertura debe ser anterior al cierre`);
        return;
      }
    }
    save.mutate(
      activeRows.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        openTime: r.openTime,
        closeTime: r.closeTime,
        active: true,
      })),
    );
  };

  const applyToAll = () => {
    // Copia la config del primer día activo a todos los demás (UX típica)
    const source = rows.find((r) => r.active);
    if (!source) {
      toast.info("Activa al menos un día primero");
      return;
    }
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        active: true,
        openTime: source.openTime,
        closeTime: source.closeTime,
      })),
    );
  };

  if (query.isLoading) {
    return (
      <section>
        <SectionTitle>Horario semanal</SectionTitle>
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Horario semanal</SectionTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={applyToAll}>
            Aplicar a todos
          </Button>
          <Button onClick={handleSave} disabled={save.isPending} size="sm">
            {save.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Guardar
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Día</th>
              <th className="px-4 py-2.5 text-left font-medium">Abierto</th>
              <th className="px-4 py-2.5 text-left font-medium">Apertura</th>
              <th className="px-4 py-2.5 text-left font-medium">Cierre</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.dayOfWeek} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{DAY_NAMES[r.dayOfWeek]}</td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-primary"
                      checked={r.active}
                      onChange={(e) => updateRow(i, { active: e.target.checked })}
                    />
                  </label>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    className="rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-40"
                    value={r.openTime}
                    onChange={(e) => updateRow(i, { openTime: e.target.value })}
                    disabled={!r.active}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    className="rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-40"
                    value={r.closeTime}
                    onChange={(e) => updateRow(i, { closeTime: e.target.value })}
                    disabled={!r.active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Excepciones por fecha ───────────────────────────────────────────────────

function ExceptionsSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const query = useQuery({
    queryKey: bookingsQK.exceptions(clubId, today),
    queryFn: () =>
      bookingsService.exceptions.list(clubId, { fromDate: today }),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: today,
    isClosed: false,
    customOpen: "10:00",
    customClose: "20:00",
    reason: "",
  });

  const create = useMutation({
    mutationFn: () =>
      bookingsService.exceptions.create(clubId, {
        date: form.date,
        isClosed: form.isClosed,
        customOpen: form.isClosed ? undefined : form.customOpen,
        customClose: form.isClosed ? undefined : form.customClose,
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      toast.success("Excepción añadida");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["bookings", "exceptions", clubId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error";
      toast.error(msg);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => bookingsService.exceptions.remove(clubId, id),
    onSuccess: () => {
      toast.success("Excepción eliminada");
      qc.invalidateQueries({ queryKey: ["bookings", "exceptions", clubId] });
    },
  });

  const upcoming = query.data ?? [];

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionTitle>Excepciones por fecha</SectionTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm((s) => !s)}
        >
          <Plus className="h-3.5 w-3.5" /> Añadir
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Festivos, cierres puntuales, horarios reducidos. Tienen prioridad
        sobre el horario semanal regular.
      </p>

      {showForm && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Motivo (opcional)">
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Festivo, mantenimiento…"
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isClosed}
              onChange={(e) => setForm({ ...form, isClosed: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            Club cerrado todo el día
          </label>
          {!form.isClosed && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Apertura">
                <input
                  type="time"
                  value={form.customOpen}
                  onChange={(e) => setForm({ ...form, customOpen: e.target.value })}
                  className="rounded border border-border bg-background px-2 py-1 text-sm"
                />
              </Field>
              <Field label="Cierre">
                <input
                  type="time"
                  value={form.customClose}
                  onChange={(e) => setForm({ ...form, customClose: e.target.value })}
                  className="rounded border border-border bg-background px-2 py-1 text-sm"
                />
              </Field>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending} size="sm">
              {create.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        {query.isLoading ? (
          <div className="p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <CalendarOff className="h-8 w-8 opacity-50" />
            No hay excepciones próximas. El horario semanal aplica todos los días.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                <th className="px-4 py-2.5 text-left font-medium">Motivo</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((exc) => (
                <ExceptionRow
                  key={exc.id}
                  exc={exc}
                  onRemove={() => remove.mutate(exc.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function ExceptionRow({
  exc,
  onRemove,
}: {
  exc: ClubScheduleException;
  onRemove: () => void;
}) {
  const dateStr = useMemo(
    () =>
      new Date(exc.date).toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [exc.date],
  );
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3">{dateStr}</td>
      <td className="px-4 py-3">
        {exc.isClosed ? (
          <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
            Cerrado
          </span>
        ) : exc.customOpen && exc.customClose ? (
          <span className="text-xs">
            {exc.customOpen} – {exc.customClose}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{exc.reason ?? "—"}</td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Eliminar excepción"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </td>
    </tr>
  );
}

// ── Helpers UI ──────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-medium">{children}</h2>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
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
