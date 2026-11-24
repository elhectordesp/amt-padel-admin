"use client";

/**
 * Bonos de un cliente del club, en su ficha: vender uno del catálogo, marcarlo
 * cobrado (se cobra a mano, como una reserva), ver su saldo, su caducidad y a
 * qué reservas o clases se han ido sus sesiones, y cancelarlo con la devolución
 * que el club decida. Las sesiones ya gastadas se quedan al cancelar. En un bono
 * de clases de la escuela, «+1 clase» apunta a mano una clase que no se pasó por
 * lista y «Quitar la última» quita la última apuntada a mano.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, Minus, Plus, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { AmountField, PaymentMethodPicker } from "@/components/admin/payment-fields";
import { errorText } from "@/components/admin/price-seasons-panel";
import { Button } from "@/components/ui/button";
import {
  clubVouchersQK,
  clubVouchersService,
  type ClubVoucher,
  type ClubVoucherUse,
} from "@/lib/services/club-vouchers";
import { useClubAccess } from "@/lib/use-club-access";
import { formatCents } from "@/lib/utils/booking-price";
import { centsToEurosInput, eurosToCents, type CounterPaymentMethod } from "@/lib/utils/payment-methods";
import { formatDayKey, formatInTimeZone, zonedDayKey } from "@/lib/utils/time-zone";
import {
  VOUCHER_KIND_LABEL,
  VOUCHER_STATUS_LABEL,
  checkRefund,
  expiryLabel,
  futureSessionCount,
  isVoucherOpen,
  proportionalRefundCents,
  sessionsLabel,
  typeOptionLabel,
  voucherPaymentLabel,
} from "@/lib/utils/voucher";

interface Props {
  clubId:     string;
  customerId: string;
  /** Zona horaria del club: sus fechas y la caducidad se leen en ella. */
  timeZone:   string;
}

const STATUS_COLORS: Record<ClubVoucher["status"], string> = {
  ACTIVE:    "bg-green-500/15 text-green-500 border-green-500/30",
  EXHAUSTED: "bg-muted text-muted-foreground border-border",
  EXPIRED:   "bg-amber-500/15 text-amber-500 border-amber-500/30",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
};

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" };
const DAY_TIME: Intl.DateTimeFormatOptions = { ...DAY, hour: "2-digit", minute: "2-digit" };

