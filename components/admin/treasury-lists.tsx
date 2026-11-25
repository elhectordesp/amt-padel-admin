"use client";

/**
 * Los traspasos y los cuadres vivos de la tesorería, del más reciente al más
 * antiguo, con borrar (pide confirmación): los saldos se vuelven a calcular
 * sin ese traspaso o cuadre, y el borrado queda en el historial.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import {
  invalidateTreasury, treasuryQK, treasuryService, type Count, type Transfer,
} from "@/lib/services/treasury";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import { formatDayKey } from "@/lib/utils/time-zone";
import { LIST_PREVIEW } from "@/lib/utils/treasury";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export function ShowMore({ total, all, onToggle }: { total: number; all: boolean; onToggle: () => void }) {
  if (total <= LIST_PREVIEW) return null;
  return (
    <button type="button" onClick={onToggle} className="min-h-9 text-xs text-muted-foreground underline hover:text-foreground">
      {all ? "Ver solo los últimos" : `Ver los ${total}`}
    </button>
  );
}

export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive min-[1025px]:h-8 min-[1025px]:w-8"
    >
      <Trash2 size={15} />
    </button>
  );
}

export function TreasuryTransfersList({ clubId, canWrite }: { clubId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const [deleting, setDeleting] = useState<Transfer | null>(null);
  const list = useQuery({
    queryKey: treasuryQK.transfers(clubId),
    queryFn: () => treasuryService.transfers.list(clubId),
  });
  const remove = useMutation({
    mutationFn: (t: Transfer) => treasuryService.transfers.remove(clubId, t.id),
    onSuccess: () => { setDeleting(null); toast.success("Traspaso borrado"); invalidateTreasury(qc, clubId); },
    onError: (err: unknown) => { setDeleting(null); toast.error(accountsErrorText(err)); },
  });
  const transfers = list.data?.started ? list.data.transfers : [];
  const shown = all ? transfers : transfers.slice(0, LIST_PREVIEW);

  return (
    <section aria-label="Traspasos" className="space-y-2">
      <h3 className="text-base font-medium">Traspasos</h3>
      {list.isError ? (
        <ErrorState title="No se pudieron cargar los traspasos" onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-muted-foreground" />
      ) : transfers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay traspasos. Usa «Mover dinero» cuando saques efectivo de la caja, lo ingreses o un socio ponga o se lleve dinero.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {shown.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-medium tabular-nums">{formatCents(t.amountCents)}</span>
                  <span className="text-muted-foreground"> · {t.from.label} → {t.to.label}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDayKey(t.date, DAY)} · {t.createdByName}{t.note ? ` · ${t.note}` : ""}
                </p>
              </div>
              {canWrite && <DeleteButton label={`Borrar el traspaso de ${formatCents(t.amountCents)} del ${formatDayKey(t.date, DAY)}`} onClick={() => setDeleting(t)} />}
            </li>
          ))}
        </ul>
      )}
      <ShowMore total={transfers.length} all={all} onToggle={() => setAll((v) => !v)} />
      <ConfirmModal
        open={deleting !== null}
        danger
        title="Borrar el traspaso"
        description={
          deleting
            ? `Se borra el traspaso de ${formatCents(deleting.amountCents)} de ${deleting.from.label} a ${deleting.to.label} del ${formatDayKey(deleting.date, DAY)}. Los saldos se recalculan sin él.`
            : ""
        }
        confirmLabel="Borrar traspaso"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </section>
  );
}

export function TreasuryCountsList({ clubId, canWrite }: { clubId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const [deleting, setDeleting] = useState<Count | null>(null);
  const list = useQuery({
    queryKey: treasuryQK.counts(clubId),
    queryFn: () => treasuryService.counts.list(clubId),
  });
  const remove = useMutation({
    mutationFn: (c: Count) => treasuryService.counts.remove(clubId, c.id),
    onSuccess: () => { setDeleting(null); toast.success("Cuadre borrado"); invalidateTreasury(qc, clubId); },
    onError: (err: unknown) => { setDeleting(null); toast.error(accountsErrorText(err)); },
  });
  const counts = list.data?.started ? list.data.counts : [];
  const shown = all ? counts : counts.slice(0, LIST_PREVIEW);

  return (
    <section aria-label="Cuadres" className="space-y-2">
      <h3 className="text-base font-medium">Cuadres</h3>
      {list.isError ? (
        <ErrorState title="No se pudieron cargar los cuadres" onRetry={() => list.refetch()} />
      ) : !list.data ? (
        <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-muted-foreground" />
      ) : counts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay cuadres. Cuenta la caja y mira el banco, y pulsa «Cuadrar».</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {shown.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-medium tabular-nums">{formatCents(c.countedCents)}</span>
                  <span className="text-muted-foreground"> · {c.label}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Hasta el {formatDayKey(c.upTo, DAY)} · {c.createdByName}{c.note ? ` · ${c.note}` : ""}
                </p>
              </div>
              {canWrite && <DeleteButton label={`Borrar el cuadre de ${c.label} hasta el ${formatDayKey(c.upTo, DAY)}`} onClick={() => setDeleting(c)} />}
            </li>
          ))}
        </ul>
      )}
      <ShowMore total={counts.length} all={all} onToggle={() => setAll((v) => !v)} />
      <ConfirmModal
        open={deleting !== null}
        danger
        title="Borrar el cuadre"
        description={
          deleting
            ? `Se borra el cuadre de ${deleting.label} (${formatCents(deleting.countedCents)} hasta el ${formatDayKey(deleting.upTo, DAY)}). El saldo se recalcula desde el cuadre anterior, o desde el inicio si no hay otro.`
            : ""
        }
        confirmLabel="Borrar cuadre"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </section>
  );
}
