"use client";

/**
 * «Saldar a …» (Tesorería): un socio dado de baja que aún guarda dinero del
 * club, tiene dinero suyo o al que el club le debe. Se salda de una cosa cada
 * vez y con un traspaso: el efectivo que guarda vuelve a la caja o al banco, lo
 * que tiene del club pasa al banco o a la caja y, si el club le debe, se le
 * paga desde la caja o el banco. El back solo deja acercar el saldo a 0, sin
 * pasarse; aquí se avisa antes de mandarlo.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AmountField } from "@/components/admin/payment-fields";
import { Field, Input } from "@/components/admin/form";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import {
  invalidateTreasury, treasuryService, type PartnerTreasury, type PlaceInput, type TreasurySummary,
} from "@/lib/services/treasury";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import { isDayKey } from "@/lib/utils/ledger";
import { centsToEurosInput, eurosToCents } from "@/lib/utils/payment-methods";
import {
  defaultSettleSide, NOTE_MAX, pendingSettlements, placeKey, settleAmountProblem, settleStartCents, settleTransfer,
  type SettleItem, type SettleKind, type SettleSide,
} from "@/lib/utils/treasury";

const SIDES: readonly { side: SettleSide; label: string }[] = [
  { side: "CASH", label: "Caja" },
  { side: "BANK", label: "Banco" },
];

const CHOICE_ON = "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]";
const CHOICE_OFF = "border-border bg-secondary text-muted-foreground hover:text-foreground";

export function TreasurySettleDialog({ clubId, summary, partnerId, onClose }: {
  clubId:    string;
  summary:   TreasurySummary;
  partnerId: string;
  onClose:   () => void;
}) {
  const partner = summary.partners.find((p) => p.partnerId === partnerId);
  const items = partner ? pendingSettlements(partner) : [];
  if (!partner || items.length === 0) {
    // Se saldó mientras estaba abierto (o desde otra pantalla): no hay nada que apuntar
    return (
      <SchoolDialog title={partner ? `Saldar a ${partner.name}` : "Saldar"} onClose={onClose}>
        <p className="text-sm text-muted-foreground">No queda nada pendiente de saldar.</p>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </SchoolDialog>
    );
  }
  return <SettleForm clubId={clubId} summary={summary} partner={partner} items={items} onClose={onClose} />;
}

function SettleForm({ clubId, summary, partner, items, onClose }: {
  clubId:  string;
  summary: TreasurySummary;
  partner: PartnerTreasury;
  items:   SettleItem[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<SettleKind>(items[0].kind);
  const item = items.find((i) => i.kind === kind) ?? items[0];
  const [side, setSide] = useState<SettleSide>(defaultSettleSide(item.kind));
  const [amount, setAmount] = useState(centsToEurosInput(settleStartCents(item.cents)));
  const [date, setDate] = useState(summary.today);
  const [note, setNote] = useState("");

  // Otra cosa pendiente: su importe y su lado de siempre
  const choose = (next: SettleItem) => {
    setKind(next.kind);
    setSide(defaultSettleSide(next.kind));
    setAmount(centsToEurosInput(settleStartCents(next.cents)));
  };

  const cents = eurosToCents(amount);
  const { from, to } = settleTransfer(item, partner.partnerId, side);
  const labelOf = (ref: PlaceInput) => summary.places.find((p) => placeKey(p) === placeKey(ref))?.label ?? "—";
  const errors = {
    amount: settleAmountProblem(cents, item.cents) ?? undefined,
    date: isDayKey(date) && date >= summary.startDate && date <= summary.today
      ? undefined : "Elige un día entre el inicio de la tesorería y hoy",
  };
  const invalid = Object.values(errors).some(Boolean);
  const rest = cents !== null && !errors.amount ? item.cents - cents : null;
  const sideTitle = item.kind === "owed" ? "De dónde sale" : "Adónde va";

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
    <SchoolDialog title={`Saldar a ${partner.name}`} onClose={onClose} busy={save.isPending}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) save.mutate();
        }}
      >
        <p className="text-sm text-muted-foreground">
          {partner.name} está de baja. Para dejarlo a cero, apunta lo que queda pendiente.
        </p>

        {items.length > 1 ? (
          <div role="group" aria-label="¿Qué se salda?">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">¿Qué se salda?</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map((i) => (
                <button
                  key={i.kind}
                  type="button"
                  aria-pressed={item.kind === i.kind}
                  disabled={save.isPending}
                  onClick={() => choose(i)}
                  className={`min-h-11 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 ${item.kind === i.kind ? CHOICE_ON : CHOICE_OFF}`}
                >
                  {i.text}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Se salda de una en una: apunta un traspaso por cada cosa pendiente.</p>
          </div>
        ) : (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm font-medium">{item.text}</p>
        )}
        <p className="text-xs text-muted-foreground">{item.hint}</p>

        <div role="group" aria-label={sideTitle}>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sideTitle}</span>
          <div className="grid grid-cols-2 gap-2">
            {SIDES.map((s) => (
              <button
                key={s.side}
                type="button"
                aria-pressed={side === s.side}
                disabled={save.isPending}
                onClick={() => setSide(s.side)}
                className={`min-h-11 rounded-md border text-sm font-medium transition-colors disabled:opacity-40 ${side === s.side ? CHOICE_ON : CHOICE_OFF}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AmountField label="Importe" value={amount} onChange={setAmount} invalid={!!errors.amount} error={errors.amount} />
          <Field label="Fecha" error={errors.date}>
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

        {cents !== null && rest !== null && (
          <p role="status" className="rounded-md bg-secondary px-3 py-2 text-sm">
            Pasan <strong>{formatCents(cents)}</strong> de {labelOf(from)} a {labelOf(to)}.{" "}
            {rest === 0 ? `Con esto, ${partner.name} queda saldado.` : `Quedarán ${formatCents(rest)} por saldar.`}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Si no se va a saldar con dinero, cuadra ese lugar a 0 con «Cuadrar» y deja una nota que lo explique.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button type="submit" disabled={save.isPending || invalid}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Saldar
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