export function CustomerVouchersSection({ clubId, customerId, timeZone }: Props) {
  const qc = useQueryClient();
  const { can } = useClubAccess();
  const canWrite = can("cash", "write");

  const vouchers = useQuery({
    queryKey: clubVouchersQK.customer(clubId, customerId),
    queryFn: () => clubVouchersService.customer.list(clubId, customerId),
  });

  const [selling, setSelling] = useState(false);
  const [collecting, setCollecting] = useState<ClubVoucher | null>(null);
  const [uncollecting, setUncollecting] = useState<ClubVoucher | null>(null);
  const [cancelling, setCancelling] = useState<ClubVoucher | null>(null);
  const [addingClass, setAddingClass] = useState<ClubVoucher | null>(null);

  // Lo que cambia con un bono: su lista, y la caja (venta y devolución cuentan allí)
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: clubVouchersQK.customer(clubId, customerId) });
    void qc.invalidateQueries({ queryKey: ["club-cash", clubId] });
  };

  const unCollect = useMutation({
    mutationFn: (v: ClubVoucher) => clubVouchersService.setPayment(clubId, v.id, "PENDING"),
    onSuccess: () => {
      toast.success("Cobro quitado: el bono vuelve a estar pendiente de cobro");
      setUncollecting(null);
      refresh();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const removeManual = useMutation({
    mutationFn: ({ voucher, use }: { voucher: ClubVoucher; use: ClubVoucherUse }) =>
      clubVouchersService.manualUse.remove(clubId, voucher.id, use.id),
    onSuccess: () => {
      toast.success("Clase quitada: vuelve al bono");
      refresh();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const list = vouchers.data ?? [];

  return (
    <section aria-label="Bonos" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-base">Bonos</h2>
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => setSelling(true)}>
            <Plus className="h-3.5 w-3.5" /> Vender bono
          </Button>
        )}
      </div>

      {vouchers.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : vouchers.isError ? (
        <p className="text-sm text-destructive">No se han podido cargar los bonos.</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-5 text-center text-sm text-muted-foreground">
          <Ticket className="h-6 w-6 opacity-50" />
          No tiene bonos.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((v) => (
            <li key={v.id} className="rounded-lg border border-border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{v.name}</span>
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[v.status]}`}>
                    {VOUCHER_STATUS_LABEL[v.status]}
                  </span>
                  {(v.kind === "PRIVATE_CLASS" || v.kind === "SCHOOL_CLASS") && (
                    <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {VOUCHER_KIND_LABEL[v.kind]}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium">{sessionsLabel(v)}</span>
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Vendido el {formatInTimeZone(v.createdAt, timeZone, DAY)} · {formatCents(v.priceCents)} ·{" "}
                {voucherPaymentLabel(v)}
                {v.paidAt && ` el ${formatInTimeZone(v.paidAt, timeZone, DAY)}`} · {expiryLabel(v.expiresAt, timeZone)}
              </div>

              {v.cancelledAt && (
                <div className="mt-1 text-xs text-destructive">
                  Cancelado el {formatInTimeZone(v.cancelledAt, timeZone, DAY)} ·{" "}
                  {v.refundAmountCents ? `devuelto ${formatCents(v.refundAmountCents)}` : "sin devolución"}
                </div>
              )}

              {v.uses.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    {`${usesTitle(v.kind)} con este bono (${v.uses.length})`}
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {v.uses.map((u) => {
                      const when = u.startsAt ? formatInTimeZone(u.startsAt, timeZone, DAY_TIME) : "";
                      return (
                        <li key={u.id} className="text-xs">
                          {u.bookingId ? (
                            <Link href={`/mi-club/reservas/bookings/${u.bookingId}`} className="text-primary hover:underline">
                              {u.courtName} · {when}
                            </Link>
                          ) : u.type === "GROUP_CLASS" ? (
                            // Pasó lista: la clase del grupo a la que vino
                            <span>
                              Clase de grupo{u.groupName ? ` · ${u.groupName}` : ""} · {when}
                            </span>
                          ) : u.type === "MANUAL" ? (
                            <span>
                              A mano · {u.manualDate ? formatDayKey(u.manualDate, DAY) : ""}
                              {u.note ? ` · ${u.note}` : ""}
                            </span>
                          ) : (
                            // Una clase privada de la escuela: se ve en Escuela · Clases privadas
                            <span>
                              Clase privada{u.courtName ? ` · ${u.courtName}` : ""} · {when}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}

              {canWrite && isVoucherOpen(v) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {v.paid ? (
                    <Button variant="outline" size="sm" onClick={() => setUncollecting(v)}>
                      Quitar el cobro
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setCollecting(v)}>
                      Marcar cobrado
                    </Button>
                  )}
                  {v.kind === "SCHOOL_CLASS" && v.remainingSessions > 0 && v.status === "ACTIVE" && (
                    <Button variant="outline" size="sm" onClick={() => setAddingClass(v)}>
                      <Plus className="h-3.5 w-3.5" /> +1 clase
                    </Button>
                  )}
                  {lastManualUse(v) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={removeManual.isPending}
                      onClick={() => removeManual.mutate({ voucher: v, use: lastManualUse(v)! })}
                    >
                      <Minus className="h-3.5 w-3.5" /> Quitar la última
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setCancelling(v)}>
                    Cancelar bono
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {selling && (
        <SellVoucherDialog
          clubId={clubId}
          customerId={customerId}
          onDone={refresh}
          onClose={() => setSelling(false)}
        />
      )}
      {collecting && (
        <CollectVoucherDialog
          clubId={clubId}
          voucher={collecting}
          onDone={refresh}
          onClose={() => setCollecting(null)}
        />
      )}
      {addingClass && (
        <ManualClassDialog
          clubId={clubId}
          voucher={addingClass}
          timeZone={timeZone}
          onDone={refresh}
          onClose={() => setAddingClass(null)}
        />
      )}
      {cancelling && (
        <CancelVoucherDialog
          clubId={clubId}
          voucher={cancelling}
          onDone={refresh}
          onClose={() => setCancelling(null)}
        />
      )}
      <ConfirmModal
        open={!!uncollecting}
        title="Quitar el cobro del bono"
        description={`«${uncollecting?.name ?? ""}» volverá a estar pendiente de cobro. Si ya se contó en la caja de un día, ese cobro dejará de salir en ella (la caja se calcula con los cobros apuntados, no se guarda): úsalo solo si lo marcaste por error.`}
        confirmLabel="Quitar el cobro"
        loading={unCollect.isPending}
        onClose={() => {
          if (!unCollect.isPending) setUncollecting(null);
        }}
        onConfirm={() => uncollecting && unCollect.mutate(uncollecting)}
      />
    </section>
  );
}

/** Qué cuentan las sesiones gastadas de cada tipo de bono. */
function usesTitle(kind: ClubVoucher["kind"]): string {
  if (kind === "PRIVATE_CLASS") return "Clases privadas pagadas";
  if (kind === "SCHOOL_CLASS") return "Clases gastadas";
  return "Reservas pagadas";
}

/** El último uso apuntado a mano (el más reciente): lo único que «Quitar la última» puede quitar. */
function lastManualUse(v: ClubVoucher): ClubVoucherUse | null {
  const manual = v.uses.filter((u) => u.type === "MANUAL");
  if (manual.length === 0) return null;
  return manual.reduce((last, u) => (u.usedAt > last.usedAt ? u : last));
}

/** «+1 clase»: apuntar a mano una clase de un bono de la escuela, con su día (hoy) y una nota. */
function ManualClassDialog({
  clubId, voucher, timeZone, onDone, onClose,
}: { clubId: string; voucher: ClubVoucher; timeZone: string; onDone: () => void; onClose: () => void }) {
  const today = zonedDayKey(new Date(), timeZone);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const add = useMutation({
    mutationFn: () => clubVouchersService.manualUse.add(clubId, voucher.id, { date, ...(note.trim() ? { note: note.trim() } : {}) }),
    onSuccess: () => {
      toast.success("Clase apuntada: se descuenta del bono");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!add.isPending) onClose(); };

  return (
    <Modal title="Apuntar una clase" subtitle={`${voucher.name} · quedan ${voucher.remainingSessions}`} onClose={close} busy={add.isPending}>
      <label className="block text-xs text-muted-foreground">
        Día de la clase
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          disabled={add.isPending}
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Nota (opcional)
        <input
          type="text"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={add.isPending}
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <ModalButtons
        confirmLabel="Apuntar clase"
        busy={add.isPending}
        disabled={add.isPending || !date || date > today}
        onClose={close}
        onConfirm={() => add.mutate()}
      />
    </Modal>
  );
}

/** Vender un bono del catálogo: elegir cuál y, si se cobra ya, con qué método. */
function SellVoucherDialog({
  clubId, customerId, onDone, onClose,
}: { clubId: string; customerId: string; onDone: () => void; onClose: () => void }) {
  const types = useQuery({
    queryKey: clubVouchersQK.types(clubId),
    queryFn: () => clubVouchersService.types.list(clubId),
  });
  const [typeId, setTypeId] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");

  const sell = useMutation({
    mutationFn: () =>
      clubVouchersService.customer.sell(clubId, customerId, {
        typeId,
        ...(payNow && method ? { method } : {}),
      }),
    onSuccess: () => {
      toast.success(payNow ? "Bono vendido y cobrado" : "Bono vendido, pendiente de cobro");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const active = (types.data ?? []).filter((t) => t.active);
  const close = () => { if (!sell.isPending) onClose(); };
  const canSell = typeId !== "" && (!payNow || method !== "") && !sell.isPending;

  return (
    <Modal title="Vender bono" onClose={close} busy={sell.isPending}>
      {types.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay bonos en el catálogo. Créalos en Reservas · Precios · Bonos.
        </p>
      ) : (
        <>
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bono</legend>
            {active.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="voucher-type"
                  value={t.id}
                  checked={typeId === t.id}
                  onChange={() => setTypeId(t.id)}
                  disabled={sell.isPending}
                />
                {typeOptionLabel(t)}
              </label>
            ))}
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payNow}
              onChange={(e) => setPayNow(e.target.checked)}
              disabled={sell.isPending}
            />
            Cobrarlo ahora
          </label>
          {payNow && <PaymentMethodPicker value={method} onChange={setMethod} disabled={sell.isPending} />}
          {!payNow && (
            <p className="text-xs text-muted-foreground">
              Si no lo cobras ahora, queda pendiente de cobro y ya se puede gastar; lo marcas cobrado cuando
              el cliente pague.
            </p>
          )}
        </>
      )}
      <ModalButtons
        confirmLabel="Vender bono"
        busy={sell.isPending}
        disabled={!canSell}
        onClose={close}
        onConfirm={() => sell.mutate()}
      />
    </Modal>
  );
}

/** Marcar un bono cobrado con el método elegido. */
function CollectVoucherDialog({
  clubId, voucher, onDone, onClose,
}: { clubId: string; voucher: ClubVoucher; onDone: () => void; onClose: () => void }) {
  const [method, setMethod] = useState<CounterPaymentMethod | "">("");
  const collect = useMutation({
    mutationFn: () => clubVouchersService.setPayment(clubId, voucher.id, method as CounterPaymentMethod),
    onSuccess: () => {
      toast.success("Bono cobrado");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!collect.isPending) onClose(); };

  return (
    <Modal title="Cobrar bono" subtitle={`${voucher.name} · ${formatCents(voucher.priceCents)}`} onClose={close} busy={collect.isPending}>
      <PaymentMethodPicker value={method} onChange={setMethod} disabled={collect.isPending} />
      <ModalButtons
        confirmLabel="Marcar cobrado"
        busy={collect.isPending}
        disabled={method === "" || collect.isPending}
        onClose={close}
        onConfirm={() => collect.mutate()}
      />
    </Modal>
  );
}

/** Qué pasa con las sesiones del bono al cancelarlo, dicho tal cual hace el back. */
function cancelDescription(voucher: ClubVoucher): string {
  const future = futureSessionCount(voucher);
  const past = voucher.usedSessions - future;
  const what = voucher.kind === "PRIVATE_CLASS" || voucher.kind === "SCHOOL_CLASS" ? "clases" : "reservas";
  const parts: string[] = [];
  if (past > 0)
    parts.push(
      `Las ${past} ${past === 1 ? "sesión ya gastada se queda" : "sesiones ya gastadas se quedan"} (sus ${what} siguen pagadas).`,
    );
  if (future === 1)
    parts.push(
      `${what === "clases" ? "La clase" : "La reserva"} que aún no ha empezado vuelve al bono y queda pendiente de cobro.`,
    );
  else if (future > 1)
    parts.push(`Las ${future} ${what} que aún no han empezado vuelven al bono y quedan pendientes de cobro.`);
  const lost = voucher.remainingSessions + future;
  parts.push(
    lost === 0
      ? "No quedan sesiones sin gastar."
      : lost === 1
        ? "La sesión sin gastar se pierde."
        : `Las ${lost} sesiones sin gastar se pierden.`,
  );
  parts.push(
    voucher.paid
      ? "La devolución que se propone es proporcional a las sesiones sin gastar; cámbiala si el club decide otra cosa."
      : "",
  );
  return parts.filter(Boolean).join(" ");
}

/**
 * Cancelar un bono: devolución manual. Solo se puede devolver de uno cobrado y
 * hasta lo que costó; lo ya gastado se queda.
 */
function CancelVoucherDialog({
  clubId, voucher, onDone, onClose,
}: { clubId: string; voucher: ClubVoucher; onDone: () => void; onClose: () => void }) {
  const [refund, setRefund] = useState(voucher.paid ? centsToEurosInput(proportionalRefundCents(voucher)) : "");
  const [notes, setNotes] = useState("");
  const checked = checkRefund(refund, voucher.priceCents);
  // Mal escrito: lo dice el propio campo. Bien escrito pero de más: lo dice el aviso de debajo
  const unreadable = refund.trim() !== "" && eurosToCents(refund) === null;

  const cancel = useMutation({
    mutationFn: () => {
      if (!checked.ok) throw new Error(checked.message);
      return clubVouchersService.cancel(clubId, voucher.id, {
        ...(checked.value > 0 ? { refundAmountCents: checked.value } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    },
    onSuccess: () => {
      toast.success("Bono cancelado");
      onDone();
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <ConfirmModal
      open
      danger
      title={`Cancelar el bono «${voucher.name}»`}
      description={cancelDescription(voucher)}
      confirmLabel="Cancelar bono"
      cancelLabel="Volver"
      loading={cancel.isPending}
      onClose={onClose}
      onConfirm={() => {
        if (!checked.ok) {
          toast.error(checked.message);
          return;
        }
        cancel.mutate();
      }}
    >
      {voucher.paid && (
        <AmountField
          label="Importe devuelto (a mano)"
          value={refund}
          onChange={setRefund}
          invalid={unreadable}
          disabled={cancel.isPending}
        />
      )}
      {!checked.ok && !unreadable && <p className="text-xs text-red-400">{checked.message}</p>}
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notas (opcional)
        </span>
        <textarea
          aria-label="Notas de la cancelación"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
          disabled={cancel.isPending}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
      </label>
    </ConfirmModal>
  );
}

function Modal({
  title, subtitle, onClose, busy, children,
}: { title: string; subtitle?: string; onClose: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label={title} className="relative flex w-full max-w-sm flex-col rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-40"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalButtons({
  confirmLabel, busy, disabled, onClose, onConfirm,
}: { confirmLabel: string; busy: boolean; disabled: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onClose}
        disabled={busy}
        className="flex-1 rounded-md border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
      >
        Cancelar
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#D4AF37] py-2 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#C49F2A] disabled:opacity-60"
      >
        {busy ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : confirmLabel}
      </button>
    </div>
  );
}
