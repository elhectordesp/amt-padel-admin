/**
 * /mi-club/reservas/precios — precios por pista en una cuadrícula.
 *
 * Filas = franjas (nombre, desde, hasta, días); columnas = las duraciones de
 * la pista; celdas = precio de TODA la pista en esa franja y duración. Al
 * guardar se expande a CourtPriceSlot (uno por día × duración) y "Aplicar a
 * todas las pistas" sustituye los precios de todas con la misma cuadrícula.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Copy, Loader2, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { ReservasPage } from "@/components/admin/reservas-page";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import {
  ALL_DAYS,
  DAY_SHORT,
  WEEKDAYS,
  WEEKEND,
  daysLabel,
  durationsMissingIn,
  findGaps,
  newRowId,
  perPlayerText,
  rowsToSlots,
  slotsToRows,
  type GridRow,
} from "@/lib/utils/price-grid";
import type { Court } from "@/types";
import type { ClubOperatingHours, CourtPriceSlot } from "@/types/bookings";

export default function PreciosPage() {
  const { role, clubId } = useRole();

  const courtsQuery = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId!),
    enabled: !!clubId && isClub(role),
  });

  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCourtId && courtsQuery.data && courtsQuery.data.length > 0) {
      setSelectedCourtId(courtsQuery.data[0].id);
    }
  }, [courtsQuery.data, selectedCourtId]);

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isClub(role) || !clubId) {
    return (
      <ReservasPage title="Precios">
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </ReservasPage>
    );
  }

  const courts = courtsQuery.data ?? [];

  return (
    <ReservasPage title="Precios">
      <p className="mt-2 text-sm text-muted-foreground">
        El precio es POR PISTA (toda la reserva, no por jugador). Si una combinación de día, franja y duración no tiene precio, no se ofrecerá al jugador.
      </p>

      <div className="mt-6">
        <CourtSelector
          courts={courts}
          loading={courtsQuery.isLoading}
          selectedId={selectedCourtId}
          onChange={setSelectedCourtId}
        />
      </div>

      {selectedCourtId && (
        <div className="mt-6">
          <PricingGrid
            key={selectedCourtId}
            clubId={clubId}
            courtId={selectedCourtId}
            allCourts={courts}
          />
        </div>
      )}
    </ReservasPage>
  );
}

function CourtSelector({
  courts,
  loading,
  selectedId,
  onChange,
}: {
  courts: Court[];
  loading: boolean;
  selectedId: string | null;
  onChange: (id: string) => void;
}) {
  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }
  if (courts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin pistas. Crea pistas en{" "}
        <Link href="/mi-club" className="text-primary underline">
          Mi club
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {courts.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            c.id === selectedId
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function errorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    "Error"
  );
}

function PricingGrid({
  clubId,
  courtId,
  allCourts,
}: {
  clubId: string;
  courtId: string;
  allCourts: Court[];
}) {
  const pricing = useQuery({
    queryKey: bookingsQK.courtPricing(clubId, courtId),
    queryFn: () => bookingsService.courtPricing.list(clubId, courtId),
  });
  const durations = useQuery({
    queryKey: bookingsQK.courtDurations(clubId, courtId),
    queryFn: () => bookingsService.courtDurations.list(clubId, courtId),
  });
  const hours = useQuery({
    queryKey: bookingsQK.operatingHours(clubId),
    queryFn: () => bookingsService.operatingHours.list(clubId),
  });

  if (pricing.isLoading || durations.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }
  if (!pricing.data || !durations.data) {
    return (
      <p className="text-sm text-destructive">
        No se han podido cargar los precios de la pista.
      </p>
    );
  }
  return (
    <GridEditor
      clubId={clubId}
      court={allCourts.find((c) => c.id === courtId)}
      courtId={courtId}
      allCourts={allCourts}
      initialSlots={pricing.data}
      offered={durations.data.map((d) => d.minutes)}
      hours={hours.data}
    />
  );
}

function GridEditor({
  clubId,
  court,
  courtId,
  allCourts,
  initialSlots,
  offered,
  hours,
}: {
  clubId: string;
  court: Court | undefined;
  courtId: string;
  allCourts: Court[];
  initialSlots: CourtPriceSlot[];
  offered: number[];
  hours: ClubOperatingHours[] | undefined;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<GridRow[]>(() => slotsToRows(initialSlots));

  // Columnas: las duraciones de la pista y, para no perder nada, las que ya
  // tuvieran precio aunque la pista ya no las ofrezca (se marcan en rojo)
  const columns = useMemo(() => {
    const fromSlots = initialSlots.map((s) => s.durationMinutes);
    const fromRows = rows.flatMap((r) => Object.keys(r.prices).map(Number));
    return [...new Set([...offered, ...fromSlots, ...fromRows])].sort((a, b) => a - b);
  }, [offered, initialSlots, rows]);

  const { slots, errors } = useMemo(() => rowsToSlots(rows), [rows]);
  const notOffered = useMemo(() => durationsMissingIn(slots, offered), [slots, offered]);
  const gaps = useMemo(() => findGaps(slots, offered, hours), [slots, offered, hours]);

  const save = useMutation({
    mutationFn: () => bookingsService.courtPricing.replace(clubId, courtId, { slots }),
    onSuccess: () => {
      toast.success("Precios guardados");
      qc.invalidateQueries({ queryKey: bookingsQK.courtPricing(clubId, courtId) });
    },
    onError: (err: unknown) => toast.error(errorMessage(err)),
  });

  const applyAll = useMutation({
    mutationFn: () =>
      bookingsService.courtPricing.replaceMany(clubId, {
        courtIds: allCourts.map((c) => c.id),
        slots,
      }),
    onSuccess: () => {
      toast.success(`Precios aplicados a ${allCourts.length} pistas`);
      qc.invalidateQueries({ queryKey: ["bookings", "courtPricing", clubId] });
    },
    // El back dice qué pista no ofrece qué duración y no aplica nada
    onError: (err: unknown) =>
      toast.error(`No se ha aplicado a ninguna pista. ${errorMessage(err)}`, {
        duration: 10000,
      }),
  });

  const hasErrors = () => {
    if (errors.length > 0) {
      toast.error(errors[0]);
      return true;
    }
    return false;
  };

  const onSave = () => {
    if (!hasErrors()) save.mutate();
  };

  const onApplyAll = () => {
    if (hasErrors()) return;
    if (
      window.confirm(
        `Sustituye los precios de ${allCourts.length} pistas por los de esta cuadrícula.\n\n¿Continuar?`,
      )
    ) {
      applyAll.mutate();
    }
  };

  const updateRow = (id: string, patch: Partial<GridRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const toggleDay = (row: GridRow, day: number) =>
    updateRow(row.id, {
      days: row.days.includes(day)
        ? row.days.filter((d) => d !== day)
        : [...row.days, day].sort((a, b) => a - b),
    });

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        id: newRowId(),
        label: "",
        startTime: "09:00",
        endTime: "23:00",
        days: [...ALL_DAYS],
        prices: {},
      },
    ]);

  const inputCls = "rounded border border-border bg-background px-2 py-1 text-sm";
  const presets = [
    ["L-V", "Laborables", WEEKDAYS],
    ["S-D", "Fin de semana", WEEKEND],
    ["Todos", "Todos", ALL_DAYS],
  ] as const;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          Precios de {court?.name ?? "la pista"} (por pista, toda la reserva)
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" /> Añadir franja
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onApplyAll}
            disabled={applyAll.isPending || allCourts.length < 2}
          >
            {applyAll.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Aplicar a todas las pistas
          </Button>
          <Button size="sm" onClick={onSave} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Sin precios definidos. Añade una franja (p. ej. «Valle» y «Punta») con el botón de arriba.
        </div>
      ) : (
        // En el móvil la tabla no cabe: se desplaza de lado en vez de cortarse
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Franja</th>
                <th className="px-3 py-2 text-left font-medium">Días</th>
                {columns.map((m) => (
                  <th key={m} className="px-3 py-2 text-left font-medium">
                    {m} min
                    {!offered.includes(m) && (
                      <span
                        className="ml-1 normal-case text-destructive"
                        title="La pista no ofrece esta duración"
                      >
                        (no ofrecida)
                      </span>
                    )}
                  </th>
                ))}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      maxLength={40}
                      placeholder="Nombre (Valle, Punta…)"
                      value={r.label}
                      onChange={(e) => updateRow(r.id, { label: e.target.value })}
                      aria-label={`Nombre de la franja ${i + 1}`}
                      className={`${inputCls} w-40`}
                    />
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="time"
                        value={r.startTime}
                        onChange={(e) => updateRow(r.id, { startTime: e.target.value })}
                        aria-label={`Desde (franja ${i + 1})`}
                        className={inputCls}
                      />
                      <span className="text-muted-foreground">-</span>
                      <input
                        type="time"
                        value={r.endTime}
                        onChange={(e) => updateRow(r.id, { endTime: e.target.value })}
                        aria-label={`Hasta (franja ${i + 1})`}
                        className={inputCls}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="mb-1 flex gap-1 text-xs">
                      {presets.map(([short, name, days]) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => updateRow(r.id, { days: [...days] })}
                          className={`rounded border px-1.5 py-0.5 ${
                            daysLabel(r.days) === name
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {short}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-0.5">
                      {ALL_DAYS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(r, d)}
                          aria-pressed={r.days.includes(d)}
                          title={DAY_SHORT[d]}
                          className={`h-6 w-7 rounded border text-xs ${
                            r.days.includes(d)
                              ? "border-primary bg-primary/10 font-medium text-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {DAY_SHORT[d].slice(0, 2)}
                        </button>
                      ))}
                    </div>
                  </td>
                  {columns.map((m) => {
                    const text = r.prices[m] ?? "";
                    const hint = perPlayerText(text, court?.type);
                    return (
                      <td key={m} className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={text}
                            placeholder="—"
                            onChange={(e) =>
                              updateRow(r.id, { prices: { ...r.prices, [m]: e.target.value } })
                            }
                            aria-label={`Precio ${m} min, franja ${i + 1} (€)`}
                            className={`${inputCls} w-20`}
                          />
                          <span className="text-muted-foreground">€</span>
                        </div>
                        {hint && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      title="Eliminar franja"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(notOffered.length > 0 || gaps.length > 0) && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert className="h-4 w-4" /> Huecos sin precio (no se podrá reservar ahí)
          </p>
          <ul className="mt-1 list-disc pl-5">
            {notOffered.length > 0 && (
              <li>
                La pista no ofrece {notOffered.map((m) => `${m} min`).join(", ")}: añade esa
                duración a la pista o quita su precio.
              </li>
            )}
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
