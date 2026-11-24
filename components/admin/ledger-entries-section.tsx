"use client";

/**
 * «Cuentas» → «Gastos e ingresos» (F8-C1): lo que no nace en el panel, por mes,
 * con los totales del filtro, sus justificantes (se ven con una URL firmada que
 * caduca a los 5 minutos) y los gastos pendientes de pagar. Los fijos van
 * debajo. Solo propietario y gestor.
 */

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, Loader2, Paperclip, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { CustomSelect, Field } from "@/components/admin/form";
import { LedgerEntryDialog } from "@/components/admin/ledger-entry-dialog";
import { LedgerRecurringSection } from "@/components/admin/ledger-recurring-section";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { accountsService } from "@/lib/services/accounts";
import { cashQK } from "@/lib/services/cash";
import {
  ledgerQK, ledgerService,
  type LedgerEntriesFilter, type LedgerEntry, type LedgerKind, type LedgerPayment,
} from "@/lib/services/ledger";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { formatCents } from "@/lib/utils/booking-price";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { PAYMENT_LABEL, RECEIPT_MAX_BYTES, isReceiptFile, monthRange, paymentOptions, prepareReceipt } from "@/lib/utils/ledger";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/utils/school-billing";
import { formatDayKey, zonedDayKey } from "@/lib/utils/time-zone";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

export function LedgerEntriesSection({ clubId }: { clubId: string }) {
  const { timeZone, isError, refetch } = useClubTimeZone(clubId);
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!timeZone) return <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />;
  return <Entries clubId={clubId} timeZone={timeZone} />;
}

