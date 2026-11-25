"use client";

/**
 * «Mover dinero» (Tesorería): un traspaso entre dos sitios del club (caja,
 * banco, lo que guarda un socio, la cuenta de un socio con el club). Los atajos
 * rellenan el origen y el destino de lo que se hace de verdad; «Otro» los deja
 * a mano. Los de un socio dado de baja no se ofrecen.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AmountField } from "@/components/admin/payment-fields";
import { CustomSelect, Field, Input } from "@/components/admin/form";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import {
  invalidateTreasury, treasuryService, type PlaceInput, type TreasurySummary,
} from "@/lib/services/treasury";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import { isDayKey } from "@/lib/utils/ledger";
import { eurosToCents } from "@/lib/utils/payment-methods";
import {
  applyShortcut, NOTE_MAX, parsePlaceKey, placeKey, SHORTCUTS, TREASURY_MAX_CENTS, transferProblem,
  writablePlaces, type ShortcutId,
} from "@/lib/utils/treasury";

export function TreasuryTransferDialog({ clubId, summary, partnerId: forPartnerId, onClose }: {
  clubId:  string;
  summary: TreasurySummary;
  /** Desde la tarjeta de un socio: el socio ya puesto y el atajo de «guardar efectivo». */
  partnerId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const activePartners = summary.partners.filter((p) => p.active);
  const places = writablePlaces(summary.places, new Set(activePartners.map((p) => p.partnerId)));
  const placeOptions = places.map((p) => ({ value: placeKey(p), label: p.label }));

  const startShortcut: ShortcutId = forPartnerId ? "partner_keeps" : "cash_to_bank";
  const [shortcut, setShortcut] = useState<ShortcutId>(startShortcut);
  const [partnerId, setPartnerId] = useState(forPartnerId ?? activePartners[0]?.partnerId ?? "");
  const initial = applyShortcut(startShortcut, forPartnerId ?? "");
  const [fromKey, setFromKey] = useState(initial ? placeKey(initial.from) : "CASH");
  const [toKey, setToKey] = useState(initial ? placeKey(initial.to) : "BANK");
  const [date, setDate] = useState(summary.today);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const choose = (id: ShortcutId, partner: string) => {
    setShortcut(id);
    setPartnerId(partner);
    const applied = applyShortcut(id, partner);
    if (!applied) return;
    setFromKey(placeKey(applied.from));
    setToKey(placeKey(applied.to));
  };
  const current = SHORTCUTS.find((s) => s.id === shortcut);

  const from: PlaceInput = parsePlaceKey(fromKey);
  const to: PlaceInput = parsePlaceKey(toKey);
  const cents = eurosToCents(amount);
  const labelOf = (key: string) => places.find((p) => placeKey(p) === key)?.label ?? "—";
  const problem = transferProblem(from, to);
  const errors = {
    date: isDayKey(date) && date >= summary.startDate && date <= summary.today
      ? undefined : "Elige un día entre el inicio de la tesorería y hoy",
    amount: cents !== null && cents >= 1 && cents <= TREASURY_MAX_CENTS
      ? undefined : "Escribe un importe válido (por ejemplo 120,00)",
    places: problem ?? undefined,
  };
  const invalid = Object.values(errors).some(Boolean);
  // Lo que guarda el socio, para no pedirle de vuelta más de lo que tiene
  const held = from.place === "PARTNER_HELD"
    ? summary.places.find((p) => placeKey(p) === fromKey)?.balanceCents ?? null
    : null;

  const save = useMutation({
    mutationFn: () =>
      treasuryService.transfers.create(clubId, {
        date,
        amountCents: cents as number,
        from,
        to,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      invalidateTreasury(qc, clubId);
      toast.success("Traspaso apuntado");
      onClose();
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  return (
    <SchoolDialog title="Mover dinero" onClose={onClose} busy={save.isPending} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!invalid) save.mutate();
        }}
      >
        <div role="group" aria-label="¿Qué ha pasado?">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">¿Qué ha pasado?</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SHORTCUTS.map((s) => {
              const blocked = s.needsPartner && activePartners.length === 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={shortcut === s.id}
                  disabled={blocked}
                  onClick={() => choose(s.id, partnerId || activePartners[0]?.partnerId || "")}
                  className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 ${
                    shortcut === s.id
                      ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {current && <p className="mt-1.5 text-xs text-muted-foreground">{current.hint}</p>}
          {activePartners.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Para mover dinero de un socio, da de alta uno en Ajustes → Socios del club.</p>
          )}
        </div>

        {current?.needsPartner && activePartners.length > 0 && (
          <Field label="Socio">
            <CustomSelect
              options={activePartners.map((p) => ({ value: p.partnerId, label: p.name }))}
              value={partnerId}
              onChange={(v) => choose(shortcut, v)}
            />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="De dónde sale">
            <CustomSelect options={placeOptions} value={fromKey} onChange={setFromKey} />
          </Field>
          <Field label="Adónde va">
            <CustomSelect options={placeOptions} value={toKey} onChange={setToKey} />
          </Field>
        </div>
        {touched && errors.places && <p className="text-xs text-destructive">{errors.places}</p>}
        {held !== null && (
          <p className="text-xs text-muted-foreground">Ese socio guarda ahora {formatCents(held)}: no puede devolver más de lo que guarda.</p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AmountField label="Importe" value={amount} onChange={setAmount} invalid={touched && !!errors.amount} />
          <Field label="Fecha" error={touched ? errors.date : undefined}>
            <Input
              type="date"
              aria-label="Fecha"
              min={summary.startDate}
              max={summary.today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Nota (opcional)">
          <Input aria-label="Nota del traspaso" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {cents !== null && cents >= 1 && !problem && (
          <p role="status" className="rounded-md bg-secondary px-3 py-2 text-sm">
            Pasan <strong>{formatCents(cents)}</strong> de {labelOf(fromKey)} a {labelOf(toKey)}.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Apuntar traspaso
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
