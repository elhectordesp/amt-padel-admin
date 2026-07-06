/**
 * /mi-club/reservas/extras — CRUD de extras del club (luz, palas, etc.).
 *
 * Soft delete (active=false). Edit inline en cards.
 */

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import type { BookingExtra } from "@/types/bookings";

type ExtraForm = {
  name: string;
  description: string;
  priceEur: string;
  mandatory: boolean;
  autoApplyAfterSunset: boolean;
  displayOrder: number;
};

const EMPTY_FORM: ExtraForm = {
  name: "",
  description: "",
  priceEur: "3",
  mandatory: false,
  autoApplyAfterSunset: false,
  displayOrder: 0,
};

export default function ExtrasPage() {
  const { role, clubId } = useRole();

  const query = useQuery({
    queryKey: bookingsQK.extras(clubId ?? "", false),
    queryFn: () => bookingsService.extras.list(clubId!, false),
    enabled: !!clubId && isClub(role),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ExtraForm>(EMPTY_FORM);
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      bookingsService.extras.create(clubId!, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceCents: Math.round(parseFloat(form.priceEur || "0") * 100),
        mandatory: form.mandatory,
        autoApplyAfterSunset: form.autoApplyAfterSunset,
        displayOrder: form.displayOrder,
      }),
    onSuccess: () => {
      toast.success("Extra creado");
      setForm(EMPTY_FORM);
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["bookings", "extras", clubId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error";
      toast.error(msg);
    },
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
        <Header title="Extras" />
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </div>
    );
  }

  const extras = query.data ?? [];

  return (
    <div className="p-6">
      <BackLink />
      <Header title="Extras" />
      <p className="mt-2 text-sm text-muted-foreground">
        Extras que el club ofrece con cada reserva (luz, alquiler de palas,
        climatización). Pueden ser opcionales, obligatorios, o auto-aplicarse
        si la pista es outdoor y el slot es post-sunset.
      </p>

      <div className="mt-6 flex justify-between">
        <h3 className="text-sm font-medium">
          {extras.length} extra{extras.length === 1 ? "" : "s"} configurado
          {extras.length === 1 ? "" : "s"}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm((s) => !s)}
        >
          <Plus className="h-3.5 w-3.5" /> Nuevo extra
        </Button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Luz, Palas, Climatización…"
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
            <Field label="Precio (€)">
              <input
                type="number"
                step="0.5"
                min={0}
                value={form.priceEur}
                onChange={(e) => setForm({ ...form, priceEur: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </Field>
          </div>
          <Field label="Descripción (opcional)">
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Iluminación de la pista"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </Field>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.mandatory}
                onChange={(e) =>
                  setForm({ ...form, mandatory: e.target.checked })
                }
                className="h-4 w-4 accent-primary"
              />
              Obligatorio
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.autoApplyAfterSunset}
                onChange={(e) =>
                  setForm({ ...form, autoApplyAfterSunset: e.target.checked })
                }
                className="h-4 w-4 accent-primary"
              />
              Auto-aplicar tras sunset (solo pistas outdoor)
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()} size="sm">
              {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {query.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : extras.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-6 w-6 opacity-50" />
            Sin extras todavía. Añade el primero con el botón de arriba.
          </div>
        ) : (
          extras.map((e) => (
            <ExtraCard key={e.id} extra={e} clubId={clubId} />
          ))
        )}
      </div>
    </div>
  );
}

function ExtraCard({ extra, clubId }: { extra: BookingExtra; clubId: string }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    name: extra.name,
    description: extra.description ?? "",
    priceEur: (extra.priceCents / 100).toString(),
    mandatory: extra.mandatory,
    autoApplyAfterSunset: extra.autoApplyAfterSunset,
    active: extra.active,
  });

  const update = useMutation({
    mutationFn: () =>
      bookingsService.extras.update(clubId, extra.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceCents: Math.round(parseFloat(form.priceEur || "0") * 100),
        mandatory: form.mandatory,
        autoApplyAfterSunset: form.autoApplyAfterSunset,
        active: form.active,
      }),
    onSuccess: () => {
      toast.success("Extra actualizado");
      setEdit(false);
      qc.invalidateQueries({ queryKey: ["bookings", "extras", clubId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error";
      toast.error(msg);
    },
  });

  const deactivate = useMutation({
    mutationFn: () => bookingsService.extras.deactivate(clubId, extra.id),
    onSuccess: () => {
      toast.success("Extra desactivado");
      qc.invalidateQueries({ queryKey: ["bookings", "extras", clubId] });
    },
  });

  if (!edit) {
    return (
      <div
        className={`rounded-lg border border-border bg-card p-4 ${
          !extra.active ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{extra.name}</span>
              {extra.mandatory && (
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                  Obligatorio
                </span>
              )}
              {extra.autoApplyAfterSunset && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-500">
                  Auto-sunset
                </span>
              )}
              {!extra.active && (
                <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-xs text-destructive">
                  Inactivo
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {(extra.priceCents / 100).toFixed(2)} €
              {extra.description && ` · ${extra.description}`}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEdit(true)}>
              Editar
            </Button>
            {extra.active && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => deactivate.mutate()}
                title="Desactivar"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary bg-card p-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Precio (€)">
          <input
            type="number"
            step="0.5"
            min={0}
            value={form.priceEur}
            onChange={(e) => setForm({ ...form, priceEur: e.target.value })}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>
      <Field label="Descripción">
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.mandatory}
            onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          Obligatorio
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.autoApplyAfterSunset}
            onChange={(e) =>
              setForm({ ...form, autoApplyAfterSunset: e.target.checked })
            }
            className="h-4 w-4 accent-primary"
          />
          Auto-sunset
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          Activo
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => setEdit(false)}>
          Cancelar
        </Button>
        <Button onClick={() => update.mutate()} disabled={update.isPending} size="sm">
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar
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
