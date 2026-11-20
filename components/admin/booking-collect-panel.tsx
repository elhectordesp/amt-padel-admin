"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BizumReceiverDialog } from "@/components/admin/bizum-receiver";
import { BookingPartRow } from "@/components/admin/booking-part-row";
import { BookingPartsTotals } from "@/components/admin/booking-parts-totals";
import CollectModal from "@/components/admin/collect-modal";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { accountsQK, accountsService } from "@/lib/services/accounts";
import {
  bookingPartsQK, bookingPartsService,
  type BookingPartsView, type PayPartsPayload, type UpdatePartPayload,
} from "@/lib/services/booking-parts";
import { bookingsService } from "@/lib/services/bookings";
import {
  PARTS_MAX_COUNT, PARTS_MIN_COUNT, accountsErrorText, canCollectWhole,
} from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import { PAYMENT_METHOD_OPTIONS, type CounterPaymentMethod } from "@/lib/utils/payment-methods";
import type { Booking } from "@/types/bookings";

type Tab = "all" | "players";

interface Props {
  clubId:    string;
  booking:   Booking;
  /** Tras cualquier cambio: recargar la reserva, sus listas y la caja. */
  onChanged: () => void;
}

const TAB_BASE = "min-h-11 flex-1 rounded-md px-4 text-sm font-semibold transition-colors";
const BIG = "min-h-14 rounded-lg border border-border bg-secondary text-base font-semibold text-foreground transition-colors hover:border-[rgba(212,175,55,0.5)] disabled:opacity-50";

/**
 * La «hoja de papel» del club para cobrar una reserva (módulo Cuentas): cobrar
 * todo con un botón o repartirla por jugadores, cada uno con su precio y su
 * forma de pago. Solo se monta con el módulo encendido y una reserva que se
 * puede cobrar por partes (sin cobro entero y sin cancelar).
 */