function Entries({ clubId, timeZone }: { clubId: string; timeZone: string }) {
  const qc = useQueryClient();
  const today = zonedDayKey(new Date(), timeZone);
  const [month, setMonth] = useState(() => currentMonth(new Date(), timeZone));
  const [kind, setKind] = useState<LedgerKind | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [missingReceipt, setMissingReceipt] = useState(false);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ kind: LedgerKind; entry: LedgerEntry | null } | null>(null);
  const [paying, setPaying] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null);
  const [addingTo, setAddingTo] = useState<LedgerEntry | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const categories = useQuery({
    queryKey: ledgerQK.categories(clubId),
    queryFn: () => ledgerService.categories.list(clubId),
  });
  const filter: LedgerEntriesFilter = {
    ...monthRange(month),
    kind: kind || undefined,
    categoryId: categoryId || undefined,
    missingReceipt: missingReceipt || undefined,
    page,
  };
  const entries = useQuery({
    queryKey: ledgerQK.entries(clubId, filter),
    queryFn: () => ledgerService.entries.list(clubId, filter),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ledgerQK.all(clubId) });
    qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
  };
  const remove = useMutation({
    mutationFn: (e: LedgerEntry) => ledgerService.entries.remove(clubId, e.id),
    onSuccess: () => { setDeleting(null); toast.success("Apunte borrado"); refresh(); },
    onError: (err: unknown) => { setDeleting(null); toast.error(accountsErrorText(err)); },
  });
  const upload = useMutation({
    mutationFn: async ({ entry, file }: { entry: LedgerEntry; file: File }) => {
      const prepared = await prepareReceipt(file);
      return ledgerService.attachments.upload(clubId, entry.id, prepared.blob, prepared.name);
    },
    onSuccess: () => { toast.success("Justificante subido"); refresh(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  // La URL firmada solo vale 5 minutos: se pide al pulsar y se abre en otra pestaña
  const view = useMutation({
    mutationFn: (attId: string) => ledgerService.attachments.url(clubId, attId),
    onSuccess: ({ url }) => { window.open(url, "_blank", "noopener,noreferrer"); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const removeAttachment = useMutation({
    mutationFn: (attId: string) => ledgerService.attachments.remove(clubId, attId),
    onSuccess: () => { toast.success("Justificante borrado"); refresh(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  const pickFile = (list: FileList | null) => {
    const file = list?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file || !addingTo) return;
    if (!isReceiptFile(file)) return toast.error("Solo se admiten fotos (JPEG, PNG o WEBP) o PDF.");
    if (file.type === "application/pdf" && file.size > RECEIPT_MAX_BYTES) return toast.error("El PDF pesa más de 10 MB.");
    upload.mutate({ entry: addingTo, file });
    setAddingTo(null);
  };

  const list = entries.data?.items ?? [];
  const totals = entries.data?.totals;
  const pages = entries.data ? Math.max(1, Math.ceil(entries.data.total / entries.data.pageSize)) : 1;
  const catOptions = [
    { value: "", label: "Todas las categorías" },
    ...(categories.data ?? []).filter((c) => !kind || c.kind === kind).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <section aria-label="Gastos e ingresos" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="Mes">
          <Button variant="outline" size="icon-sm" onClick={() => { setMonth(shiftMonth(month, -1)); setPage(1); }} aria-label="Mes anterior">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel(month)}</span>
          <Button variant="outline" size="icon-sm" onClick={() => { setMonth(shiftMonth(month, 1)); setPage(1); }} aria-label="Mes siguiente">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setDialog({ kind: "EXPENSE", entry: null })} disabled={!categories.data}>
            <Plus className="h-3.5 w-3.5" /> Nuevo gasto
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "INCOME", entry: null })} disabled={!categories.data}>
            <Plus className="h-3.5 w-3.5" /> Nuevo ingreso
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-xs text-muted-foreground">
        <label className="block">
          Tipo
          <select
            aria-label="Tipo"
            value={kind}
            onChange={(e) => { setKind(e.target.value as LedgerKind | ""); setCategoryId(""); setPage(1); }}
            className="mt-1 block rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="">Gastos e ingresos</option>
            <option value="EXPENSE">Gastos</option>
            <option value="INCOME">Ingresos</option>
          </select>
        </label>
        <div className="w-56">
          <Field label="Categoría">
            <CustomSelect compact options={catOptions} value={categoryId} onChange={(v) => { setCategoryId(v); setPage(1); }} />
          </Field>
        </div>
        <label className="flex items-center gap-2 pb-1 text-sm text-foreground">
          <input type="checkbox" checked={missingReceipt} onChange={(e) => { setMissingReceipt(e.target.checked); setPage(1); }} />
          Sin justificante
        </label>
      </div>

      {totals && (
        <dl className="grid grid-cols-3 gap-2 text-sm" aria-label="Totales">
          <div className="rounded-lg border border-border p-2">
            <dt className="text-xs text-muted-foreground">Ingresos</dt>
            <dd className="font-medium text-green-600 dark:text-green-400">{formatCents(totals.incomeCents)}</dd>
          </div>
          <div className="rounded-lg border border-border p-2">
            <dt className="text-xs text-muted-foreground">Gastos</dt>
            <dd className="font-medium">
              {formatCents(totals.expenseCents)}
              {totals.pendingCents > 0 && (
                <span className="block text-xs font-normal text-amber-600 dark:text-amber-400">
                  {formatCents(totals.pendingCents)} sin pagar
                </span>
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-border p-2">
            <dt className="text-xs text-muted-foreground">Diferencia</dt>
            <dd className="font-medium">{formatCents(totals.incomeCents - totals.expenseCents)}</dd>
          </div>
        </dl>
      )}

      {entries.isError ? (
        <ErrorState title="No se pudieron cargar los apuntes" onRetry={() => entries.refetch()} />
      ) : entries.isPending ? (
        <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          No hay apuntes en {monthLabel(month).toLowerCase()} con estos filtros.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{e.concept}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDayKey(e.date, DAY)} · {e.categoryName} · {PAYMENT_LABEL[e.payment]}
                    {e.partnerName ? ` (${e.partnerName})` : ""}
                    {e.imputedMonth ? ` · cuenta en ${monthLabel(e.imputedMonth).toLowerCase()}` : ""}
                    {e.recurringId ? " · fijo" : ""}
                    {e.coachName ? ` · pago a ${e.coachName}` : ""}
                  </p>
                  {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {e.payment === "PENDING" && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">Sin pagar</span>
                    )}
                    {e.needsReceipt && (
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">Falta el justificante</span>
                    )}
                    {e.noReceipt && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">No hay ticket</span>}
                    {e.receiptsRetired && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Justificante retirado por antigüedad</span>
                    )}
                    {e.attachments.map((a) => (
                      <span key={a.id} className="inline-flex items-center overflow-hidden rounded-full border border-border text-xs">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-0.5 hover:bg-secondary"
                          aria-label={`Ver justificante ${a.fileName}`}
                          onClick={() => view.mutate(a.id)}
                        >
                          <FileText className="h-3 w-3" /> {a.fileName}
                        </button>
                        <button
                          type="button"
                          className="border-l border-border px-1.5 py-0.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                          aria-label={`Borrar justificante ${a.fileName}`}
                          onClick={() => removeAttachment.mutate(a.id)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${e.kind === "INCOME" ? "text-green-600 dark:text-green-400" : ""}`}>
                    {e.kind === "INCOME" ? "+" : "−"}{formatCents(e.amountCents)}
                  </p>
                  <div className="mt-1 flex flex-wrap justify-end gap-1">
                    {e.payment === "PENDING" && (
                      <Button size="xs" variant="outline" onClick={() => setPaying(e)}>
                        <Wallet className="h-3 w-3" /> Pagar
                      </Button>
                    )}
                    <Button size="xs" variant="outline" aria-label={`Añadir justificante a ${e.concept}`} onClick={() => { setAddingTo(e); fileInput.current?.click(); }}>
                      <Paperclip className="h-3 w-3" /> Justificante
                    </Button>
                    <Button size="icon-xs" variant="outline" aria-label={`Editar ${e.concept}`} onClick={() => setDialog({ kind: e.kind, entry: e })}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon-xs" variant="outline" aria-label={`Borrar ${e.concept}`} onClick={() => setDeleting(e)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        aria-label="Elegir justificante"
        className="hidden"
        onChange={(e) => pickFile(e.target.files)}
      />
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span>Página {page} de {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      )}

      <LedgerRecurringSection clubId={clubId} categories={categories.data ?? []} today={today} />

      {dialog && categories.data && (
        <LedgerEntryDialog
          clubId={clubId}
          kind={dialog.kind}
          entry={dialog.entry}
          categories={categories.data}
          today={today}
          onClose={() => setDialog(null)}
        />
      )}
      {paying && <PayEntryDialog clubId={clubId} entry={paying} today={today} onClose={() => setPaying(null)} onDone={refresh} />}
      <ConfirmModal
        open={!!deleting}
        title="¿Borrar este apunte?"
        description={
          deleting?.coachStaffId
            ? "Es un pago a un entrenador: borrarlo lo deshace y vuelve a deberse esa cantidad. Desaparece de listas, caja e informes."
            : "Desaparece de las listas, de la caja y de los informes. El historial lo recuerda."
        }
        confirmLabel="Borrar"
        danger
        loading={remove.isPending}
        onClose={() => { if (!remove.isPending) setDeleting(null); }}
        onConfirm={() => { if (deleting) remove.mutate(deleting); }}
      />
    </section>
  );
}

function PayEntryDialog({
  clubId, entry, today, onClose, onDone,
}: { clubId: string; entry: LedgerEntry; today: string; onClose: () => void; onDone: () => void }) {
  const [payment, setPayment] = useState<LedgerPayment>("BANK");
  const [partnerId, setPartnerId] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const partners = useQuery({
    queryKey: ["club-accounts", clubId, "partners"],
    queryFn: () => accountsService.partners.list(clubId),
  });
  const pay = useMutation({
    mutationFn: () =>
      ledgerService.entries.pay(clubId, entry.id, { payment, partnerId: payment === "PARTNER" ? partnerId : null, paidOn }),
    onSuccess: () => { toast.success("Gasto pagado"); onDone(); onClose(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const ready = !!paidOn && (payment !== "PARTNER" || !!partnerId);
  return (
    <SchoolDialog title={`Pagar: ${entry.concept}`} onClose={onClose} busy={pay.isPending}>
      <p className="text-sm text-muted-foreground">{formatCents(entry.amountCents)} · {entry.categoryName}</p>
      <div role="group" aria-label="Cómo se pagó" className="flex flex-wrap gap-2">
        {paymentOptions("EXPENSE", { allowPending: false }).filter((o) => o.value !== "UNKNOWN").map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={payment === o.value}
            onClick={() => setPayment(o.value)}
            className={`min-h-9 rounded-md border px-3 text-sm ${
              payment === o.value
                ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {payment === "PARTNER" && (
        <CustomSelect
          options={[{ value: "", label: "Elige un socio" }, ...(partners.data ?? []).filter((p) => p.active).map((p) => ({ value: p.id, label: p.name }))]}
          value={partnerId}
          onChange={setPartnerId}
        />
      )}
      <label className="block text-xs text-muted-foreground">
        Día del pago
        <input
          type="date"
          aria-label="Día del pago"
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
          className="mt-1 block rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={pay.isPending}>Cancelar</Button>
        <Button onClick={() => pay.mutate()} disabled={!ready || pay.isPending}>
          {pay.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Marcar como pagado
        </Button>
      </div>
    </SchoolDialog>
  );
}
