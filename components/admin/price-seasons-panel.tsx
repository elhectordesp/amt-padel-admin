"use client";

/**
 * Temporadas de precios del club (verano, invierno…): selector «Precios base /
 * <temporada>» para la cuadrícula y gestión (crear, editar, borrar). Una
 * temporada no puede solaparse con otra; al borrarla se borran sus precios.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { dateOnlyKey, formatDayKey } from "@/lib/utils/time-zone";
import type { ClubSeason } from "@/types/bookings";

export function errorText(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    "Error"
  );
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export function seasonRange(s: Pick<ClubSeason, "startDate" | "endDate">): string {
  return `${formatDayKey(dateOnlyKey(s.startDate), DATE_FMT)} – ${formatDayKey(dateOnlyKey(s.endDate), DATE_FMT)}`;
}

const inputCls = "rounded border border-border bg-background px-2 py-1 text-sm";

export function PriceSeasonsPanel({
  clubId,
  seasons,
  selectedId,
  onSelect,
}: {
  clubId: string;
  seasons: ClubSeason[];
  /** null = precios base. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  // "new" = alta; un id = edición de esa temporada; null = formulario cerrado
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [toDelete, setToDelete] = useState<ClubSeason | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: bookingsQK.seasons(clubId) });
    qc.invalidateQueries({ queryKey: ["bookings", "courtPricing", clubId] });
  };

  const save = useMutation({
    mutationFn: () =>
      editing === "new"
        ? bookingsService.seasons.create(clubId, form)
        : bookingsService.seasons.update(clubId, editing!, form),
    onSuccess: (season) => {
      toast.success(editing === "new" ? "Temporada creada" : "Temporada guardada");
      if (editing === "new") onSelect(season.id);
      setEditing(null);
      refresh();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => bookingsService.seasons.remove(clubId, id),
    onSuccess: (_data, id) => {
      toast.success("Temporada borrada");
      if (selectedId === id) onSelect(null);
      setToDelete(null);
      refresh();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const openNew = () => {
    setForm({ name: "", startDate: "", endDate: "" });
    setEditing("new");
  };
  const openEdit = (s: ClubSeason) => {
    setForm({ name: s.name, startDate: dateOnlyKey(s.startDate), endDate: dateOnlyKey(s.endDate) });
    setEditing(s.id);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      toast.error("Pon nombre, fecha de inicio y fecha de fin");
      return;
    }
    if (form.startDate > form.endDate) {
      toast.error("La fecha de inicio no puede ser posterior a la de fin");
      return;
    }
    save.mutate();
  };

  const chip = (active: boolean) =>
    `rounded-md border px-3 py-1.5 text-sm transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background text-foreground hover:bg-muted"
    }`;

  return (
    <section aria-label="Temporadas de precios">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Precios:</span>
        <button type="button" onClick={() => onSelect(null)} className={chip(selectedId === null)}>
          Precios base
        </button>
        {seasons.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={chip(selectedId === s.id)}
          >
            {s.name}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Nueva temporada
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Los precios base valen todo el año. Una temporada (verano, invierno…) tiene los suyos para sus
        fechas; si una pista no tiene precios en la temporada, esos días usa los base.
      </p>

      {seasons.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
          {seasons.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                <span className="font-medium">{s.name}</span>{" "}
                <span className="text-muted-foreground">{seasonRange(s)}</span>
              </span>
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(s)}
                  aria-label={`Editar ${s.name}`}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setToDelete(s)}
                  aria-label={`Borrar ${s.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <form
          onSubmit={onSubmit}
          className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4"
          aria-label={editing === "new" ? "Nueva temporada" : "Editar temporada"}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-muted-foreground">
              Nombre
              <input
                type="text"
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Verano, Invierno…"
                className={`${inputCls} mt-1 w-full`}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Desde
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className={`${inputCls} mt-1 w-full`}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Hasta (incluido)
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={`${inputCls} mt-1 w-full`}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar temporada
            </Button>
          </div>
        </form>
      )}

      <ConfirmModal
        open={!!toDelete}
        danger
        title={`Borrar la temporada «${toDelete?.name ?? ""}»`}
        description="Se borrarán también todos los precios de esa temporada, de todas las pistas. En sus fechas se volverán a cobrar los precios base. Las reservas ya hechas no cambian."
        confirmLabel="Borrar temporada"
        loading={remove.isPending}
        onClose={() => {
          if (!remove.isPending) setToDelete(null);
        }}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </section>
  );
}
