"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, PackagePlus, Pencil, Plus, ClipboardList, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { CountDialog, HistoryDialog, PurchaseDialog } from "@/components/admin/shop-stock-dialogs";
import { shopQK, shopService, type ProductPayload, type ShopProduct } from "@/lib/services/shop";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { formatCents } from "@/lib/utils/booking-price";
import { centsToEurosInput, eurosToCents } from "@/lib/utils/payment-methods";
import { parseCount, shopErrorText } from "@/lib/utils/shop";

const FIELD =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:border-[#D4AF37]";
const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const NAME_MAX = 60;
const ICON_BTN = "inline-flex min-h-11 min-w-11 items-center px-3 justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-50";

interface Draft {
  name:        string;
  price:       string;
  cost:        string;
  unitsPerBox: string;
  minStock:    string;
}

const EMPTY: Draft = { name: "", price: "", cost: "", unitsPerBox: "", minStock: "" };

function draftOf(p: ShopProduct): Draft {
  return {
    name: p.name,
    price: centsToEurosInput(p.priceCents),
    cost: p.costCents === null ? "" : centsToEurosInput(p.costCents),
    unitsPerBox: p.unitsPerBox === null ? "" : String(p.unitsPerBox),
    minStock: p.minStock === null ? "" : String(p.minStock),
  };
}

/** El producto que sale del formulario; null si algún campo no vale. Lo opcional vacío se manda como null. */
function payloadOf(d: Draft): ProductPayload | null {
  const priceCents = eurosToCents(d.price);
  const costCents = d.cost.trim() === "" ? null : eurosToCents(d.cost);
  const unitsPerBox = d.unitsPerBox.trim() === "" ? null : parseCount(d.unitsPerBox);
  const minStock = d.minStock.trim() === "" ? null : parseCount(d.minStock);
  const name = d.name.trim();
  if (name === "" || priceCents === null || priceCents < 1) return null;
  if (d.cost.trim() !== "" && costCents === null) return null;
  if (d.unitsPerBox.trim() !== "" && (unitsPerBox === null || unitsPerBox < 1)) return null;
  if (d.minStock.trim() !== "" && minStock === null) return null;
  return { name, priceCents, costCents, unitsPerBox, minStock };
}

/**
 * «Tienda» del módulo Cuentas: los productos que vende el club (bolas, grips...)
 * con su stock, que son las cajas compradas menos lo vendido, y el aviso de
 * stock bajo. Se da de alta, se edita, se desactiva y se borra si no se ha
 * usado; las compras de cajas y los recuentos quedan en el historial.
 */
export function AccountsShopSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const { timeZone } = useClubTimeZone(clubId);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [purchase, setPurchase] = useState<ShopProduct | null>(null);
  const [count, setCount] = useState<ShopProduct | null>(null);
  const [history, setHistory] = useState<ShopProduct | null>(null);
  const [removing, setRemoving] = useState<ShopProduct | null>(null);

  const query = useQuery({
    queryKey: shopQK.products(clubId),
    queryFn: () => shopService.products.list(clubId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: shopQK.all(clubId) });

  const save = useMutation({
    mutationFn: (v: { id: string | null; data: ProductPayload }) =>
      v.id ? shopService.products.update(clubId, v.id, v.data) : shopService.products.create(clubId, v.data),
    onSuccess: (_p, v) => { setEditing(null); toast.success(v.id ? "Producto guardado" : "Producto añadido"); return refresh(); },
    onError: (err: unknown) => toast.error(shopErrorText(err)),
  });
  // Activar o desactivar sin tocar lo demás: el PUT reemplaza, así que se manda el producto entero
  const toggle = useMutation({
    mutationFn: (p: ShopProduct) =>
      shopService.products.update(clubId, p.id, {
        name: p.name, priceCents: p.priceCents, costCents: p.costCents,
        unitsPerBox: p.unitsPerBox, minStock: p.minStock, active: !p.active,
      }),
    onSuccess: () => refresh(),
    onError: (err: unknown) => toast.error(shopErrorText(err)),
  });
  const remove = useMutation({
    mutationFn: (p: ShopProduct) => shopService.products.remove(clubId, p.id),
    onSuccess: () => { setRemoving(null); toast.success("Producto borrado"); return refresh(); },
    onError: (err: unknown) => { setRemoving(null); toast.error(shopErrorText(err)); },
  });
  const busy = save.isPending || toggle.isPending || remove.isPending;

  const payload = editing ? payloadOf(editing.draft) : null;
  const setField = (key: keyof Draft, value: string) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, [key]: value } } : e));

  return (
    <section aria-labelledby="shop-title" className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div>
        <h2 id="shop-title" className="font-heading text-lg text-foreground">Tienda</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lo que vende el club (bolas, grips...). El stock no se controla hasta que apuntes una compra o un recuento;
          desde entonces son las cajas compradas menos lo vendido, y avisa cuando queda menos de lo que marques o, si no
          marcas nada, de una caja. Se puede vender aunque no quede.
        </p>
      </div>

      {query.isError ? (
        <ErrorState title="No se pudieron cargar los productos" onRetry={() => query.refetch()} />
      ) : !query.data ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ningún producto. Añade el primero aquí abajo.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {query.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${p.active ? "text-foreground" : "text-muted-foreground line-through"}`}>{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCents(p.priceCents)}
                  {p.unitsPerBox ? ` · caja de ${p.unitsPerBox}` : ""}
                  {p.costCents !== null ? ` · coste ${formatCents(p.costCents)}` : ""}
                </p>
              </div>
              {p.stockTracked ? (
                <span
                  aria-label={`Stock de ${p.name}`}
                  className={`rounded-md px-2 py-0.5 text-sm tabular-nums ${
                    p.lowStock ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-foreground"
                  }`}
                >
                  Stock {p.stock}{p.lowStock ? " · bajo" : ""}
                </span>
              ) : (
                <span aria-label={`Stock de ${p.name}`} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">Sin control de stock</span>
                  <button type="button" onClick={() => setCount(p)} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                    Empezar a controlar el stock
                  </button>
                </span>
              )}
              <span className={`rounded-md px-2 py-0.5 text-xs ${p.active ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                {p.active ? "Activo" : "Desactivado"}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button type="button" aria-label={`Compra de cajas de ${p.name}`} title="Compra de cajas" onClick={() => setPurchase(p)} className={ICON_BTN}><PackagePlus className="h-4 w-4" /><span className="ml-1.5 text-sm">Comprar cajas</span></button>
                <button type="button" aria-label={`Recuento de ${p.name}`} title="Recuento" onClick={() => setCount(p)} className={ICON_BTN}><ClipboardList className="h-4 w-4" /><span className="ml-1.5 text-sm">Recuento</span></button>
                <button type="button" aria-label={`Historial de ${p.name}`} title="Historial" onClick={() => setHistory(p)} className={ICON_BTN}><History className="h-4 w-4" /><span className="ml-1.5 text-sm">Historial</span></button>
                <button type="button" aria-label={`Editar ${p.name}`} title="Editar" disabled={busy} onClick={() => setEditing({ id: p.id, draft: draftOf(p) })} className={ICON_BTN}><Pencil className="h-4 w-4" /></button>
                <button type="button" disabled={busy} onClick={() => toggle.mutate(p)} className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50">
                  {p.active ? "Desactivar" : "Activar"}
                </button>
                <button type="button" aria-label={`Borrar ${p.name}`} title="Borrar" disabled={busy} onClick={() => setRemoving(p)} className={ICON_BTN}><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <form
          aria-label={editing.id ? "Editar producto" : "Nuevo producto"}
          className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (payload) save.mutate({ id: editing.id, data: payload });
          }}
        >
          <label className="block sm:col-span-2">
            <span className={LABEL}>Nombre</span>
            <input type="text" aria-label="Nombre del producto" value={editing.draft.name} maxLength={NAME_MAX} autoFocus onChange={(e) => setField("name", e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className={LABEL}>Precio de venta (€)</span>
            <input type="text" inputMode="decimal" aria-label="Precio de venta" placeholder="6,00" value={editing.draft.price} onChange={(e) => setField("price", e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className={LABEL}>Coste por unidad (€, opcional)</span>
            <input type="text" inputMode="decimal" aria-label="Coste por unidad" placeholder="3,75" value={editing.draft.cost} onChange={(e) => setField("cost", e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className={LABEL}>Unidades por caja (opcional)</span>
            <input type="text" inputMode="numeric" aria-label="Unidades por caja" placeholder="24" value={editing.draft.unitsPerBox} onChange={(e) => setField("unitsPerBox", e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className={LABEL}>Avisar por debajo de (opcional)</span>
            <input type="text" inputMode="numeric" aria-label="Avisar por debajo de" placeholder="Una caja" value={editing.draft.minStock} onChange={(e) => setField("minStock", e.target.value)} className={FIELD} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy || payload === null} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-[#D4AF37] px-5 text-sm font-semibold text-[#0C0C0C] disabled:opacity-50">
              {editing.id ? "Guardar" : "Añadir producto"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-secondary">Cancelar</button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing({ id: null, draft: EMPTY })}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-[#D4AF37] px-5 text-sm font-semibold text-[#0C0C0C]"
        >
          <Plus className="h-4 w-4" /> Nuevo producto
        </button>
      )}

      {purchase && <PurchaseDialog clubId={clubId} product={purchase} onClose={() => setPurchase(null)} />}
      {count && <CountDialog clubId={clubId} product={count} onClose={() => setCount(null)} />}
      {history && timeZone && <HistoryDialog clubId={clubId} product={history} timeZone={timeZone} onClose={() => setHistory(null)} />}
      <ConfirmModal
        open={removing !== null}
        title="Borrar el producto"
        description={removing ? `${removing.name} se borra del todo. Si ya tiene ventas o movimientos de stock no se puede: desactívalo.` : ""}
        confirmLabel="Borrar"
        danger
        loading={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </section>
  );
}
