"use client";

/**
 * «Cuentas» → «Deudas» (F8, M2): lo que cada persona debe al club, con filtro
 * por estado. Cobrar, deshacer el cobro, largo plazo, nota y «Nueva deuda» son
 * de la caja; «Perdonar» (con doble confirmación y motivo) y «Reabrir», solo de
 * propietario y gestor.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, StickyNote, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { ClubDebtPayAll, ClubDebtPayDialog, DebtPill } from "@/components/admin/club-debt-pay";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { AmountField } from "@/components/admin/payment-fields";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import type { ClubCustomer } from "@/lib/services/club-customers";
import {
  clubDebtsQK, clubDebtsService, invalidateClubDebts,
  type ClubDebt, type DebtPersonGroup, type DebtStatusFilter,
} from "@/lib/services/club-debts";
import { accountsConfigQK, accountsConfigService } from "@/lib/services/accounts-config";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { formatCents } from "@/lib/utils/booking-price";
import { daysText } from "@/lib/utils/accounts-config";
import { DEBT_FILTERS, DEBT_ORIGIN_LABEL, DEBT_STATUS_LABEL } from "@/lib/utils/club-debts";
import { eurosToCents, methodLabel } from "@/lib/utils/payment-methods";
import { formatDayKey, formatInTimeZone, zonedDayKey } from "@/lib/utils/time-zone";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" };
const REASON_MIN = 3;

export function AccountsDebtsSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const { can } = useClubAccess();
  const canCash = can("cash", "write");
  const canAccounts = can("accounts", "write");
  const { timeZone } = useClubTimeZone(clubId);
  const [status, setStatus] = useState<DebtStatusFilter>("OPEN");
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<{ person: string; debt: ClubDebt } | null>(null);
  const [editing, setEditing] = useState<ClubDebt | null>(null);
  const [forgiving, setForgiving] = useState<{ person: string; debt: ClubDebt } | null>(null);
  const [undoing, setUndoing] = useState<{ person: string; debt: ClubDebt } | null>(null);

  const list = useQuery({
    queryKey: clubDebtsQK.list(clubId, status),
    queryFn: () => clubDebtsService.list(clubId, status),
  });
  // El plazo del club, para la píldora «Día n de N»
  const config = useQuery({
    queryKey: accountsConfigQK.config(clubId),
    queryFn: () => accountsConfigService.get(clubId),
  });
  const expiryDays = config.data?.debtExpiryDays ?? null;

  const undo = useMutation({
    mutationFn: (id: string) => clubDebtsService.undoPay(clubId, id),
    onSuccess: () => { setUndoing(null); toast.success("Cobro deshecho: la deuda vuelve a estar abierta"); invalidateClubDebts(qc, clubId); },
    onError: (err: unknown) => { setUndoing(null); toast.error(errorText(err)); },
  });
  const reopen = useMutation({
    mutationFn: (id: string) => clubDebtsService.reopen(clubId, id),
    onSuccess: () => { toast.success("Deuda reabierta"); invalidateClubDebts(qc, clubId); },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const longTerm = useMutation({
    mutationFn: (d: ClubDebt) => clubDebtsService.update(clubId, d.id, { longTerm: !d.longTerm }),
    onSuccess: () => invalidateClubDebts(qc, clubId),
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const people = list.data ?? [];
  const openTotal = people.reduce((sum, p) => sum + p.openCents, 0);

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base text-foreground">Deudas</h3>
          <p className="text-sm text-muted-foreground">
            Lo que cada persona debe al club: partes de reserva dejadas a deber, ventas fiadas y deudas apuntadas a mano.
          </p>
        </div>
        {canCash && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva deuda
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Estado de las deudas" className="flex flex-wrap gap-1 border-b border-border">
        {DEBT_FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={status === f.id}
            onClick={() => setStatus(f.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              status === f.id
                ? "border-[#D4AF37] text-[#D4AF37]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.isError ? (
        <ErrorState title="No se pudieron cargar las deudas" onRetry={() => list.refetch()} />
      ) : !list.data || !timeZone ? (
        <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-muted-foreground" />
      ) : people.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          {status === "OPEN" ? "Nadie debe nada al club." : "No hay deudas en este estado."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {people.length} {people.length === 1 ? "persona" : "personas"}
            {status === "OPEN" && (
              <> · <strong className="text-foreground">Total abierto: {formatCents(openTotal)}</strong></>
            )}
          </p>
          <div className="space-y-3">
            {people.map((p) => (
              <PersonBlock
                key={p.key}
                person={p}
                expiryDays={expiryDays}
                timeZone={timeZone}
                canCash={canCash}
                canAccounts={canAccounts}
                clubId={clubId}
                busy={undo.isPending || reopen.isPending || longTerm.isPending}
                onPay={(debt) => setPaying({ person: p.name, debt })}
                onUndo={(debt) => setUndoing({ person: p.name, debt })}
                onReopen={(d) => reopen.mutate(d.id)}
                onToggleLongTerm={(d) => longTerm.mutate(d)}
                onEdit={setEditing}
                onForgive={(debt) => setForgiving({ person: p.name, debt })}
              />
            ))}
          </div>
        </>
      )}

      {creating && timeZone && (
        <NewDebtDialog clubId={clubId} timeZone={timeZone} onClose={() => setCreating(false)} />
      )}
      {paying && (
        <ClubDebtPayDialog
          clubId={clubId}
          subtitle={`${paying.person} · ${paying.debt.concept}`}
          debtIds={[paying.debt.id]}
          totalCents={paying.debt.amountCents}
          onClose={() => setPaying(null)}
        />
      )}
      <ConfirmModal
        open={undoing !== null}
        title="Deshacer el cobro"
        description={
          undoing
            ? `${undoing.person} · ${undoing.debt.concept} · ${formatCents(undoing.debt.amountCents)}. La deuda vuelve a estar abierta y deja de contar en la caja.`
            : ""
        }
        confirmLabel="Deshacer el cobro"
        danger
        loading={undo.isPending}
        onClose={() => setUndoing(null)}
        onConfirm={() => undoing && undo.mutate(undoing.debt.id)}
      />
      {editing && <EditDebtDialog clubId={clubId} debt={editing} onClose={() => setEditing(null)} />}
      {forgiving && (
        <ForgiveFlow
          clubId={clubId}
          person={forgiving.person}
          debt={forgiving.debt}
          onClose={() => setForgiving(null)}
        />
      )}
    </section>
  );
}

function PersonBlock({
  person, expiryDays, timeZone, canCash, canAccounts, clubId, busy,
  onPay, onUndo, onReopen, onToggleLongTerm, onEdit, onForgive,
}: {
  person:      DebtPersonGroup;
  expiryDays:  number | null;
  timeZone:    string;
  canCash:     boolean;
  canAccounts: boolean;
  clubId:      string;
  busy:        boolean;
  onPay:            (d: ClubDebt) => void;
  onUndo:           (d: ClubDebt) => void;
  onReopen:         (d: ClubDebt) => void;
  onToggleLongTerm: (d: ClubDebt) => void;
  onEdit:           (d: ClubDebt) => void;
  onForgive:        (d: ClubDebt) => void;
}) {
  const open = person.debts.filter((d) => d.status === "OPEN");
  return (
    <section aria-label={person.name} className="rounded-lg border border-border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h4 className="font-medium text-foreground">{person.name}</h4>
        <div className="flex items-center gap-3">
          {canCash && <ClubDebtPayAll clubId={clubId} personName={person.name} debts={open} />}
          {person.openCents > 0 && (
            <span className="text-sm font-semibold text-[#D4AF37]">{formatCents(person.openCents)}</span>
          )}
        </div>
      </header>
      <ul>
        {person.debts.map((d) => (
          <li key={d.id} className="space-y-1.5 border-b border-border px-4 py-3 last:border-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{d.concept}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDayKey(d.debtDate, DAY)} · {DEBT_ORIGIN_LABEL[d.origin]}
                  {d.bookingId && (
                    <>
                      {" · "}
                      <Link href={`/mi-club/reservas/bookings/${d.bookingId}`} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-[#D4AF37]">
                        Abrir la reserva <ExternalLink className="h-3 w-3" />
                      </Link>
                    </>
                  )}
                </p>
              </div>
              {d.status === "OPEN" ? (
                <DebtPill dayNumber={d.dayNumber} expiryDays={expiryDays} lastDay={d.lastDay} longTerm={d.longTerm} />
              ) : (
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {DEBT_STATUS_LABEL[d.status]}
                </span>
              )}
              <span className="text-sm font-medium text-foreground">{formatCents(d.amountCents)}</span>
            </div>
            {d.status === "PAID" && (
              <p className="text-xs text-muted-foreground">
                Cobrada{d.paidAt && ` el ${formatInTimeZone(d.paidAt, timeZone, DAY)}`}
                {d.paymentMethod && ` · ${methodLabel(d.paymentMethod)}`}
                {d.paymentMethod === "BIZUM" && ` · ${d.bizumPartnerName ?? "Club"}`}
                {d.paidByName && ` · ${d.paidByName}`}
              </p>
            )}
            {(d.status === "FORGIVEN" || d.status === "LOST") && d.closedAt && (
              <p className="text-xs text-muted-foreground">
                {DEBT_STATUS_LABEL[d.status]} el {formatInTimeZone(d.closedAt, timeZone, DAY)}
              </p>
            )}
            {d.notes && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <StickyNote className="mt-0.5 h-3 w-3 shrink-0" /> {d.notes}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {d.status === "OPEN" && canCash && (
                <>
                  <Button variant="outline" size="sm" onClick={() => onPay(d)}>Cobrar</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onToggleLongTerm(d)}>
                    {d.longTerm ? "Quitar largo plazo" : "Largo plazo"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onEdit(d)}>Nota</Button>
                </>
              )}
              {d.status === "OPEN" && canAccounts && (
                <Button variant="outline" size="sm" onClick={() => onForgive(d)}>Perdonar</Button>
              )}
              {d.status === "PAID" && canCash && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => onUndo(d)}>
                  <Undo2 className="h-3.5 w-3.5" /> Deshacer cobro
                </Button>
              )}
              {(d.status === "FORGIVEN" || d.status === "LOST") && canAccounts && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => onReopen(d)}>Reabrir</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Perdonar: primero el motivo y, después, otra confirmación con el importe. */
