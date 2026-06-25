/**
 * /mi-club/reservas/pistas — atributos de booking por pista + duraciones permitidas.
 *
 * NO duplica el CRUD de Court (eso está en /mi-club). Solo expone:
 *  - Atributos booking-specific: type, wallType, allowOpenMatches
 *  - Duraciones permitidas por pista (replace transaccional)
 *
 * Si el club no tiene pistas, redirige a /mi-club para crearlas primero.
 */

"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import type { Court } from "@/types";
import type { CourtAvailableDuration } from "@/types/bookings";

const COMMON_DURATIONS = [60, 75, 90, 120];

export default function PistasPage() {
  const { role, clubId } = useRole();

  const courtsQuery = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId!),
    enabled: !!clubId && isClub(role),
  });

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
        <Header title="Pistas + Duraciones" />
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BackLink />
      <Header title="Pistas + Duraciones" />
      <p className="mt-2 text-sm text-muted-foreground">
        Configura los atributos específicos de cada pista para reservas
        (tipo, tipo de pared, partidos abiertos) y las duraciones permitidas.
        El alta/baja de pistas se hace desde{" "}
        <Link href="/mi-club" className="underline">
          Mi club
        </Link>
        .
      </p>

      <div className="mt-8 space-y-4">
        {courtsQuery.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (courtsQuery.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Este club aún no tiene pistas.{" "}
            <Link href="/mi-club" className="text-primary underline">
              Crea pistas primero
            </Link>
            .
          </div>
        ) : (
          (courtsQuery.data ?? []).map((court) => (
            <CourtCard key={court.id} court={court} clubId={clubId} />
          ))
        )}
      </div>
    </div>
  );
}

function CourtCard({ court, clubId }: { court: Court; clubId: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    type: (court.type ?? "DOUBLES") as "SINGLES" | "DOUBLES",
    wallType: (court.wallType ?? null) as "GLASS" | "WALL" | null,
    allowOpenMatches: court.allowOpenMatches ?? true,
  });

  const saveAttrs = useMutation({
    mutationFn: () =>
      adminService.courts.update(clubId, court.id, {
        type: form.type,
        wallType: form.wallType,
        allowOpenMatches: form.allowOpenMatches,
      }),
    onSuccess: () => {
      toast.success("Atributos guardados");
      qc.invalidateQueries({ queryKey: ["admin-courts", clubId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{court.name}</span>
            {court.isCentral && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                Central
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {court.isIndoor ? "Indoor" : "Outdoor"}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((s) => !s)}
          aria-label={expanded ? "Colapsar" : "Expandir"}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-6">
          {/* Atributos booking-specific */}
          <section>
            <h3 className="mb-3 text-sm font-medium">Atributos de reserva</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Tipo">
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as "SINGLES" | "DOUBLES" })
                  }
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="DOUBLES">Dobles (4 jugadores)</option>
                  <option value="SINGLES">Singles (2 jugadores)</option>
                </select>
              </Field>
              <Field label="Pared">
                <select
                  value={form.wallType ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      wallType: (e.target.value || null) as "GLASS" | "WALL" | null,
                    })
                  }
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">Sin especificar</option>
                  <option value="GLASS">Cristal</option>
                  <option value="WALL">Pared sólida</option>
                </select>
              </Field>
              <Field label="Partidos abiertos">
                <label className="flex h-[34px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.allowOpenMatches}
                    onChange={(e) =>
                      setForm({ ...form, allowOpenMatches: e.target.checked })
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  Permitir
                </label>
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={() => saveAttrs.mutate()}
                disabled={saveAttrs.isPending}
              >
                {saveAttrs.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Guardar atributos
              </Button>
            </div>
          </section>

          {/* Duraciones */}
          <section>
            <DurationsEditor clubId={clubId} courtId={court.id} />
          </section>
        </div>
      )}
    </div>
  );
}

function DurationsEditor({ clubId, courtId }: { clubId: string; courtId: string }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<{ minutes: number; isDefault: boolean }[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({
    queryKey: bookingsQK.courtDurations(clubId, courtId),
    queryFn: () => bookingsService.courtDurations.list(clubId, courtId),
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!query.data || hydrated) return;
    if (query.data.length === 0) {
      // Sin duraciones todavía → sugerimos 60 y 90 por defecto
      setRows([
        { minutes: 60, isDefault: false },
        { minutes: 90, isDefault: true },
      ]);
    } else {
      setRows(
        query.data
          .sort((a: CourtAvailableDuration, b: CourtAvailableDuration) => a.minutes - b.minutes)
          .map((d) => ({ minutes: d.minutes, isDefault: d.isDefault })),
      );
    }
    setHydrated(true);
  }, [query.data, hydrated]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useMutation({
    mutationFn: () =>
      bookingsService.courtDurations.replace(clubId, courtId, { durations: rows }),
    onSuccess: () => {
      toast.success("Duraciones guardadas");
      qc.invalidateQueries({ queryKey: bookingsQK.courtDurations(clubId, courtId) });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error";
      toast.error(msg);
    },
  });

  const toggleDuration = (mins: number) => {
    setRows((prev) => {
      const exists = prev.find((r) => r.minutes === mins);
      if (exists) return prev.filter((r) => r.minutes !== mins);
      return [...prev, { minutes: mins, isDefault: false }].sort(
        (a, b) => a.minutes - b.minutes,
      );
    });
  };

  const setDefault = (mins: number) => {
    setRows((prev) =>
      prev.map((r) => ({ ...r, isDefault: r.minutes === mins })),
    );
  };

  const removeDuration = (mins: number) => {
    setRows((prev) => prev.filter((r) => r.minutes !== mins));
  };

  const [customDuration, setCustomDuration] = useState("");

  const addCustom = () => {
    const n = parseInt(customDuration, 10);
    if (!n || n < 30 || n > 240) {
      toast.error("Duración debe estar entre 30 y 240 minutos");
      return;
    }
    if (rows.some((r) => r.minutes === n)) {
      toast.info("Ya está en la lista");
      return;
    }
    setRows((prev) =>
      [...prev, { minutes: n, isDefault: false }].sort((a, b) => a.minutes - b.minutes),
    );
    setCustomDuration("");
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">
        <Clock className="mr-1 inline-block h-3.5 w-3.5" />
        Duraciones permitidas
      </h3>

      {/* Toggles de duraciones comunes */}
      <div className="mb-4 flex flex-wrap gap-2">
        {COMMON_DURATIONS.map((mins) => {
          const active = rows.some((r) => r.minutes === mins);
          return (
            <button
              key={mins}
              type="button"
              onClick={() => toggleDuration(mins)}
              className={`rounded-full border px-3 py-1 text-xs ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {mins} min
            </button>
          );
        })}
      </div>

      {/* Tabla de duraciones seleccionadas */}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Duración</th>
                <th className="px-3 py-2 text-left font-medium">Default</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.minutes} className="border-t border-border">
                  <td className="px-3 py-2">{r.minutes} min</td>
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      name={`default-${courtId}`}
                      checked={r.isDefault}
                      onChange={() => setDefault(r.minutes)}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeDuration(r.minutes)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Custom duration input */}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={30}
          max={240}
          placeholder="Custom (ej. 75)"
          value={customDuration}
          onChange={(e) => setCustomDuration(e.target.value)}
          className="w-32 rounded border border-border bg-background px-2 py-1 text-sm"
        />
        <Button variant="outline" size="sm" onClick={addCustom}>
          <Plus className="h-3.5 w-3.5" /> Añadir
        </Button>
        <span className="ml-auto" />
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar duraciones
        </Button>
      </div>
    </div>
  );
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
