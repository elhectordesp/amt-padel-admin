"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import {
  PART_PRICE_KINDS, accountsQK, accountsService,
  type PartPrice, type PartPriceKind,
} from "@/lib/services/accounts";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import {
  PART_PRICE_KIND_LABEL, WEEK_DAYS, describeSlot, draftsFromPrice, draftsToSlots, emptySlotDraft,
  validateSlotDrafts, type SlotDraft,
} from "@/lib/utils/part-prices";

const FIELD =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:border-[#D4AF37]";
const NAME_MAX = 60;

/** Lo que el formulario edita de un precio. */
interface Form {
  /** null: precio nuevo. */
  id:       string | null;
  name:     string;
  kind:     PartPriceKind;
  perCourt: boolean;
  slots:    SlotDraft[];
}

const newForm = (): Form => ({ id: null, name: "", kind: "SPECIAL", perCourt: false, slots: [emptySlotDraft()] });

const formOf = (p: PartPrice): Form => ({
  id: p.id, name: p.name, kind: p.kind, perCourt: p.perCourt, slots: draftsFromPrice(p),
});

/**
 * «Precios especiales»: los precios con nombre que el club aplica a mano a una
 * parte de la reserva («Alumno», «Amigo del club»...), con su importe por
 * franja de día y hora. Uno es el de alumno (el único que avisa al abrir una
 * parte de un alumno). Se pueden desactivar; borrar, solo los que no se han usado.
 */
export function AccountsPartPricesSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<PartPrice | null>(null);
  // El que no se pudo borrar por estar usado: se ofrece desactivarlo
  const [inUse, setInUse] = useState<PartPrice | null>(null);

  const query = useQuery({
    queryKey: accountsQK.partPrices(clubId),
    queryFn: () => accountsService.partPrices.list(clubId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: accountsQK.partPrices(clubId) });

  const save = useMutation({
    mutationFn: (f: Form) => {
      const slots = draftsToSlots(f.slots);
      const current = f.id ? query.data?.find((p) => p.id === f.id) : undefined;
      return f.id && current
        ? accountsService.partPrices.update(clubId, f.id, {
            name: f.name.trim(), kind: f.kind, perCourt: f.perCourt, slots,
            active: current.active, displayOrder: current.displayOrder,
          })
        : accountsService.partPrices.create(clubId, { name: f.name.trim(), kind: f.kind, perCourt: f.perCourt, slots });
    },
    onSuccess: () => { setForm(null); toast.success("Precio guardado"); return refresh(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  const setActive = useMutation({
    mutationFn: (v: { price: PartPrice; active: boolean }) =>
      accountsService.partPrices.update(clubId, v.price.id, {
        name: v.price.name, kind: v.price.kind, perCourt: v.price.perCourt, slots: v.price.slots,
        active: v.active, displayOrder: v.price.displayOrder,
      }),
    onSuccess: () => { setInUse(null); return refresh(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  const remove = useMutation({
    mutationFn: (p: PartPrice) => accountsService.partPrices.remove(clubId, p.id),
    onSuccess: () => { setToDelete(null); toast.success("Precio borrado"); return refresh(); },
    onError: (err: unknown, p) => {
      setToDelete(null);
      // Ya se usó en alguna reserva: no se puede borrar, pero sí desactivar
      if ((err as { code?: string }).code === "ACCOUNTS_IN_USE") setInUse(p);
      else toast.error(accountsErrorText(err));
    },
  });

  const slotError = form ? validateSlotDrafts(form.slots) : null;
  const nameOk = form !== null && form.name.trim() !== "";
  const busy = save.isPending || setActive.isPending || remove.isPending;

  const patchSlot = (i: number, patch: Partial<SlotDraft>) =>
    setForm((f) => f && { ...f, slots: f.slots.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const toggleDay = (i: number, day: number) =>
    setForm((f) => f && {
      ...f,
      slots: f.slots.map((s, k) =>
        k === i ? { ...s, days: s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day] } : s,
      ),
    });

  return (
    <section aria-labelledby="part-prices-title" className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="part-prices-title" className="font-heading text-lg text-foreground">Precios especiales</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Precios con nombre que aplicas a mano al cobrar una parte de la reserva: el de alumno, «Amigo del club»…
            Cada uno tiene su importe según el día y la hora de la reserva.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm(newForm())}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-[#D4AF37] px-5 text-sm font-semibold text-[#0C0C0C]"
        >
          <Plus className="h-4 w-4" /> Nuevo precio
        </button>
      </div>

      {query.isError ? (
        <ErrorState title="No se pudieron cargar los precios" onRetry={() => query.refetch()} />
      ) : !query.data ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay precios especiales.</p>
      ) : (
        <ul className="space-y-3">
          {query.data.map((p) => (
            <li key={p.id} className={`rounded-md border border-border p-3 ${p.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{p.name}</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{PART_PRICE_KIND_LABEL[p.kind]}</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {p.perCourt ? "Pista entera" : "Por jugador"}
                </span>
                {!p.active && <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">Desactivado</span>}
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    aria-label={`Editar ${p.name}`}
                    disabled={busy}
                    onClick={() => setForm(formOf(p))}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setActive.mutate({ price: p, active: !p.active })}
                    className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50"
                  >
                    {p.active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Borrar ${p.name}`}
                    disabled={busy}
                    onClick={() => setToDelete(p)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                {p.slots.map((s, i) => <li key={i}>{describeSlot(s)}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!save.isPending) setForm(null); }} />
          <div
            role="dialog"
            aria-label={form.id ? "Editar precio" : "Nuevo precio"}
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-heading text-lg text-foreground">{form.id ? "Editar precio" : "Nuevo precio"}</h3>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={save.isPending}
                onClick={() => setForm(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-40"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</span>
                <input
                  type="text"
                  aria-label="Nombre del precio"
                  placeholder="Alumno, Amigo del club…"
                  value={form.name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={FIELD}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo</span>
                  <select
                    aria-label="Tipo de precio"
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value as PartPriceKind })}
                    className={FIELD}
                  >
                    {PART_PRICE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k === "STUDENT" ? "Alumno (el panel avisa de los alumnos)" : "Especial"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Se aplica</span>
                  <select
                    aria-label="Cómo se aplica el precio"
                    value={form.perCourt ? "court" : "player"}
                    onChange={(e) => setForm({ ...form, perCourt: e.target.value === "court" })}
                    className={FIELD}
                  >
                    <option value="player">Por jugador</option>
                    <option value="court">A la pista entera (se reparte entre las partes)</option>
                  </select>
                </label>
              </div>

              <div className="space-y-3">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Franjas</span>
                {form.slots.map((s, i) => (
                  <fieldset key={i} className="space-y-2 rounded-md border border-border p-3">
                    <legend className="px-1 text-xs text-muted-foreground">Franja {i + 1}</legend>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Días de la franja ${i + 1}`}>
                      {WEEK_DAYS.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          title={d.name}
                          aria-label={d.name}
                          aria-pressed={s.days.includes(d.value)}
                          onClick={() => toggleDay(i, d.value)}
                          className={`min-h-11 min-w-11 rounded-md border text-sm font-semibold ${
                            s.days.includes(d.value)
                              ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                              : "border-border bg-secondary text-muted-foreground"
                          }`}
                        >
                          {d.letter}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <label className="block text-xs text-muted-foreground">
                        Desde
                        <input
                          type="time"
                          aria-label={`Desde de la franja ${i + 1}`}
                          value={s.start}
                          onChange={(e) => patchSlot(i, { start: e.target.value })}
                          className={FIELD}
                        />
                      </label>
                      <label className="block text-xs text-muted-foreground">
                        Hasta
                        <input
                          type="time"
                          aria-label={`Hasta de la franja ${i + 1}`}
                          value={s.end}
                          onChange={(e) => patchSlot(i, { end: e.target.value })}
                          className={FIELD}
                        />
                      </label>
                      <label className="block text-xs text-muted-foreground">
                        Precio (€)
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Precio de la franja ${i + 1}`}
                          placeholder="5,50"
                          value={s.price}
                          onChange={(e) => patchSlot(i, { price: e.target.value })}
                          className={FIELD}
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Quitar la franja ${i + 1}`}
                        disabled={form.slots.length === 1}
                        onClick={() => setForm({ ...form, slots: form.slots.filter((_, k) => k !== i) })}
                        className="mt-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </fieldset>
                ))}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, slots: [...form.slots, emptySlotDraft()] })}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 text-sm hover:bg-secondary"
                >
                  <Plus className="h-4 w-4" /> Añadir franja
                </button>
                {slotError && <p role="alert" className="text-sm text-red-400">{slotError}</p>}
              </div>
            </div>

            <div className="flex gap-3 border-t border-border px-5 py-4">
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => setForm(null)}
                className="min-h-11 flex-1 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!nameOk || slotError !== null || save.isPending}
                onClick={() => save.mutate(form)}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#D4AF37] text-sm font-semibold text-[#0C0C0C] disabled:opacity-60"
              >
                {save.isPending && <Loader2 size={14} className="animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={toDelete !== null}
        danger
        title={`¿Borrar «${toDelete?.name ?? ""}»?`}
        description="Se borra el precio y sus franjas. Si ya se ha usado en alguna reserva no se puede borrar, y te propondremos desactivarlo."
        confirmLabel="Sí, borrar"
        cancelLabel="No, volver"
        loading={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
      <ConfirmModal
        open={inUse !== null}
        title="Este precio ya se ha usado"
        description={`«${inUse?.name ?? ""}» está en reservas ya cobradas y no se puede borrar. Si lo desactivas, dejará de ofrecerse al cobrar y lo cobrado se queda como está.`}
        confirmLabel="Desactivarlo"
        cancelLabel="Dejarlo como está"
        loading={setActive.isPending}
        onClose={() => setInUse(null)}
        onConfirm={() => inUse && setActive.mutate({ price: inUse, active: false })}
      />
    </section>
  );
}
