"use client";

/**
 * «Nuevo gasto» / «Nuevo ingreso» (y editarlos): lo que NO nace en el panel. Lo
 * que cobra el panel (reservas, cuotas, bonos, tienda, deudas) ya cuenta solo y
 * las compras de «Tienda → Compra de cajas» también: no se repiten aquí. Las
 * fotos de los justificantes se reducen en el navegador antes de subirlas.
 */

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { AmountField } from "@/components/admin/payment-fields";
import { CustomSelect, Field, Input } from "@/components/admin/form";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { accountsService } from "@/lib/services/accounts";
import { cashQK } from "@/lib/services/cash";
import {
  ledgerQK, ledgerService,
  type LedgerCategory, type LedgerEntry, type LedgerKind, type LedgerPayment,
} from "@/lib/services/ledger";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import {
  COACHES_CATEGORY_KEY, PAYMENT_LABEL, RECEIPT_MAX_BYTES, RECEIPT_MAX_PER_ENTRY, isDayKey, isReceiptFile, ledgerRetentionMinDay, paymentOptions, prepareReceipt,
} from "@/lib/utils/ledger";
import { centsToEurosInput, eurosToCents } from "@/lib/utils/payment-methods";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const SHOP_CATEGORY_KEY = "SHOP_PURCHASES";

