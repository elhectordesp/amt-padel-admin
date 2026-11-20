"use client";

import { useState } from "react";
import { GraduationCap, Pencil } from "lucide-react";
import { BizumReceiverDialog } from "@/components/admin/bizum-receiver";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import type { ClubPartner } from "@/lib/services/accounts";
import type {
  BookingPart, BookingPartsView, UpdatePartPayload,
} from "@/lib/services/booking-parts";
import {
  PRICE_CUSTOM, PRICE_MEMBER, PRICE_NORMAL, REFUND_REASON_MAX, REFUND_REASON_MIN, namedPriceChoice, partWho, priceChoiceOf,
  refundableOfPart, studentSuggestion, updateForChoice,
} from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import { centsToEurosInput, eurosToCents, methodLabel, type CounterPaymentMethod } from "@/lib/utils/payment-methods";

interface Props {
  clubId:   string;
  part:     BookingPart;
  view:     BookingPartsView;
  /** Socios activos del club: a quién puede llegar un Bizum. */
  partners: ClubPartner[];
  /** Hay una operación en marcha: nada se pulsa hasta que acabe. */
  busy:     boolean;
  onUpdate: (partId: string, data: UpdatePartPayload) => void;
  onPay:    (partId: string, method: CounterPaymentMethod, bizumPartnerId?: string | null) => void;
  onInvite: (partId: string, reason: string) => void;
  onDebt:   (partId: string, who: { clubCustomerId?: string; personName?: string }) => void;
  onUndo:   (partId: string) => void;
  onRefund: (partId: string, amountCents: number, reason: string) => void;
  /** Devolver un cobro de otro día es del área «accounts»; el de hoy, de la caja. */
  canRefund: boolean;
}

const FIELD =
  "w-full min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:border-[#D4AF37]";
const BIG =
  "flex-1 min-h-11 min-w-[5.5rem] rounded-md border text-sm font-semibold transition-colors disabled:opacity-50";
const BIG_IDLE = "border-border bg-secondary text-foreground hover:border-[rgba(212,175,55,0.5)]";

