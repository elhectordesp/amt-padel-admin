"use client";

/**
 * «Gastos e ingresos fijos» (F8-C1): el alquiler, una cuota de patrocinio... Un
 * cron los apunta solos el día que toca de cada mes (solo el mes en curso: al
 * reactivar uno no se rellenan los meses de pausa). Editar vale para lo que se
 * apunte a partir de entonces. Un fijo que ya apuntó algo no se borra: se pausa.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { AmountField } from "@/components/admin/payment-fields";
import { CustomSelect, Field, Input } from "@/components/admin/form";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { accountsService } from "@/lib/services/accounts";
import {
  ledgerQK, ledgerService,
  type LedgerCategory, type LedgerPayment, type LedgerRecurring,
} from "@/lib/services/ledger";
import { formatCents } from "@/lib/utils/booking-price";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { COACHES_CATEGORY_KEY, PAYMENT_LABEL, paymentOptions } from "@/lib/utils/ledger";
import { centsToEurosInput, eurosToCents } from "@/lib/utils/payment-methods";
import { monthLabel } from "@/lib/utils/school-billing";

export function LedgerRecurringSection({
  clubId, categories, today,
}: { clubId: string; categories: LedgerCategory[]; today: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LedgerRecurring | "new" | null>(null);
  const [deleting, setDeleting] = useState<LedgerRecurring | null>(null);
  const list = useQuery({
    queryKey: ledgerQK.recurring(clubId),
    queryFn: () => ledgerService.recurring.list(clubId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ledgerQK.all(clubId) });
  const toggle = useMutation({
    mutationFn: (r: LedgerRecurring) => ledgerService.recurring.update(clubId, r.id, { active: !r.active }),
    onSuccess: (r) => { toast.success(r.active ? "Fijo activado" : "Fijo en pausa"); refresh(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const remove = useMutation({
    mutationFn: (r: LedgerRecurring) => ledgerService.recurring.remove(clubId, r.id),
    onSuccess: () => { setDeleting(null); toast.success("Fijo borrado"); refresh(); },
    onError: (err: unknown) => {
      setDeleting(null);
      toast.error(
        (err as { code?: string }).code === "ACCOUNTS_IN_USE"
          ? "Este fijo ya ha apuntado cosas: no se borra, ponlo en pausa."
          : accountsErrorText(err),
      );
    },
  });

  return (
    <section aria-label="Gastos e ingresos fijos" className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-medium">Gastos e ingresos fijos</h3>
          <p className="text-xs text-muted-foreground">Se apuntan solos el día que toca de cada mes.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")} disabled={categories.length === 0}>
          <Plus className="h-3.5 w-3.5" /> Nuevo fijo
        </Button>
      </div>
      {list.isPending ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : list.isError ? (
        <p className="text-sm text-destructive">No se pudieron cargar los fijos</p>
      ) : list.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ninguno.</p>
      ) : (
        <ul className="space-y-2">
          {list.data.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm ${r.active ? "" : "opacity-60"}`}>
              <div className="min-w-0">
                <p className="font-medium">
                  {r.concept} <span className="font-normal text-muted-foreground">· {formatCents(r.amountCents)}</span>
                  {!r.active && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">En pausa</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.categoryName} · el día {r.dayOfMonth} · {PAYMENT_LABEL[r.payment]}
                  {r.partnerName ? ` (${r.partnerName})` : ""} · desde {monthLabel(r.startMonth).toLowerCase()}
                  {r.lastMonth ? ` · último apunte: ${monthLabel(r.lastMonth).toLowerCase()}` : " · sin apuntes todavía"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="xs" variant="outline" onClick={() => toggle.mutate(r)} disabled={toggle.isPending}>
                  {r.active ? <><Pause className="h-3 w-3" /> Pausar</> : <><Play className="h-3 w-3" /> Activar</>}
                </Button>
                <Button size="icon-xs" variant="outline" aria-label={`Editar ${r.concept}`} onClick={() => setEditing(r)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon-xs" variant="outline" aria-label={`Borrar ${r.concept}`} onClick={() => setDeleting(r)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <RecurringDialog
          clubId={clubId}
          categories={categories}
          today={today}
          recurring={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={refresh}
        />
      )}
      <ConfirmModal
        open={!!deleting}
        title="¿Borrar este fijo?"
        description="Dejará de apuntarse. Si ya apuntó algo, no se podrá borrar: tendrás que ponerlo en pausa."
        confirmLabel="Borrar"
        danger
        loading={remove.isPending}
        onClose={() => { if (!remove.isPending) setDeleting(null); }}
        onConfirm={() => { if (deleting) remove.mutate(deleting); }}
      />
    </section>
  );
}

function RecurringDialog({
  clubId, categories, today, recurring, onClose, onDone,
}: {
  clubId: string;
  categories: LedgerCategory[];
  today: string;
  recurring: LedgerRecurring | null;
  onClose: () => void;
  onDone: () => void;
}) {
  // Los pagos a entrenadores se apuntan desde Entrenadores: un fijo en su categoría contaría el gasto dos veces
  const options = categories.filter(
    (c) => (c.active && c.systemKey !== COACHES_CATEGORY_KEY) || c.id === recurring?.categoryId,
  );
  const [categoryId, setCategoryId] = useState(recurring?.categoryId ?? options[0]?.id ?? "");
  const [concept, setConcept] = useState(recurring?.concept ?? "");
  const [amount, setAmount] = useState(recurring ? centsToEurosInput(recurring.amountCents) : "");
  const [day, setDay] = useState(String(recurring?.dayOfMonth ?? 1));
  const [payment, setPayment] = useState<LedgerPayment>(recurring?.payment ?? "BANK");
  const [partnerId, setPartnerId] = useState(recurring?.partnerId ?? "");
  const [startMonth, setStartMonth] = useState(recurring?.startMonth ?? today.slice(0, 7));
  const [touched, setTouched] = useState(false);
  const partners = useQuery({
    queryKey: ["club-accounts", clubId, "partners"],
    queryFn: () => accountsService.partners.list(clubId),
  });
  const kind = categories.find((c) => c.id === categoryId)?.kind ?? "EXPENSE";
  const cents = eurosToCents(amount);
  const dayN = /^\d{1,2}$/.test(day) ? Number(day) : null;
  const errors = {
    concept: concept.trim() ? undefined : "Escribe el concepto",
    amount: cents !== null && cents >= 1 ? undefined : "Escribe un importe válido (por ejemplo 12,50)",
    day: dayN !== null && dayN >= 1 && dayN <= 31 ? undefined : "Un día del 1 al 31",
    partner: payment === "PARTNER" && !partnerId ? "Elige el socio" : undefined,
    month: /^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) ? undefined : "Elige un mes válido",
  };
  const invalid = Object.values(errors).some(Boolean) || !categoryId;
  // Un ingreso no puede estar pendiente
  const effectivePayment = kind === "INCOME" && payment === "PENDING" ? "BANK" : payment;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        categoryId,
        concept: concept.trim(),
        amountCents: cents as number,
        dayOfMonth: dayN as number,
        payment: effectivePayment,
        partnerId: effectivePayment === "PARTNER" ? partnerId : null,
        startMonth,
      };
      return recurring
        ? ledgerService.recurring.update(clubId, recurring.id, body)
        : ledgerService.recurring.create(clubId, body);
    },
    onSuccess: () => { toast.success("Fijo guardado"); onDone(); onClose(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  return (
    <SchoolDialog title={recurring ? "Editar fijo" : "Nuevo fijo"} onClose={onClose} busy={save.isPending}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!invalid) save.mutate();
        }}
      >
        <Field label="Categoría">
          <CustomSelect options={options.map((c) => ({ value: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} />
        </Field>
        <Field label="Concepto" error={touched ? errors.concept : undefined}>
          <Input aria-label="Concepto" value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={120} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <AmountField label="Importe" value={amount} onChange={setAmount} invalid={touched && !!errors.amount} />
          <Field label="Día del mes" error={touched ? errors.day : undefined}>
            <Input aria-label="Día del mes" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">El 31 es el último día de cada mes.</p>
        <div role="group" aria-label="Forma de pago" className="flex flex-wrap gap-2">
          {paymentOptions(kind).filter((o) => o.value !== "UNKNOWN" || payment === "UNKNOWN").map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={effectivePayment === o.value}
              onClick={() => setPayment(o.value)}
              className={`min-h-9 rounded-md border px-3 text-sm ${
                effectivePayment === o.value
                  ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {effectivePayment === "PARTNER" && (
          <Field label="Socio" error={touched ? errors.partner : undefined}>
            <CustomSelect
              options={[{ value: "", label: "Elige un socio" }, ...(partners.data ?? []).filter((p) => p.active || p.id === recurring?.partnerId).map((p) => ({ value: p.id, label: p.name }))]}
              value={partnerId}
              onChange={setPartnerId}
            />
          </Field>
        )}
        <Field label="Desde el mes" error={touched ? errors.month : undefined}>
          <Input type="month" aria-label="Desde el mes" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
