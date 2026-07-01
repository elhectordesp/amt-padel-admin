/**
 * /mi-club/reservas/precios — matriz de precios por pista.
 *
 * UX: selector de pista arriba + editor de filas (dayOfWeek × franja × duración × precio).
 * Replace transaccional al guardar.
 *
 * Simplificación: el usuario edita una tabla plana. Las filas se pueden
 * añadir/eliminar individualmente, y "Aplicar a todos los días" copia una
 * franja a los 7 días.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  CopyPlus,
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

const DAY_NAMES = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Row = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priceCents: number;
};

const EMPTY_ROW: Row = {
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "23:00",
  durationMinutes: 90,
  priceCents: 2000,
};

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
      <div className="p-6">
        <BackLink />
        <Header title="Precios" />
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </div>
    );
  }

  const courts = courtsQuery.data ?? [];

  return (
    <div className="p-6">
      <BackLink />
      <Header title="Precios" />
      <p className="mt-2 text-sm text-muted-foreground">
        Matriz de precios por (día × franja horaria × duración) para cada pista.
        Sin un precio definido, ese slot NO se ofrecerá al jugador.
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
          <PricingTable clubId={clubId} courtId={selectedCourtId} />
        </div>
      )}
    </div>
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

function PricingTable({ clubId, courtId }: { clubId: string; courtId: string }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({
    queryKey: bookingsQK.courtPricing(clubId, courtId),
    queryFn: () => bookingsService.courtPricing.list(clubId, courtId),
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHydrated(false);
  }, [courtId]);

  useEffect(() => {
    if (query.data && !hydrated) {
      setRows(
        query.data
          .map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            durationMinutes: s.durationMinutes,
            priceCents: s.priceCents,
          }))
          .sort(
            (a, b) =>
              a.dayOfWeek - b.dayOfWeek ||
              a.startTime.localeCompare(b.startTime) ||
              a.durationMinutes - b.durationMinutes,
          ),
      );
      setHydrated(true);
    }
  }, [query.data, hydrated]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useMutation({
    mutationFn: () =>
      bookingsService.courtPricing.replace(clubId, courtId, { slots: rows }),
    onSuccess: () => {
      toast.success("Precios guardados");
      qc.invalidateQueries({ queryKey: bookingsQK.courtPricing(clubId, courtId) });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error";
      toast.error(msg);
    },
  });

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const duplicateToAllDays = (idx: number) => {
    const src = rows[idx];
    if (!src) return;
    const others = [1, 2, 3, 4, 5, 6, 7]
      .filter((d) => d !== src.dayOfWeek)
      .filter(
        (d) =>
          !rows.some(
            (r) =>
              r.dayOfWeek === d &&
              r.startTime === src.startTime &&
              r.endTime === src.endTime &&
              r.durationMinutes === src.durationMinutes,
          ),
      )
      .map((d) => ({ ...src, dayOfWeek: d }));
    if (others.length === 0) {
      toast.info("Ya existen filas idénticas para todos los días");
      return;
    }
    setRows((prev) => [...prev, ...others]);
    toast.success(`${others.length} filas añadidas a los demás días`);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Tabla de precios</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" /> Añadir fila
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Sin precios definidos. Añade filas con el botón de arriba.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Día</th>
                <th className="px-3 py-2 text-left font-medium">Desde</th>
                <th className="px-3 py-2 text-left font-medium">Hasta</th>
                <th className="px-3 py-2 text-left font-medium">Duración</th>
                <th className="px-3 py-2 text-left font-medium">Precio (€)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${i}-${r.dayOfWeek}`} className="border-t border-border">
                  <td className="px-3 py-2">
                    <select
                      value={r.dayOfWeek}
                      onChange={(e) =>
                        updateRow(i, { dayOfWeek: Number(e.target.value) })
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>
                          {DAY_NAMES[d]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={r.startTime}
                      onChange={(e) => updateRow(i, { startTime: e.target.value })}
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={r.endTime}
                      onChange={(e) => updateRow(i, { endTime: e.target.value })}
                      className="rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={30}
                      max={240}
                      value={r.durationMinutes}
                      onChange={(e) =>
                        updateRow(i, { durationMinutes: Number(e.target.value) })
                      }
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      value={(r.priceCents / 100).toFixed(2)}
                      onChange={(e) =>
                        updateRow(i, {
                          priceCents: Math.round(parseFloat(e.target.value || "0") * 100),
                        })
                      }
                      className="w-24 rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => duplicateToAllDays(i)}
                      title="Aplicar a todos los días"
                    >
                      <CopyPlus className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRow(i)}
                      title="Eliminar"
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