const STATUS_CHIP: Record<BookingPart["status"], string> = {
  PENDING: "bg-red-500/15 text-red-600 dark:text-red-400",
  PAID:    "bg-green-500/15 text-green-600 dark:text-green-400",
  DEBT:    "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  INVITED: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

const STATUS_TEXT: Record<BookingPart["status"], string> = {
  PENDING: "Sin cobrar",
  PAID:    "Cobrada",
  DEBT:    "Debe",
  INVITED: "Invitada",
};

/** Qué se ve de una parte ya cobrada, a deber o invitada, en una línea. */
function resolvedLine(part: BookingPart): string | null {
  if (part.status === "PAID") {
    const how = part.paymentMethod === "BIZUM"
      ? `Bizum a ${part.bizumPartnerName ?? "Club"}`
      : methodLabel(part.paymentMethod);
    const refund = part.refundAmountCents ? ` · devuelto ${formatCents(part.refundAmountCents)}` : "";
    return `${how}${part.paidByName ? ` · cobró ${part.paidByName}` : ""}${refund}`;
  }
  if (part.status === "INVITED") return part.reason;
  return null;
}

export function BookingPartRow({
  clubId, part, view, partners, busy, onUpdate, onPay, onInvite, onDebt, onUndo, onRefund, canRefund,
}: Props) {
  const pending = part.status === "PENDING";
  const who = partWho(part);
  const choice = priceChoiceOf(part);
  const student = studentSuggestion(part, view);

  const [editingWho, setEditingWho] = useState(false);
  const [freeName, setFreeName] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState(centsToEurosInput(part.priceCents));
  const [customReason, setCustomReason] = useState(part.reason ?? "");
  const [dialog, setDialog] = useState<null | "bizum" | "invite" | "debt" | "undo" | "refund">(null);
  const [inviteReason, setInviteReason] = useState("");
  const [debtName, setDebtName] = useState("");
  const [refundText, setRefundText] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const closeDialog = () => setDialog(null);
  const refundable = refundableOfPart(part);
  const refundCents = eurosToCents(refundText);
  const customCents = eurosToCents(customAmount);
  const customValid = customCents !== null && customReason.trim().length > 0;
  const label = `Parte ${part.position}`;
  const showCustomForm = pending && (customOpen || part.kind === "CUSTOM");

  const chooseWho = (data: UpdatePartPayload) => {
    onUpdate(part.id, data);
    setEditingWho(false);
    setFreeName("");
  };

  const choosePrice = (value: string) => {
    if (value === PRICE_CUSTOM) {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    const update = updateForChoice(value);
    if (update) onUpdate(part.id, update);
  };

  const startDebt = () => {
    if (who !== null) onDebt(part.id, {});
    else setDialog("debt");
  };

  const inviteReasonValid = inviteReason.trim().length >= 3 && inviteReason.trim().length <= 200;
  const debtValid = debtName.trim().length > 0;

  const namedKnown = part.partPriceId !== null && view.priceOptions.some((o) => o.partPriceId === part.partPriceId);

  return (
    <li className="rounded-lg border border-border bg-background p-3 space-y-3" aria-label={label}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <button
          type="button"
          onClick={() => setEditingWho((v) => !v)}
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm text-foreground hover:bg-secondary disabled:opacity-50"
          aria-label={`Quién es la ${label.toLowerCase()}`}
        >
          {who ?? <span className="text-muted-foreground">Sin nombre</span>}
          <Pencil className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
        {part.isStudent && (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
            <GraduationCap className="h-3 w-3" aria-hidden /> Es alumno
          </span>
        )}
        <span className={`ml-auto rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[part.status]}`}>
          {STATUS_TEXT[part.status]}
        </span>
        <span className="text-base font-semibold tabular-nums text-foreground">{formatCents(part.priceCents)}</span>
      </div>

      {editingWho && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <BookingCustomerPicker
            clubId={clubId}
            value={null}
            onChange={(c) => c && chooseWho({ clubCustomerId: c.id, label: null })}
          />
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Nombre libre"
              placeholder="O un nombre sin ficha de cliente"
              value={freeName}
              maxLength={60}
              onChange={(e) => setFreeName(e.target.value)}
              className={FIELD}
            />
            <button
              type="button"
              disabled={freeName.trim() === "" || busy}
              onClick={() => chooseWho({ label: freeName.trim(), clubCustomerId: null })}
              className="min-h-11 rounded-md bg-[#D4AF37] px-4 text-sm font-semibold text-[#0C0C0C] disabled:opacity-50"
            >
              Poner nombre
            </button>
          </div>
          {who !== null && (
            <button
              type="button"
              disabled={busy}
              onClick={() => chooseWho({ clubCustomerId: null, label: null })}
              className="text-xs text-muted-foreground underline"
            >
              Quitar el nombre
            </button>
          )}
        </div>
      )}

      {pending ? (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Precio</span>
            <select
              aria-label={`Precio de la ${label.toLowerCase()}`}
              value={customOpen ? PRICE_CUSTOM : choice}
              disabled={busy}
              onChange={(e) => choosePrice(e.target.value)}
              className={FIELD}
            >
              <option value={PRICE_NORMAL}>Normal</option>
              {(view.member.offered || part.kind === "MEMBER") && (
                <option value={PRICE_MEMBER}>Socio (−{view.member.discountPercent} %)</option>
              )}
              {view.priceOptions.map((o) => (
                <option key={o.partPriceId} value={namedPriceChoice(o.partPriceId)}>
                  {o.name} · {formatCents(o.priceCents)}{o.perCourt ? " (pista entera)" : ""}
                </option>
              ))}
              {part.kind === "SPECIAL" && part.partPriceId !== null && !namedKnown && (
                <option value={namedPriceChoice(part.partPriceId)}>{part.partPriceName ?? "Precio especial"} (ya no se ofrece)</option>
              )}
              <option value={PRICE_CUSTOM}>Otro precio…</option>
            </select>
          </label>

          {student && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
              <GraduationCap className="h-4 w-4 shrink-0" aria-hidden />
              <span>Es alumno de la escuela.</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onUpdate(part.id, { kind: "SPECIAL", partPriceId: student.partPriceId })}
                className="min-h-9 rounded-md border border-blue-500/40 px-3 font-medium hover:bg-blue-500/15 disabled:opacity-50"
              >
                Aplicar precio de alumno ({formatCents(student.priceCents)})
              </button>
            </div>
          )}

          {showCustomForm && (
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Importe del otro precio"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className={`${FIELD} ${customCents === null ? "border-red-500" : ""}`}
              />
              <input
                type="text"
                aria-label="Motivo del otro precio"
                placeholder="Motivo (obligatorio): cuadre, amigo…"
                value={customReason}
                maxLength={200}
                onChange={(e) => setCustomReason(e.target.value)}
                className={FIELD}
              />
              <button
                type="button"
                disabled={!customValid || busy}
                onClick={() =>
                  onUpdate(part.id, { kind: "CUSTOM", priceCents: customCents as number, reason: customReason.trim() })
                }
                className="min-h-11 rounded-md bg-[#D4AF37] px-4 text-sm font-semibold text-[#0C0C0C] disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onPay(part.id, "CASH")} className={`${BIG} ${BIG_IDLE}`}>Efectivo</button>
            <button type="button" disabled={busy} onClick={() => onPay(part.id, "CARD")} className={`${BIG} ${BIG_IDLE}`}>Tarjeta</button>
            <button type="button" disabled={busy} onClick={() => setDialog("bizum")} className={`${BIG} ${BIG_IDLE}`}>Bizum</button>
            <button type="button" disabled={busy} onClick={startDebt} className={`${BIG} border-orange-500/40 bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 dark:text-orange-300`}>Debe</button>
            <button type="button" disabled={busy} onClick={() => setDialog("invite")} className={`${BIG} border-violet-500/40 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300`}>Invitado</button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {part.kind === "CUSTOM" && part.reason && part.status !== "INVITED" ? `Otro precio: ${part.reason}. ` : ""}
            {part.partPriceName && part.kind === "SPECIAL" ? `${part.partPriceName}. ` : ""}
            {resolvedLine(part)}
          </p>
          {refundable > 0 && canRefund && (
            <button
              type="button"
              disabled={busy}
              onClick={() => { setRefundText(centsToEurosInput(refundable)); setRefundReason(""); setDialog("refund"); }}
              className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50"
            >
              Devolver
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setDialog("undo")}
            className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50"
          >
            Deshacer
          </button>
        </div>
      )}

      {dialog === "bizum" && (
        <BizumReceiverDialog
          partners={partners}
          subtitle={`${label} · ${formatCents(part.priceCents)}`}
          onClose={closeDialog}
          onPick={(receiver) => {
            closeDialog();
            onPay(part.id, "BIZUM", receiver);
          }}
        />
      )}

      <ConfirmModal
        open={dialog === "invite"}
        title="Invitar esta parte"
        description={`${label} no paga. Cuéntanos por qué: queda apuntado en la reserva.`}
        confirmLabel="Marcar como invitada"
        confirmDisabled={!inviteReasonValid}
        onClose={closeDialog}
        onConfirm={() => { closeDialog(); onInvite(part.id, inviteReason.trim()); setInviteReason(""); }}
      >
        <input
          type="text"
          aria-label="Motivo de la invitación"
          placeholder="Motivo (de 3 a 200 caracteres)"
          value={inviteReason}
          maxLength={200}
          onChange={(e) => setInviteReason(e.target.value)}
          className={FIELD}
        />
      </ConfirmModal>

      <ConfirmModal
        open={dialog === "debt"}
        title="¿Quién debe esta parte?"
        description={`${label} no tiene a nadie. Elige al cliente o escribe un nombre para apuntar la deuda.`}
        confirmLabel="Apuntar la deuda"
        confirmDisabled={!debtValid}
        onClose={closeDialog}
        onConfirm={() => {
          closeDialog();
          onDebt(part.id, { personName: debtName.trim() });
          setDebtName("");
        }}
      >
        <BookingCustomerPicker
          clubId={clubId}
          value={null}
          onChange={(c) => {
            if (!c) return;
            closeDialog();
            onDebt(part.id, { clubCustomerId: c.id });
          }}
        />
        <input
          type="text"
          aria-label="Nombre de quien debe"
          placeholder="O escribe un nombre"
          value={debtName}
          maxLength={120}
          onChange={(e) => setDebtName(e.target.value)}
          className={FIELD}
        />
      </ConfirmModal>

      <ConfirmModal
        open={dialog === "undo"}
        danger
        title="¿Deshacer esta parte?"
        description={
          part.status === "PAID"
            ? "Se borra el cobro y la parte vuelve a quedar sin cobrar."
            : part.status === "DEBT"
              ? "Se borra la deuda apuntada y la parte vuelve a quedar sin cobrar."
              : "La parte deja de ser invitada y vuelve a quedar sin cobrar."
        }
        confirmLabel="Sí, deshacer"
        cancelLabel="No, volver"
        onClose={closeDialog}
        onConfirm={() => { closeDialog(); onUndo(part.id); }}
      />

      <ConfirmModal
        open={dialog === "refund"}
        title="Devolver dinero de esta parte"
        description={`Se cobraron ${formatCents(part.priceCents)}. Puedes devolver hasta ${formatCents(refundable)}.`}
        confirmLabel="Devolver"
        confirmDisabled={
          refundCents === null || refundCents <= 0 || refundCents > refundable ||
          refundReason.trim().length < REFUND_REASON_MIN
        }
        onClose={closeDialog}
        onConfirm={() => { closeDialog(); onRefund(part.id, refundCents as number, refundReason.trim()); }}
      >
        <input
          type="text"
          inputMode="decimal"
          aria-label="Importe a devolver"
          value={refundText}
          onChange={(e) => setRefundText(e.target.value)}
          className={FIELD}
        />
        <input
          type="text"
          aria-label="Motivo de la devolución"
          placeholder="Motivo (queda en el historial)"
          value={refundReason}
          maxLength={REFUND_REASON_MAX}
          onChange={(e) => setRefundReason(e.target.value)}
          className={`${FIELD} mt-3`}
        />
      </ConfirmModal>
    </li>
  );
}