function ForgiveFlow({ clubId, person, debt, onClose }: {
  clubId: string; person: string; debt: ClubDebt; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"reason" | "confirm">("reason");
  const [reason, setReason] = useState("");
  const clean = reason.trim();

  const forgive = useMutation({
    mutationFn: () => clubDebtsService.forgive(clubId, debt.id, clean),
    onSuccess: () => { toast.success("Deuda perdonada"); invalidateClubDebts(qc, clubId); onClose(); },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return step === "reason" ? (
    <ConfirmModal
      open
      title="Perdonar deuda"
      description={`${person} · ${debt.concept} · ${formatCents(debt.amountCents)}. Quedará en el historial con su motivo.`}
      confirmLabel="Continuar"
      confirmDisabled={clean.length < REASON_MIN}
      onClose={onClose}
      onConfirm={() => setStep("confirm")}
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motivo</span>
        <input
          type="text"
          aria-label="Motivo"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          className={`w-full ${schoolInputCls}`}
        />
      </label>
    </ConfirmModal>
  ) : (
    <ConfirmModal
      open
      danger
      title="¿Perdonar de verdad?"
      description={`Se dejan de cobrar ${formatCents(debt.amountCents)} a ${person}. Solo propietario y gestor pueden reabrirla.`}
      confirmLabel="Perdonar la deuda"
      loading={forgive.isPending}
      onClose={() => { if (!forgive.isPending) onClose(); }}
      onConfirm={() => forgive.mutate()}
    />
  );
}

/** La nota y el concepto de una deuda abierta. */
function EditDebtDialog({ clubId, debt, onClose }: { clubId: string; debt: ClubDebt; onClose: () => void }) {
  const qc = useQueryClient();
  const [concept, setConcept] = useState(debt.concept);
  const [notes, setNotes] = useState(debt.notes ?? "");

  const save = useMutation({
    mutationFn: () =>
      clubDebtsService.update(clubId, debt.id, {
        ...(concept.trim() !== debt.concept ? { concept: concept.trim() } : {}),
        notes: notes.trim() === "" ? null : notes.trim(),
      }),
    onSuccess: () => { toast.success("Deuda actualizada"); invalidateClubDebts(qc, clubId); onClose(); },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!save.isPending) onClose(); };

  return (
    <SchoolDialog title="Nota de la deuda" onClose={close} busy={save.isPending}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Concepto</span>
        <input
          type="text"
          aria-label="Concepto"
          value={concept}
          maxLength={120}
          onChange={(e) => setConcept(e.target.value)}
          className={`w-full ${schoolInputCls}`}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nota</span>
        <textarea
          aria-label="Nota"
          value={notes}
          maxLength={500}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
          className={`w-full ${schoolInputCls}`}
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={save.isPending}>Cancelar</Button>
        <Button type="button" size="sm" disabled={concept.trim() === "" || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
        </Button>
      </div>
    </SchoolDialog>
  );
}

/** «Nueva deuda»: de un cliente del club o de un nombre libre. */
function NewDebtDialog({ clubId, timeZone, onClose }: { clubId: string; timeZone: string; onClose: () => void }) {
  const qc = useQueryClient();
  const today = zonedDayKey(new Date(), timeZone);
  const [kind, setKind] = useState<"customer" | "name">("customer");
  const [customer, setCustomer] = useState<ClubCustomer | null>(null);
  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(today);
  const [notes, setNotes] = useState("");
  const [longTerm, setLongTerm] = useState(false);

  const cents = eurosToCents(amount);
  const who = kind === "customer" ? customer !== null : name.trim() !== "";
  const valid = who && concept.trim() !== "" && cents !== null && cents > 0 && day !== "" && day <= today;

  const create = useMutation({
    mutationFn: () =>
      clubDebtsService.create(clubId, {
        ...(kind === "customer" ? { clubCustomerId: customer!.id } : { personName: name.trim() }),
        amountCents: cents as number,
        concept: concept.trim(),
        debtDate: day,
        ...(notes.trim() !== "" ? { notes: notes.trim() } : {}),
        ...(longTerm ? { longTerm: true } : {}),
      }),
    onSuccess: (created) => {
      toast.success("Deuda apuntada");
      // Ya vencida al nacer: el back la apunta de largo plazo para que no se pierda sola
      if (created.longTermAuto)
        toast.info(
          created.expiryDays !== null
            ? `Se apunta como de largo plazo porque ya ha pasado el plazo de ${daysText(created.expiryDays)}`
            : "Se apunta como de largo plazo porque ya ha pasado su plazo",
        );
      invalidateClubDebts(qc, clubId);
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!create.isPending) onClose(); };

  return (
    <SchoolDialog title="Nueva deuda" onClose={close} busy={create.isPending}>
      <div role="group" aria-label="Quién debe" className="flex gap-2">
        {([["customer", "Cliente del club"], ["name", "Otra persona"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={kind === id}
            onClick={() => setKind(id)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
              kind === id
                ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === "customer" ? (
        <BookingCustomerPicker clubId={clubId} value={customer} onChange={setCustomer} />
      ) : (
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</span>
          <input
            type="text"
            aria-label="Nombre"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={`w-full ${schoolInputCls}`}
          />
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Concepto</span>
        <input
          type="text"
          aria-label="Concepto"
          value={concept}
          maxLength={120}
          onChange={(e) => setConcept(e.target.value)}
          className={`w-full ${schoolInputCls}`}
        />
      </label>
      <AmountField label="Importe" value={amount} onChange={setAmount} invalid={amount !== "" && cents === null} />
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Día de la deuda</span>
        <input
          type="date"
          aria-label="Día de la deuda"
          value={day}
          max={today}
          onChange={(e) => setDay(e.target.value)}
          className={`w-full ${schoolInputCls}`}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nota (opcional)</span>
        <textarea
          aria-label="Nota"
          value={notes}
          maxLength={500}
          rows={2}
          onChange={(e) => setNotes(e.target.value)}
          className={`w-full ${schoolInputCls}`}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={longTerm} onChange={(e) => setLongTerm(e.target.checked)} />
        Largo plazo (ni caduca ni avisa)
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={create.isPending}>Cancelar</Button>
        <Button type="button" size="sm" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Apuntar deuda
        </Button>
      </div>
    </SchoolDialog>
  );
}