export function LedgerEntryDialog({
  clubId, kind, entry, categories, today, onClose,
}: {
  clubId:     string;
  kind:       LedgerKind;
  /** Con apunte, se edita. */
  entry:      LedgerEntry | null;
  categories: LedgerCategory[];
  /** Hoy en el calendario del club («AAAA-MM-DD»). */
  today:      string;
  onClose:    () => void;
}) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const options = categories.filter(
    (c) => c.kind === kind && (c.active || c.id === entry?.categoryId)
      && (c.systemKey !== COACHES_CATEGORY_KEY || c.id === entry?.categoryId),
  );
  const minDay = ledgerRetentionMinDay(today);

  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? options[0]?.id ?? "");
  const [date, setDate] = useState(entry?.date ?? today);
  const [amount, setAmount] = useState(entry ? centsToEurosInput(entry.amountCents) : "");
  const [concept, setConcept] = useState(entry?.concept ?? "");
  const [payment, setPayment] = useState<LedgerPayment>(entry?.payment ?? "CASH");
  const [partnerId, setPartnerId] = useState(entry?.partnerId ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [otherMonth, setOtherMonth] = useState(!!entry?.imputedMonth);
  const [imputedMonth, setImputedMonth] = useState(entry?.imputedMonth ?? today.slice(0, 7));
  const [noReceipt, setNoReceipt] = useState(entry?.noReceipt ?? false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const partners = useQuery({
    queryKey: ["club-accounts", clubId, "partners"],
    queryFn: () => accountsService.partners.list(clubId),
  });
  const activePartners = (partners.data ?? []).filter((p) => p.active || p.id === entry?.partnerId);

  const category = categories.find((c) => c.id === categoryId);
  const cents = eurosToCents(amount);
  const errors = {
    category: category ? undefined : "Elige una categoría",
    date: isDayKey(date) ? undefined : "Elige un día válido",
    amount: cents !== null && cents >= 1 ? undefined : "Escribe un importe válido (por ejemplo 12,50)",
    concept: concept.trim() ? undefined : "Escribe el concepto",
    partner: payment === "PARTNER" && !partnerId ? "Elige el socio" : undefined,
    month: otherMonth && !MONTH_RE.test(imputedMonth) ? "Elige un mes válido" : undefined,
  };
  const invalid = Object.values(errors).some(Boolean);
  const attached = (entry?.attachments.length ?? 0) + files.length;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: File[] = [];
    let problem: string | null = null;
    for (const f of Array.from(list)) {
      if (!isReceiptFile(f)) problem = `«${f.name}» no vale: solo fotos (JPEG, PNG o WEBP) o PDF.`;
      else if (f.type === "application/pdf" && f.size > RECEIPT_MAX_BYTES) problem = `«${f.name}» pesa más de 10 MB.`;
      else if (attached + next.length >= RECEIPT_MAX_PER_ENTRY) problem = "Un apunte admite como mucho 10 justificantes.";
      else next.push(f);
    }
    setFileError(problem);
    setFiles((prev) => [...prev, ...next]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        categoryId,
        date,
        imputedMonth: otherMonth ? imputedMonth : null,
        amountCents: cents as number,
        payment,
        partnerId: payment === "PARTNER" ? partnerId : null,
        concept: concept.trim(),
        note: note.trim() || null,
        noReceipt,
      };
      const saved = entry
        ? await ledgerService.entries.update(clubId, entry.id, body)
        : await ledgerService.entries.create(clubId, body);
      // El apunte ya está guardado: un justificante que falla se dice aparte
      const failed: string[] = [];
      for (const f of files) {
        try {
          const prepared = await prepareReceipt(f);
          await ledgerService.attachments.upload(clubId, saved.id, prepared.blob, prepared.name);
        } catch (err) {
          failed.push(`${f.name}: ${accountsErrorText(err)}`);
        }
      }
      return failed;
    },
    onSuccess: (failed) => {
      qc.invalidateQueries({ queryKey: ledgerQK.all(clubId) });
      // Un apunte en efectivo mueve la caja
      qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
      toast.success(entry ? "Apunte guardado" : kind === "EXPENSE" ? "Gasto apuntado" : "Ingreso apuntado");
      if (failed.length > 0)
        toast.error(`El apunte está guardado, pero no se han subido estos justificantes: ${failed.join(" · ")}`);
      onClose();
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  const title = `${entry ? "Editar" : "Nuevo"} ${kind === "EXPENSE" ? "gasto" : "ingreso"}`;
  return (
    <SchoolDialog title={title} onClose={onClose} busy={save.isPending}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!invalid) save.mutate();
        }}
      >
        <p className="text-xs text-muted-foreground">
          {kind === "INCOME"
            ? "Lo que se cobra en el panel ya cuenta solo: apunta aquí solo lo que no pasa por él."
            : "Apunta aquí lo que no pasa por el panel."}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" error={touched ? errors.date : undefined}>
            <Input type="date" aria-label="Fecha" min={minDay} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <AmountField label="Importe" value={amount} onChange={setAmount} invalid={touched && !!errors.amount} />
        </div>
        <Field label="Categoría" error={touched ? errors.category : undefined}>
          <CustomSelect
            options={options.map((c) => ({ value: c.id, label: c.active ? c.name : `${c.name} (desactivada)` }))}
            value={categoryId}
            onChange={setCategoryId}
          />
        </Field>
        {category?.systemKey === SHOP_CATEGORY_KEY && (
          <p role="note" className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
            Las compras de Tienda → Compra de cajas ya cuentan: no las repitas aquí.
          </p>
        )}
        <Field label="Concepto" error={touched ? errors.concept : undefined}>
          <Input aria-label="Concepto" value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={120} />
        </Field>

        <div role="group" aria-label="Forma de pago">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {kind === "EXPENSE" ? "Cómo se pagó" : "Cómo se cobró"}
          </span>
          <div className="flex flex-wrap gap-2">
            {paymentOptions(kind, { allowPending: !entry?.coachStaffId }).map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={payment === o.value}
                onClick={() => setPayment(o.value)}
                className={`min-h-9 rounded-md border px-3 text-sm transition-colors ${
                  payment === o.value
                    ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {payment === "CASH" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Entra en la caja de ese día: {kind === "EXPENSE" ? "baja" : "sube"} el efectivo que debe haber.
            </p>
          )}
        </div>
        {payment === "PARTNER" && (
          <Field label={kind === "EXPENSE" ? "¿Qué socio lo pagó?" : "¿Qué socio lo cobró?"} error={touched ? errors.partner : undefined}>
            <CustomSelect
              options={[{ value: "", label: "Elige un socio" }, ...activePartners.map((p) => ({ value: p.id, label: p.name }))]}
              value={partnerId}
              onChange={setPartnerId}
            />
            {!partners.isLoading && activePartners.length === 0 && (
              <p className="text-xs text-muted-foreground">No hay socios: da de alta uno en Ajustes → Socios del club.</p>
            )}
          </Field>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={otherMonth} onChange={(e) => setOtherMonth(e.target.checked)} />
          Cuenta en otro mes
        </label>
        {otherMonth && (
          <Field label="Mes al que cuenta" error={touched ? errors.month : undefined}>
            <Input type="month" aria-label="Mes al que cuenta" min={minDay.slice(0, 7)} value={imputedMonth} onChange={(e) => setImputedMonth(e.target.value)} />
          </Field>
        )}
        <Field label="Nota">
          <Input aria-label="Nota" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>

        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Justificantes</span>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
              >
                Quitar
              </button>
            </div>
          ))}
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-label="Añadir justificantes"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <Paperclip className="h-3.5 w-3.5" /> Añadir foto o PDF
          </Button>
          {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          {kind === "EXPENSE" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={noReceipt} onChange={(e) => setNoReceipt(e.target.checked)} />
              No hay ticket
            </label>
          )}
        </div>

        {payment !== "PENDING" || kind === "INCOME" ? null : (
          <p className="text-xs text-muted-foreground">Quedará pendiente: la forma de pago se pone al pagarlo ({PAYMENT_LABEL.CASH}, banco...).</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
