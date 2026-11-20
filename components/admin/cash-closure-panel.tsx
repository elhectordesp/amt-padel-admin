"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Lock, LockOpen, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { errorText } from "@/components/admin/price-seasons-panel";
import { Button } from "@/components/ui/button";
import {
  cashClosureService, closureQK, type CashClosure, type CashClosureState,
} from "@/lib/services/cash-closure";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";
import { isOwnerOrManager } from "@/lib/club-permissions";
import { formatCents } from "@/lib/utils/booking-price";
import { DIFF_TEXT_CLASS, diffResult, methodsByAmount } from "@/lib/utils/cash-closure";
import { centsToEurosInput, eurosToCents, methodLabel } from "@/lib/utils/payment-methods";
import { formatInTimeZone, zonedDayKey } from "@/lib/utils/time-zone";

interface Props {
  clubId:   string;
  /** El día de la caja, «AAAA-MM-DD» en la zona del club. */
  date:     string;
  timeZone: string;
}

/** Resultado en vivo (o ya cerrado) de efectivo o tarjeta. */
function Result({ label, diffCents }: { label: string; diffCents: number | null }) {
  if (diffCents === null) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">Sin comparar</span>
      </div>
    );
  }
  const { kind, label: text } = diffResult(diffCents);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${DIFF_TEXT_CLASS[kind]}`} data-testid={`diff-${kind}`}>{text}</span>
    </div>
  );
}

function CloseDialog({
  clubId, date, state, onClose,
}: { clubId: string; date: string; state: CashClosureState; onClose: () => void }) {
  const qc = useQueryClient();
  const titleId = useId();
  const previous = state.closure;
  const [counted, setCounted] = useState(previous ? centsToEurosInput(previous.countedCashCents) : "");
  const [terminal, setTerminal] = useState(
    previous?.cardTerminalCents != null ? centsToEurosInput(previous.cardTerminalCents) : "",
  );
  const [notes, setNotes] = useState(previous?.notes ?? "");

  const countedCents = eurosToCents(counted);
  const terminalCents = terminal.trim() === "" ? null : eurosToCents(terminal);
  const terminalInvalid = terminal.trim() !== "" && terminalCents === null;
  const { expectedByMethod, expectedCashCents, expectedCardCents } = state.current;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = useMutation({
    mutationFn: () => cashClosureService.close(clubId, {
      date,
      countedCashCents: countedCents as number,
      cardTerminalCents: terminalCents,
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success(previous ? "Día cerrado de nuevo" : "Día cerrado");
      qc.invalidateQueries({ queryKey: closureQK.all(clubId) });
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const canSave = countedCents !== null && !terminalInvalid && !save.isPending;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !save.isPending && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="font-heading text-lg text-foreground">
            {previous ? "Volver a cerrar el día" : "Cerrar el día"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lo esperado según la caja</p>
            {methodsByAmount(expectedByMethod).length === 0 ? (
              <p className="text-sm text-muted-foreground">No se ha cobrado nada este día.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {methodsByAmount(expectedByMethod).map((m) => (
                  <li key={m} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">{methodLabel(m)}</span>
                    <span className="font-medium text-foreground">{formatCents(expectedByMethod[m])}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efectivo contado</span>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Efectivo contado"
                autoFocus
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0,00"
                className="h-14 w-full rounded-md border border-border bg-secondary pl-4 pr-10 text-2xl font-semibold text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">€</span>
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">Esperado en efectivo: {formatCents(expectedCashCents)}</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total del datáfono <span className="font-normal normal-case">(opcional)</span>
            </span>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Total del datáfono"
                aria-invalid={terminalInvalid}
                value={terminal}
                onChange={(e) => setTerminal(e.target.value)}
                placeholder="0,00"
                className={`h-12 w-full rounded-md border bg-secondary pl-4 pr-10 text-xl font-semibold text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37] ${
                  terminalInvalid ? "border-red-500" : "border-border"
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">€</span>
            </div>
            {terminalInvalid
              ? <span className="mt-1 block text-xs text-red-400">Escribe un importe válido (por ejemplo 12,50)</span>
              : <span className="mt-1 block text-xs text-muted-foreground">Cobrado con tarjeta: {formatCents(expectedCardCents)}</span>}
          </label>

          <div className="space-y-1.5 rounded-md border border-border bg-secondary/40 p-3" aria-live="polite">
            <Result label="Efectivo" diffCents={countedCents === null ? null : countedCents - expectedCashCents} />
            <Result label="Tarjeta" diffCents={terminalCents === null ? null : terminalCents - expectedCardCents} />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nota (opcional)</span>
            <textarea
              aria-label="Nota del cierre"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
          </label>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={save.isPending}
            className="flex-1 rounded-md border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!canSave}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#D4AF37] py-2 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#C49F2A] disabled:opacity-60"
          >
            {save.isPending ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><Lock size={14} /> Confirmar cierre</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClosureCard({ closure, timeZone }: { closure: CashClosure; timeZone: string }) {
  const when = formatInTimeZone(closure.closedAt, timeZone, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 size={16} className="text-green-500" />
        Día cerrado por {closure.closedByName} · {when}
      </div>
      <div className="space-y-1.5 rounded-md border border-border bg-secondary/40 p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Esperado {formatCents(closure.expectedCashCents)} · contado {formatCents(closure.countedCashCents)}</span>
        </div>
        <Result label="Efectivo" diffCents={closure.cashDiffCents} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Esperado {formatCents(closure.expectedCardCents)}
            {closure.cardTerminalCents !== null && <> · datáfono {formatCents(closure.cardTerminalCents)}</>}
          </span>
        </div>
        <Result label="Tarjeta" diffCents={closure.cardDiffCents} />
      </div>
      {closure.notes && <p className="text-xs text-muted-foreground">Nota: {closure.notes}</p>}
    </div>
  );
}

/**
 * Cierre de la caja del día (módulo «Cuentas»): cerrar con el efectivo contado
 * y el total del datáfono, ver el cierre hecho, volver a cerrar si cambió lo
 * cobrado y, para propietario y gestor, reabrir el día. Sin el módulo, nada.
 */
export function CashClosurePanel({ clubId, date, timeZone }: Props) {
  const qc = useQueryClient();
  const accountsEnabled = useAccountsEnabled(clubId);
  const { roles } = useClubAccess();
  const canReopen = isOwnerOrManager(roles);
  const [closing, setClosing] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const isFuture = date > zonedDayKey(new Date(), timeZone);

  const query = useQuery({
    queryKey: closureQK.day(clubId, date),
    queryFn: () => cashClosureService.get(clubId, date),
    enabled: accountsEnabled && !isFuture,
  });

  const reopen = useMutation({
    mutationFn: () => cashClosureService.reopen(clubId, date),
    onSuccess: () => {
      toast.success("Día reabierto");
      setConfirmReopen(false);
      qc.invalidateQueries({ queryKey: closureQK.all(clubId) });
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  if (!accountsEnabled || isFuture) return null;
  const state = query.data;

  return (
    <section aria-label="Cierre de caja" className="rounded-lg border border-border bg-card p-4">
      {query.isError && !state ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-red-400">
          <AlertTriangle size={14} /> No se pudo cargar el cierre de la caja
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Reintentar</Button>
        </div>
      ) : !state ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : !state.closure ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Este día aún no está cerrado.</p>
          <Button onClick={() => setClosing(true)}><Lock className="mr-1.5 h-4 w-4" />Cerrar el día</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <ClosureCard closure={state.closure} timeZone={timeZone} />
          {state.changedSinceClose && (
            <div role="alert" className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-amber-400">
                <AlertTriangle size={14} /> Ha cambiado después del cierre
              </p>
              <ul className="text-xs text-muted-foreground">
                {state.changes.map((c) => (
                  <li key={c.method}>
                    {methodLabel(c.method)}: al cerrar {formatCents(c.closedCents)}, ahora {formatCents(c.nowCents)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {state.changedSinceClose && (
              <Button size="sm" onClick={() => setClosing(true)}>Volver a cerrar</Button>
            )}
            {canReopen && (
              <Button variant="outline" size="sm" onClick={() => setConfirmReopen(true)}>
                <LockOpen className="mr-1.5 h-3.5 w-3.5" />Reabrir el día
              </Button>
            )}
          </div>
        </div>
      )}

      {closing && state && <CloseDialog clubId={clubId} date={date} state={state} onClose={() => setClosing(false)} />}
      <ConfirmModal
        open={confirmReopen}
        title="Reabrir el día"
        description="El día volverá a estar sin cerrar y se perderá el cierre hecho (queda anotado en el historial). Tendrás que cerrarlo de nuevo."
        confirmLabel="Reabrir"
        danger
        loading={reopen.isPending}
        onClose={() => setConfirmReopen(false)}
        onConfirm={() => reopen.mutate()}
      />
    </section>
  );
}
