"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { shopQK, shopService, type ShopProduct } from "@/lib/services/shop";
import { formatCents } from "@/lib/utils/booking-price";
import { eurosToCents } from "@/lib/utils/payment-methods";
import { countDifference, moveLabel, parseCount, purchaseUnits, shopErrorText, signedUnits } from "@/lib/utils/shop";
import { formatInTimeZone } from "@/lib/utils/time-zone";

const FIELD =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:border-[#D4AF37]";
const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const NOTES_MIN = 3;
const NOTES_MAX = 200;

function Shell({ title, subtitle, onClose, busy, children }: {
  title: string; subtitle: string; onClose: () => void; busy?: boolean; children: React.ReactNode;
}) {
  const close = () => { if (!busy) onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div role="dialog" aria-label={title} className="relative flex max-h-[92vh] w-full max-w-md flex-col rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">{title}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button onClick={close} disabled={busy} aria-label="Cerrar" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-40">
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Footer({ onClose, busy, canSave, submit, onSubmit }: {
  onClose: () => void; busy: boolean; canSave: boolean; submit: string; onSubmit: () => void;
}) {
  return (
    <div className="flex gap-3 border-t border-border px-5 py-4">
      <button onClick={onClose} disabled={busy} className="flex-1 rounded-md border border-border py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40">
        Cancelar
      </button>
      <button
        onClick={onSubmit}
        disabled={!canSave || busy}
        className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#D4AF37] py-2 text-sm font-semibold text-[#0C0C0C] hover:bg-[#C49F2A] disabled:opacity-60"
      >
        {busy ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : submit}
      </button>
    </div>
  );
}

/** «Compra de cajas»: cuántas cajas (o unidades sueltas), lo pagado y una nota. */
export function PurchaseDialog({ clubId, product, onClose }: { clubId: string; product: ShopProduct; onClose: () => void }) {
  const qc = useQueryClient();
  const hasBox = product.unitsPerBox !== null;
  const [mode, setMode] = useState<"boxes" | "units">(hasBox ? "boxes" : "units");
  const [amount, setAmount] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  const count = parseCount(amount);
  const units = count === null ? null : purchaseUnits(mode, count, product.unitsPerBox);
  const costCents = cost.trim() === "" ? undefined : eurosToCents(cost);

  const save = useMutation({
    mutationFn: () =>
      shopService.products.addStock(clubId, product.id, {
        kind: "PURCHASE",
        ...(mode === "boxes" ? { boxes: count as number } : { units: count as number }),
        ...(costCents !== undefined && costCents !== null ? { costCents } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success("Compra apuntada");
      qc.invalidateQueries({ queryKey: shopQK.all(clubId) });
      onClose();
    },
    onError: (err: unknown) => toast.error(shopErrorText(err)),
  });

  return (
    <Shell title="Compra de cajas" subtitle={`${product.name} · stock ahora ${product.stock}`} onClose={onClose} busy={save.isPending}>
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        {hasBox && (
          <div role="group" aria-label="Qué se compra" className="grid grid-cols-2 gap-2">
            {(["boxes", "units"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-11 rounded-md border text-sm font-medium ${
                  mode === m
                    ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {m === "boxes" ? `Cajas de ${product.unitsPerBox}` : "Unidades sueltas"}
              </button>
            ))}
          </div>
        )}
        <label className="block">
          <span className={LABEL}>{mode === "boxes" ? "Cajas compradas" : "Unidades compradas"}</span>
          <input type="text" inputMode="numeric" aria-label={mode === "boxes" ? "Cajas compradas" : "Unidades compradas"} value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD} />
        </label>
        {units !== null && <p className="text-sm text-muted-foreground">Entran {units} unidades: el stock pasa a {product.stock + units}.</p>}
        <label className="block">
          <span className={LABEL}>Lo pagado en total (opcional)</span>
          <input type="text" inputMode="decimal" aria-label="Lo pagado en total" placeholder="90,00" value={cost} onChange={(e) => setCost(e.target.value)} className={FIELD} />
          {costCents === null && <span className="mt-1 block text-xs text-red-400">Escribe un importe válido (por ejemplo 90,00)</span>}
        </label>
        <label className="block">
          <span className={LABEL}>Nota (opcional)</span>
          <input type="text" aria-label="Nota de la compra" value={notes} maxLength={NOTES_MAX} onChange={(e) => setNotes(e.target.value)} className={FIELD} />
        </label>
      </div>
      <Footer onClose={onClose} busy={save.isPending} canSave={units !== null && costCents !== null} submit="Apuntar compra" onSubmit={() => save.mutate()} />
    </Shell>
  );
}

/** «Recuento»: lo que hay contado; se guarda la diferencia con el stock, con una nota. */
export function CountDialog({ clubId, product, onClose }: { clubId: string; product: ShopProduct; onClose: () => void }) {
  const qc = useQueryClient();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const count = parseCount(counted);
  const diff = count === null ? null : countDifference(count, product.stock);
  const text = notes.trim();

  const save = useMutation({
    mutationFn: () =>
      shopService.products.addStock(clubId, product.id, { kind: "ADJUSTMENT", countedUnits: count as number, notes: text }),
    onSuccess: () => {
      toast.success("Recuento guardado");
      qc.invalidateQueries({ queryKey: shopQK.all(clubId) });
      onClose();
    },
    onError: (err: unknown) => toast.error(shopErrorText(err)),
  });

  return (
    <Shell title="Recuento" subtitle={`${product.name} · el stock dice ${product.stock}`} onClose={onClose} busy={save.isPending}>
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <label className="block">
          <span className={LABEL}>Unidades contadas</span>
          <input type="text" inputMode="numeric" aria-label="Unidades contadas" value={counted} onChange={(e) => setCounted(e.target.value)} className={FIELD} />
        </label>
        {diff !== null && (
          <p role="status" className="text-sm text-muted-foreground">
            {diff === 0 ? "Coincide con el stock: no hay nada que ajustar." : `Se guarda una diferencia de ${signedUnits(diff)} unidades.`}
          </p>
        )}
        <label className="block">
          <span className={LABEL}>Nota (obligatoria)</span>
          <input type="text" aria-label="Nota del recuento" placeholder="Recuento de noviembre" value={notes} maxLength={NOTES_MAX} onChange={(e) => setNotes(e.target.value)} className={FIELD} />
        </label>
      </div>
      <Footer onClose={onClose} busy={save.isPending} canSave={diff !== null && diff !== 0 && text.length >= NOTES_MIN} submit="Guardar recuento" onSubmit={() => save.mutate()} />
    </Shell>
  );
}

/** El historial de un producto: compras, recuentos y ventas, lo último primero. */
export function HistoryDialog({ clubId, product, timeZone, onClose }: {
  clubId: string; product: ShopProduct; timeZone: string; onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: shopQK.moves(clubId, product.id, page),
    queryFn: () => shopService.products.moves(clubId, product.id, page),
    placeholderData: (prev) => prev,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Shell title="Historial" subtitle={product.name} onClose={onClose}>
      <div className="overflow-y-auto p-5">
        {query.isError ? (
          <p role="alert" className="text-sm text-destructive">No se pudo cargar el historial.</p>
        ) : !data ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.items.map((m) => (
              <li key={`${m.kind}-${m.id}`} className="flex items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className={m.cancelled ? "text-muted-foreground line-through" : "text-foreground"}>{moveLabel(m)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatInTimeZone(m.at, timeZone, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })} · {m.byName}
                    {m.costCents !== null ? ` · pagado ${formatCents(m.costCents)}` : ""}
                    {m.amountCents !== null ? ` · ${formatCents(m.amountCents)}` : ""}
                    {m.notes ? ` · ${m.notes}` : ""}
                  </p>
                </div>
                <span className={`font-semibold tabular-nums ${m.cancelled ? "text-muted-foreground" : m.units < 0 ? "text-red-500" : "text-green-600"}`}>
                  {signedUnits(m.units)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="min-h-9 rounded-md border border-border px-3 disabled:opacity-40">Anteriores</button>
            <span className="text-muted-foreground">Página {page} de {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="min-h-9 rounded-md border border-border px-3 disabled:opacity-40">Siguientes</button>
          </div>
        )}
      </div>
    </Shell>
  );
}
