"use client";

/**
 * Catálogo de bonos del club: lo que vende («Bono 10 reservas», 120 €, vale
 * 90 días). Cada bono vendido copia su nombre, sesiones y precio: cambiar o
 * borrar un tipo no toca los ya vendidos. Un tipo dado de baja deja de
 * ofrecerse al vender.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Ticket, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { errorText } from "@/components/admin/price-seasons-panel";
import { Button } from "@/components/ui/button";
import {
  clubVouchersQK,
  clubVouchersService,
  type ClubVoucherType,
} from "@/lib/services/club-vouchers";
import { useClubAccess } from "@/lib/use-club-access";
import { formatCents } from "@/lib/utils/booking-price";
import {
  EMPTY_TYPE_FORM,
  VOUCHER_MAX_SESSIONS,
  VOUCHER_MAX_VALID_DAYS,
  checkTypeForm,
  typeFormOf,
  validityLabel,
  type TypeFormValues,
} from "@/lib/utils/voucher";

const inputCls = "rounded border border-border bg-background px-2 py-1 text-sm";

export function VoucherTypesSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const { can } = useClubAccess();
  const canEdit = can("settings", "write");

  const types = useQuery({
    queryKey: clubVouchersQK.types(clubId),
    queryFn: () => clubVouchersService.types.list(clubId),
  });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<TypeFormValues>(EMPTY_TYPE_FORM);
  const [toDelete, setToDelete] = useState<ClubVoucherType | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: clubVouchersQK.types(clubId) });

  const save = useMutation({
    mutationFn: () => {
      const checked = checkTypeForm(form);
      if (!checked.ok) throw new Error(checked.message);
      return editing === "new"
        ? clubVouchersService.types.create(clubId, checked.value)
        : clubVouchersService.types.update(clubId, editing!, checked.value);
    },
    onSuccess: () => {
      toast.success(editing === "new" ? "Bono creado" : "Bono guardado");
      setEditing(null);
      refresh();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      clubVouchersService.types.update(clubId, id, { active }),
    onSuccess: (_t, { active }) => {
      toast.success(active ? "Bono reactivado" : "Bono dado de baja");
      refresh();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => clubVouchersService.types.remove(clubId, id),
    onSuccess: () => {
      toast.success("Bono borrado del catálogo");
      setToDelete(null);
      refresh();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const checked = checkTypeForm(form);
    if (!checked.ok) {
      toast.error(checked.message);
      return;
    }
    save.mutate();
  };

  const list = types.data ?? [];

  return (
    <section aria-label="Bonos">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-medium">Bonos de reservas</h2>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setForm(EMPTY_TYPE_FORM);
              setEditing("new");
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo bono
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Un bono de N reservas de pista (cada sesión es una reserva entera). Se vende desde la ficha
        del cliente, se cobra a mano y se descuenta al cobrar sus reservas. Cambiar o borrar un bono
        de aquí no toca los ya vendidos.
      </p>

      {types.isLoading ? (
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />
      ) : types.isError ? (
        <p className="mt-4 text-sm text-destructive">No se han podido cargar los bonos.</p>
      ) : list.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          <Ticket className="h-7 w-7 opacity-50" />
          Aún no hay bonos en el catálogo.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
          {list.map((t) => (
            <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
              <div>
                <div>
                  <span className="font-medium">{t.name}</span>
                  {!t.active && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">De baja</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t.sessions} {t.sessions === 1 ? "sesión" : "sesiones"} · {formatCents(t.priceCents)} ·{" "}
                  {validityLabel(t.validDays)}
                </div>
              </div>
              {canEdit && (
                <span className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ id: t.id, active: !t.active })}
                  >
                    {t.active ? "Dar de baja" : "Reactivar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setForm(typeFormOf(t));
                      setEditing(t.id);
                    }}
                    aria-label={`Editar ${t.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setToDelete(t)}
                    aria-label={`Borrar ${t.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </span>
              )}
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
            aria-labelledby="voucher-type-dialog-title"
            className="relative max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="voucher-type-dialog-title" className="font-heading text-base">
                {editing === "new" ? "Nuevo bono" : "Editar bono"}
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
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Bono 10 reservas"
                className={`${inputCls} mt-1 w-full`}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-muted-foreground">
                Sesiones (reservas)
                <input
                  type="number"
                  min={1}
                  max={VOUCHER_MAX_SESSIONS}
                  value={form.sessions}
                  onChange={(e) => setForm({ ...form, sessions: e.target.value })}
                  className={`${inputCls} mt-1 w-full`}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Precio del bono (€)
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="120"
                  className={`${inputCls} mt-1 w-full`}
                />
              </label>
            </div>

            <label className="block text-xs text-muted-foreground">
              Días de validez desde la venta
              <input
                type="number"
                min={1}
                max={VOUCHER_MAX_VALID_DAYS}
                value={form.validDays}
                onChange={(e) => setForm({ ...form, validDays: e.target.value })}
                placeholder="Vacío: no caduca"
                className={`${inputCls} mt-1 w-full`}
              />
            </label>
            <p className="-mt-2 text-xs text-muted-foreground">
              Caduca al final del día que toque, en la hora del club. Una sesión se puede gastar en
              una reserva que sea hasta ese día.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar bono
              </Button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        danger
        title={`Borrar «${toDelete?.name ?? ""}» del catálogo`}
        description="Dejará de ofrecerse al vender. Los bonos ya vendidos conservan su nombre, sesiones, precio y saldo."
        confirmLabel="Borrar bono"
        loading={remove.isPending}
        onClose={() => {
          if (!remove.isPending) setToDelete(null);
        }}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </section>
  );
}