export function BookingCollectPanel({ clubId, booking, onChanged }: Props) {
  const qc = useQueryClient();
  const bookingId = booking.id;
  const [tab, setTab] = useState<Tab>(booking.partsSummary != null ? "players" : "all");
  const [count, setCount] = useState<number | null>(null);
  const [bizumAll, setBizumAll] = useState(false);
  const [otherAmount, setOtherAmount] = useState(false);
  const [confirmWhole, setConfirmWhole] = useState(false);

  const viewQuery = useQuery({
    queryKey: bookingPartsQK.view(clubId, bookingId),
    queryFn: () => bookingPartsService.view(clubId, bookingId),
  });
  const partnersQuery = useQuery({
    queryKey: accountsQK.partners(clubId),
    queryFn: () => accountsService.partners.list(clubId),
  });
  const partners = (partnersQuery.data ?? []).filter((p) => p.active);

  // Toda escritura de partes devuelve la vista completa: se queda como la de la pantalla
  const partsMut = useMutation({
    mutationFn: (run: () => Promise<BookingPartsView>) => run(),
    onSuccess: (view) => {
      qc.setQueryData(bookingPartsQK.view(clubId, bookingId), view);
      onChanged();
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const wholeMut = useMutation({
    mutationFn: (v: { method: CounterPaymentMethod; bizumPartnerId?: string | null }) =>
      bookingsService.bookings.markPaid(bookingId, v),
    onSuccess: () => {
      toast.success("Cobrado");
      void qc.invalidateQueries({ queryKey: bookingPartsQK.view(clubId, bookingId) });
      onChanged();
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const busy = partsMut.isPending || wholeMut.isPending;

  if (viewQuery.isLoading) return <Loader2 className="my-4 h-5 w-5 animate-spin text-muted-foreground" />;
  if (viewQuery.isError || !viewQuery.data) {
    return <ErrorState title="No se pudo cargar el cobro de la reserva" onRetry={() => viewQuery.refetch()} />;
  }
  const view = viewQuery.data;
  const hasParts = view.parts.length > 0;
  const wholeOnly = canCollectWhole(view.parts);
  const hasPending = view.parts.some((p) => p.status === "PENDING");
  const chosenCount = count ?? (hasParts ? view.parts.length : view.defaultCount);
  const countValid = Number.isInteger(chosenCount) && chosenCount >= PARTS_MIN_COUNT && chosenCount <= PARTS_MAX_COUNT;
  const toCollect = hasParts ? view.totals.pendingCents : view.priceCents;

  const writeParts = (run: () => Promise<BookingPartsView>) => partsMut.mutate(run);
  const payParts = (payload: PayPartsPayload) =>
    writeParts(() => bookingPartsService.pay(clubId, bookingId, payload));

  /** «Cobrar todo» con un método: las partes sin cobrar, o la reserva entera si no tiene partes. */
  const collectAll = (method: CounterPaymentMethod, receiver?: string | null) => {
    const bizum = method === "BIZUM" ? { bizumPartnerId: receiver } : {};
    if (hasParts) payParts({ method, ...bizum });
    else wholeMut.mutate({ method, ...bizum });
  };

  const onMethod = (method: CounterPaymentMethod) => {
    if (method === "BIZUM") setBizumAll(true);
    else collectAll(method);
  };

  const rowActions = {
    onUpdate: (partId: string, data: UpdatePartPayload) =>
      writeParts(() => bookingPartsService.update(clubId, bookingId, partId, data)),
    onPay: (partId: string, method: CounterPaymentMethod, bizumPartnerId?: string | null) =>
      payParts({ partIds: [partId], method, ...(method === "BIZUM" ? { bizumPartnerId } : {}) }),
    onInvite: (partId: string, reason: string) =>
      writeParts(() => bookingPartsService.invite(clubId, bookingId, partId, reason)),
    onDebt: (partId: string, who: { clubCustomerId?: string; personName?: string }) =>
      writeParts(() => bookingPartsService.debt(clubId, bookingId, partId, who)),
    onUndo: (partId: string) => writeParts(() => bookingPartsService.undo(clubId, bookingId, partId)),
    onRefund: (partId: string, amountCents: number) =>
      writeParts(() => bookingPartsService.refund(clubId, bookingId, partId, amountCents)),
  };

  const subtitle = `${booking.shortCode} · ${formatCents(toCollect)}`;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Cómo cobrar" className="flex gap-2 rounded-lg bg-secondary p-1">
        {([["all", "Cobrar todo"], ["players", "Por jugadores"]] as const).map(([id, text]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`${TAB_BASE} ${tab === id ? "bg-card text-[#D4AF37] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {text}
          </button>
        ))}
      </div>

      {tab === "all" ? (
        <div className="space-y-3">
          {toCollect === 0 && hasParts ? (
            <p className="text-sm text-muted-foreground">No queda nada por cobrar: todas las partes están resueltas.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {hasParts ? "Cobra lo que queda sin cobrar de las partes" : "Cobra la reserva entera"}:{" "}
                <strong className="text-foreground">{formatCents(toCollect)}</strong>. ¿Cómo ha pagado?
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <button key={o.value} type="button" disabled={busy} onClick={() => onMethod(o.value)} className={BIG}>
                    {o.label}
                  </button>
                ))}
              </div>
              {!hasParts && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOtherAmount(true)}
                  className="text-sm text-muted-foreground underline hover:text-foreground"
                >
                  Cobrar otro importe…
                </button>
              )}
            </>
          )}
          {hasParts && <BookingPartsTotals view={view} />}
        </div>
      ) : !hasParts ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Reparte la reserva ({formatCents(view.priceCents)}) entre los jugadores y cobra a cada uno lo suyo: {" "}
            {view.courtType === "SINGLES" ? "2 en una pista individual" : "4 en una de dobles"}, aunque puedes cambiarlo.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jugadores</span>
              <input
                type="number"
                aria-label="Número de partes"
                min={PARTS_MIN_COUNT}
                max={PARTS_MAX_COUNT}
                value={chosenCount}
                onChange={(e) => setCount(Number(e.target.value))}
                className="min-h-11 w-24 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              disabled={busy || !countValid}
              onClick={() => writeParts(() => bookingPartsService.split(clubId, bookingId, chosenCount))}
              className="min-h-11 rounded-md bg-[#D4AF37] px-5 text-sm font-semibold text-[#0C0C0C] disabled:opacity-50"
            >
              Repartir por jugadores
            </button>
          </div>
          {!countValid && (
            <p className="text-xs text-red-400">Pon entre {PARTS_MIN_COUNT} y {PARTS_MAX_COUNT} jugadores.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !hasPending}
              onClick={() => payParts({ method: "CASH" })}
              className="min-h-11 rounded-md border border-border bg-secondary px-4 text-sm font-semibold hover:border-[rgba(212,175,55,0.5)] disabled:opacity-50"
            >
              Todos efectivo
            </button>
            <button
              type="button"
              disabled={busy || !hasPending}
              onClick={() => payParts({ method: "CARD" })}
              className="min-h-11 rounded-md border border-border bg-secondary px-4 text-sm font-semibold hover:border-[rgba(212,175,55,0.5)] disabled:opacity-50"
            >
              Todos tarjeta
            </button>
            {wholeOnly && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Repartir en
                  <input
                    type="number"
                    aria-label="Número de partes"
                    min={PARTS_MIN_COUNT}
                    max={PARTS_MAX_COUNT}
                    value={chosenCount}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="min-h-11 w-20 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !countValid || chosenCount === view.parts.length}
                  onClick={() =>
                    writeParts(() => bookingPartsService.split(clubId, bookingId, chosenCount))
                  }
                  className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50"
                >
                  Cambiar el reparto
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmWhole(true)}
                  className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50"
                >
                  Volver a cobrar entera
                </button>
              </div>
            )}
          </div>

          <ul className="space-y-3">
            {view.parts.map((part) => (
              <BookingPartRow
                key={part.id}
                clubId={clubId}
                part={part}
                view={view}
                partners={partners}
                busy={busy}
                {...rowActions}
              />
            ))}
          </ul>

          <BookingPartsTotals view={view} />
        </div>
      )}

      {bizumAll && (
        <BizumReceiverDialog
          partners={partners}
          subtitle={subtitle}
          onClose={() => setBizumAll(false)}
          onPick={(receiver) => {
            setBizumAll(false);
            collectAll("BIZUM", receiver);
          }}
        />
      )}
      {otherAmount && (
        <CollectModal
          title="Cobrar reserva"
          subtitle={`${booking.shortCode} · ${booking.court?.name ?? "—"}`}
          defaultCents={booking.priceCents}
          bizumReceivers={partners}
          onSubmit={(method, amountCents, bizumPartnerId) =>
            bookingsService.bookings.markPaid(bookingId, {
              method,
              amountCents,
              ...(method === "BIZUM" ? { bizumPartnerId } : {}),
            })
          }
          onDone={() => {
            void qc.invalidateQueries({ queryKey: bookingPartsQK.view(clubId, bookingId) });
            onChanged();
          }}
          onClose={() => setOtherAmount(false)}
        />
      )}
      <ConfirmModal
        open={confirmWhole}
        title="¿Volver a cobrar la reserva entera?"
        description="Se quitan las partes (con sus nombres y precios) y la reserva se cobra de una vez, como antes."
        confirmLabel="Sí, cobrar entera"
        cancelLabel="No, volver"
        loading={partsMut.isPending}
        onClose={() => setConfirmWhole(false)}
        onConfirm={() => {
          setConfirmWhole(false);
          writeParts(() => bookingPartsService.removeAll(clubId, bookingId));
          setTab("all");
        }}
      />
    </div>
  );
}
