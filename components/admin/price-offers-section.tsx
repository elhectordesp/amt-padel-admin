"use client";

/**
 * Ofertas de precio del club: «-20 % las mañanas de agosto». Lista y diálogo de
 * alta/edición. Si varias ofertas (o el descuento de socios) coinciden en un
 * hueco, se aplica el mayor: no se suman.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { errorText } from "@/components/admin/price-seasons-panel";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { ALL_DAYS, DAY_SHORT, daysLabel } from "@/lib/utils/price-grid";
import { dateOnlyKey, formatDayKey } from "@/lib/utils/time-zone";
import type { Court } from "@/types";
import type { ClubPriceOffer } from "@/types/bookings";

interface OfferForm {
  name: string;
  startDate: string;
  endDate: string;
  days: number[];
  startTime: string;
  endTime: string;
  allCourts: boolean;
  courtIds: string[];
  discountPercent: string;
  membersOnly: boolean;
}

const EMPTY_FORM: OfferForm = {
  name: "",
  startDate: "",
  endDate: "",
  days: [...ALL_DAYS],
  startTime: "09:00",
  endTime: "14:00",
  allCourts: true,
  courtIds: [],
  discountPercent: "",
  membersOnly: false,
};

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const inputCls = "rounded border border-border bg-background px-2 py-1 text-sm";

function formOf(o: ClubPriceOffer): OfferForm {
  return {
    name: o.name,
    startDate: dateOnlyKey(o.startDate),
    endDate: dateOnlyKey(o.endDate),
    days: o.daysOfWeek,
    startTime: o.startTime,
    endTime: o.endTime,
    allCourts: o.courtIds.length === 0,
    courtIds: o.courtIds,
    discountPercent: String(o.discountPercent),
    membersOnly: o.membersOnly,
  };
}

export function PriceOffersSection({ clubId, courts }: { clubId: string; courts: Court[] }) {
  const qc = useQueryClient();
  const offers = useQuery({
    queryKey: bookingsQK.priceOffers(clubId),
    queryFn: () => bookingsService.priceOffers.list(clubId),
  });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<OfferForm>(EMPTY_FORM);
  const [toDelete, setToDelete] = useState<ClubPriceOffer | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: bookingsQK.priceOffers(clubId) });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        daysOfWeek: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
        courtIds: form.allCourts ? [] : form.courtIds,
        discountPercent: Number(form.discountPercent),
        membersOnly: form.membersOnly,
      };
      return editing === "new"
        ? bookingsService.priceOffers.create(clubId, payload)
        : bookingsService.priceOffers.update(clubId, editing!, payload);
    },
    onSuccess: () => {
      toast.success(editing === "new" ? "Oferta creada" : "Oferta guardada");
      setEditing(null);
      refresh();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => bookingsService.priceOffers.remove(clubId, id),
    onSuccess: () => {
      toast.success("Oferta borrada");
      setToDelete(null);
      refresh();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const validate = (): string | null => {
    const percent = Number(form.discountPercent);
    if (!form.name.trim()) return "Pon un nombre a la oferta";
    if (!form.startDate || !form.endDate) return "Pon la fecha de inicio y la de fin";
    if (form.startDate > form.endDate) return "La fecha de inicio no puede ser posterior a la de fin";
    if (form.days.length === 0) return "Elige al menos un día de la semana";
    if (!form.startTime || !form.endTime || form.startTime >= form.endTime)
      return "La hora de inicio debe ser anterior a la de fin";
    if (!Number.isInteger(percent) || percent < 1 || percent > 100)
      return "El descuento debe ser un número entero entre 1 y 100";
    if (!form.allCourts && form.courtIds.length === 0) return "Elige al menos una pista";
    return null;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    save.mutate();
  };

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort((a, b) => a - b),
    }));
  const toggleCourt = (id: string) =>
    setForm((f) => ({
      ...f,
      courtIds: f.courtIds.includes(id) ? f.courtIds.filter((x) => x !== id) : [...f.courtIds, id],
    }));

  const courtsText = (o: ClubPriceOffer) =>
    o.courtIds.length === 0
      ? "Todas las pistas"
      : o.courtIds.map((id) => courts.find((c) => c.id === id)?.name ?? "Pista borrada").join(", ");

  const list = offers.data ?? [];

  return (
    <section aria-label="Ofertas">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-medium">Ofertas</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setForm(EMPTY_FORM);
            setEditing("new");
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Nueva oferta
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Un descuento por fechas, días y horas (p. ej. «-20 % las mañanas de agosto»). El jugador ve
        directamente el precio final. Si coinciden varias ofertas, o una oferta y el descuento de
        socios, se aplica el mayor: no se suman.
      </p>

      {offers.isLoading ? (
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />
      ) : list.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          <Tag className="h-7 w-7 opacity-50" />
          Aún no hay ofertas.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
          {list.map((o) => (
            <li key={o.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
              <div>
                <div>
                  <span className="font-medium">{o.name}</span>{" "}
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                    -{o.discountPercent} %
                  </span>
                  {o.membersOnly && (
                    <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">Solo socios</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {formatDayKey(dateOnlyKey(o.startDate), DATE_FMT)} –{" "}
                  {formatDayKey(dateOnlyKey(o.endDate), DATE_FMT)} · {daysLabel(o.daysOfWeek)} ·{" "}
                  {o.startTime}–{o.endTime} · {courtsText(o)}
                </div>
              </div>
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setForm(formOf(o));
                    setEditing(o.id);
                  }}
                  aria-label={`Editar ${o.name}`}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setToDelete(o)}
                  aria-label={`Borrar ${o.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!save.isPending) setEditing(null);
            }}
          />
          <form
            onSubmit={onSubmit}
            noValidate
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-dialog-title"
            className="relative max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="offer-dialog-title" className="font-heading text-base">
                {editing === "new" ? "Nueva oferta" : "Editar oferta"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
              >
                <X size={15} />
              </button>
            </div>

            <label className="block text-xs text-muted-foreground">
              Nombre
              <input
                type="text"
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mañanas de agosto"
                className={`${inputCls} mt-1 w-full`}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
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

            <div>
              <span className="text-xs text-muted-foreground">Días de la semana</span>
              <div className="mt-1 flex gap-0.5">
                {ALL_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={form.days.includes(d)}
                    title={DAY_SHORT[d]}
                    className={`h-7 w-9 rounded border text-xs ${
                      form.days.includes(d)
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {DAY_SHORT[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-muted-foreground">
                Empieza a las
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className={`${inputCls} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Hasta las
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className={`${inputCls} mt-1 w-full`}
                />
              </label>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Cuenta la hora a la que EMPIEZA la reserva: de 09:00 a 14:00 entra la de las 13:30, no la
              de las 14:00.
            </p>

            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allCourts}
                  onChange={(e) => setForm({ ...form, allCourts: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                Todas las pistas
              </label>
              {!form.allCourts && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {courts.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={form.courtIds.includes(c.id)}
                        onChange={() => toggleCourt(c.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <label className="block text-xs text-muted-foreground">
                Descuento (%)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                  className={`${inputCls} mt-1 w-24`}
                />
              </label>
              <label className="flex items-center gap-2 pb-1 text-sm">
                <input
                  type="checkbox"
                  checked={form.membersOnly}
                  onChange={(e) => setForm({ ...form, membersOnly: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                Solo para socios
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar oferta
              </Button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        danger
        title={`Borrar la oferta «${toDelete?.name ?? ""}»`}
        description="Dejará de aplicarse a las reservas nuevas. Las reservas ya hechas conservan su precio."
        confirmLabel="Borrar oferta"
        loading={remove.isPending}
        onClose={() => {
          if (!remove.isPending) setToDelete(null);
        }}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </section>
  );
}
