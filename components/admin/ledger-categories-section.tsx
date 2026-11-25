"use client";

/**
 * «Cuentas» → «Ajustes» → categorías de gastos e ingresos (F8-C1) y el aviso de
 * gastos sin justificante. El club empieza con un juego por defecto (no se
 * borra: se desactiva) y lo edita. Solo propietario y gestor.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { CustomSelect, Field, Input } from "@/components/admin/form";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { accountsConfigQK, accountsConfigService } from "@/lib/services/accounts-config";
import {
  LEDGER_ACTIVITIES, ledgerQK, ledgerService,
  type LedgerActivity, type LedgerCategory, type LedgerKind,
} from "@/lib/services/ledger";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { ACTIVITY_LABEL, isDayKey } from "@/lib/utils/ledger";

export function LedgerCategoriesSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LedgerCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<LedgerCategory | null>(null);
  const categories = useQuery({
    queryKey: ledgerQK.categories(clubId),
    queryFn: () => ledgerService.categories.list(clubId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ledgerQK.categories(clubId) });
  const toggle = useMutation({
    mutationFn: (c: LedgerCategory) => ledgerService.categories.update(clubId, c.id, { active: !c.active }),
    onSuccess: refresh,
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const remove = useMutation({
    mutationFn: (c: LedgerCategory) => ledgerService.categories.remove(clubId, c.id),
    onSuccess: () => { setDeleting(null); toast.success("Categoría borrada"); refresh(); },
    onError: (err: unknown) => {
      setDeleting(null);
      toast.error(
        (err as { code?: string }).code === "ACCOUNTS_IN_USE"
          ? "Esta categoría es de serie o ya tiene apuntes: no se borra, desactívala y dejará de ofrecerse."
          : accountsErrorText(err),
      );
    },
  });

  const group = (kind: LedgerKind) => (categories.data ?? []).filter((c) => c.kind === kind);

  return (
    <section aria-label="Categorías de gastos e ingresos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-medium">Categorías de gastos e ingresos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sirven para ordenar los apuntes y, más adelante, para el resumen. Las de serie no se borran: se
            desactivan.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-3.5 w-3.5" /> Nueva categoría
        </Button>
      </div>
      {categories.isPending ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : categories.isError ? (
        <p className="text-sm text-destructive">No se pudieron cargar las categorías</p>
      ) : (
        (["EXPENSE", "INCOME"] as const).map((kind) => (
          <div key={kind} className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {kind === "EXPENSE" ? "Gastos" : "Ingresos"}
            </h3>
            <ul className="space-y-1">
              {group(kind).map((c) => (
                <li key={c.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm ${c.active ? "" : "opacity-60"}`}>
                  <span>
                    {c.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {ACTIVITY_LABEL[c.activity]}{c.vatPercent !== null ? ` · IVA ${c.vatPercent} %` : ""}{c.isFund ? " · Fondo" : ""}
                    </span>
                    {!c.active && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Desactivada</span>}
                  </span>
                  <span className="flex gap-1">
                    <Button size="xs" variant="outline" onClick={() => toggle.mutate(c)} disabled={toggle.isPending}>
                      {c.active ? "Desactivar" : "Activar"}
                    </Button>
                    <Button size="icon-xs" variant="outline" aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {c.systemKey === null && !c.inUse && (
                      <Button size="icon-xs" variant="outline" aria-label={`Borrar ${c.name}`} onClick={() => setDeleting(c)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <ReceiptsSetting clubId={clubId} />
      {editing && (
        <CategoryDialog
          clubId={clubId}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={refresh}
        />
      )}
      <ConfirmModal
        open={!!deleting}
        title={`¿Borrar «${deleting?.name ?? ""}»?`}
        description="Solo se puede borrar una categoría propia que no se haya usado nunca."
        confirmLabel="Borrar"
        danger
        loading={remove.isPending}
        onClose={() => { if (!remove.isPending) setDeleting(null); }}
        onConfirm={() => { if (deleting) remove.mutate(deleting); }}
      />
    </section>
  );
}

function CategoryDialog({
  clubId, category, onClose, onDone,
}: { clubId: string; category: LedgerCategory | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<LedgerKind>(category?.kind ?? "EXPENSE");
  const [activity, setActivity] = useState<LedgerActivity>(category?.activity ?? "OTHER");
  const [vat, setVat] = useState(category?.vatPercent !== null && category?.vatPercent !== undefined ? String(category.vatPercent) : "");
  const [isFund, setIsFund] = useState(category?.isFund ?? false);
  const vatN = vat.trim() === "" ? null : /^\d{1,2}$/.test(vat.trim()) ? Number(vat) : NaN;
  const vatValid = vatN === null || (Number.isInteger(vatN) && vatN >= 0 && vatN <= 21);
  const valid = name.trim().length > 0 && name.trim().length <= 60 && vatValid;
  const save = useMutation({
    mutationFn: () =>
      category
        // Si no se toca, el fondo no se manda: cambiarlo en una categoría con apuntes da 409
        ? ledgerService.categories.update(clubId, category.id, {
            name: name.trim(), activity, vatPercent: vatN, ...(isFund !== category.isFund ? { isFund } : {}),
          })
        : ledgerService.categories.create(clubId, { name: name.trim(), kind, activity, vatPercent: vatN, isFund }),
    onSuccess: () => { toast.success("Categoría guardada"); onDone(); onClose(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  return (
    <SchoolDialog title={category ? "Editar categoría" : "Nueva categoría"} onClose={onClose} busy={save.isPending}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
        <Field label="Nombre">
          <Input aria-label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        {!category && (
          <Field label="Tipo">
            <CustomSelect
              options={[{ value: "EXPENSE", label: "Gasto" }, { value: "INCOME", label: "Ingreso" }]}
              value={kind}
              onChange={(v) => setKind(v as LedgerKind)}
            />
          </Field>
        )}
        <Field label="Actividad">
          <CustomSelect
            options={LEDGER_ACTIVITIES.map((a) => ({ value: a, label: ACTIVITY_LABEL[a] }))}
            value={activity}
            onChange={(v) => setActivity(v as LedgerActivity)}
          />
        </Field>
        <Field label="IVA informativo (0-21 %, vacío = sin IVA)" error={vatValid ? undefined : "Un número entero de 0 a 21"}>
          <Input aria-label="IVA" inputMode="numeric" value={vat} onChange={(e) => setVat(e.target.value)} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={isFund}
            onChange={(e) => setIsFund(e.target.checked)}
          />
          <span>
            Es un fondo (no cuenta en el resultado)
            <span className="block text-xs text-muted-foreground">
              Para dinero que se aparta con un fin, como un fondo de pistas. Sus apuntes mueven la caja o el banco, pero
              no son ingreso ni gasto del resultado, y su saldo no se reparte entre los socios.
            </span>
            <span className="block text-xs text-muted-foreground">
              Solo en categorías sin apuntes: si ya tiene apuntes o fijos, no se puede cambiar. Créala nueva para el fondo.
            </span>
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button type="submit" disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}

/** «Avisar de gastos sin justificante desde…»: una fecha, o apagado. */
function ReceiptsSetting({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: accountsConfigQK.config(clubId),
    queryFn: () => accountsConfigService.get(clubId),
  });
  const saved = config.data?.receiptsRequiredFrom ?? null;
  const [on, setOn] = useState(false);
  const [day, setDay] = useState("");
  useEffect(() => {
    if (!config.data) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setOn(saved !== null);
    setDay(saved ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [config.data, saved]);

  const next = on ? day : null;
  const valid = !on || isDayKey(day);
  const save = useMutation({
    mutationFn: () => accountsConfigService.update(clubId, { ...config.data!, receiptsRequiredFrom: next }),
    onSuccess: () => { toast.success("Aviso de justificantes guardado"); qc.invalidateQueries({ queryKey: accountsConfigQK.config(clubId) }); qc.invalidateQueries({ queryKey: ledgerQK.all(clubId) }); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  if (!config.data) return null;
  return (
    <fieldset className="space-y-2 border-t border-border pt-4 text-sm">
      <legend className="font-medium">Avisar de gastos sin justificante</legend>
      <label className="flex items-center gap-2">
        <input type="radio" name="receipts" checked={!on} onChange={() => setOn(false)} /> No avisar
      </label>
      <label className="flex flex-wrap items-center gap-2">
        <input type="radio" name="receipts" checked={on} onChange={() => setOn(true)} />
        Avisar de los gastos sin justificante desde el
        <input
          type="date"
          aria-label="Avisar de gastos sin justificante desde"
          disabled={!on}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-60"
        />
      </label>
      <p className="text-xs text-muted-foreground">Los fijos no necesitan justificante.</p>
      <Button size="sm" onClick={() => save.mutate()} disabled={!valid || next === saved || save.isPending}>
        {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
      </Button>
    </fieldset>
  );
}
