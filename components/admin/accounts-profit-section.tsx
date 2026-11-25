"use client";

/**
 * «Cuentas» → «Socios y reparto» (F8, fase 3): cada socio con lo que guarda y
 * su cuenta con el club, el dinero que se puede repartir con cada resta a la
 * vista, el beneficio de cada mes con la parte, lo repartido y lo pendiente de
 * cada socio, «Repartir» en los meses acabados y la lista de repartos con
 * borrar. Solo propietario y gestor. Todo lo calcula el back.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { CustomSelect, Field } from "@/components/admin/form";
import { ProfitShareDialog } from "@/components/admin/profit-share-dialog";
import { DeleteButton, ShowMore } from "@/components/admin/treasury-lists";
import { TreasuryStatement } from "@/components/admin/treasury-statement";
import { TreasuryTransferDialog } from "@/components/admin/treasury-transfer-dialog";
import { Button } from "@/components/ui/button";
import {
  profitQK, profitService, type ProfitMonth, type ProfitShareRow, type ProfitSummary,
} from "@/lib/services/profit";
import { invalidateTreasury, treasuryQK, treasuryService, type PartnerTreasury, type TreasurySummary } from "@/lib/services/treasury";
import { useClubAccess } from "@/lib/use-club-access";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import { availableRows, canShare, monthLabel, monthPartners, partnerLabel, profitYears } from "@/lib/utils/profit";
import { formatDayKey } from "@/lib/utils/time-zone";
import { LIST_PREVIEW, partnerAccountText, placeKey, signedCents } from "@/lib/utils/treasury";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const LINK = "min-h-11 text-xs text-muted-foreground underline hover:text-foreground min-[1025px]:min-h-8";

export function AccountsProfitSection({ clubId }: { clubId: string }) {
  const summary = useQuery({
    queryKey: treasuryQK.summary(clubId),
    queryFn: () => treasuryService.summary(clubId),
  });

  if (summary.isError) return <ErrorState title="No se pudo cargar la tesorería" onRetry={() => summary.refetch()} />;
  if (!summary.data) return <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />;
  if (!summary.data.started) return <NotStarted />;
  return <Started clubId={clubId} summary={summary.data} />;
}

/** Sin fecha de inicio de la tesorería no hay beneficio que repartir. */
function NotStarted() {
  return (
    <section aria-label="Socios y reparto" className="space-y-3 rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-medium">Socios y reparto</h2>
      <p className="text-sm text-muted-foreground">
        Aquí se reparte entre los socios el beneficio de cada mes. Para empezar, pon en Ajustes el día desde el que
        quieres llevar la tesorería: sin ese día no se sabe cuánto dinero hay.
      </p>
      <Link
        href="/mi-club/cuentas?tab=ajustes"
        className="inline-flex min-h-11 items-center rounded-md bg-[#D4AF37] px-4 text-sm font-semibold text-[#0C0C0C] hover:bg-[#C49F2A]"
      >
        Ir a Ajustes
      </Link>
    </section>
  );
}

type Dialog = { kind: "move"; partnerId: string } | { kind: "share"; month: ProfitMonth };

function Started({ clubId, summary }: { clubId: string; summary: TreasurySummary }) {
  const canWrite = useClubAccess().can("accounts", "write");
  const years = profitYears(summary.startDate, summary.today);
  const [year, setYear] = useState(summary.today.slice(0, 4));
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const activeIds = new Set(summary.partners.filter((p) => p.active).map((p) => p.partnerId));
  const partners = summary.partners.filter((p) => p.active || p.accountCents !== 0 || p.heldCents !== 0);
  const [statementKey, setStatementKey] = useState(
    placeKey({ place: "PARTNER_ACCOUNT", partnerId: partners[0]?.partnerId ?? null }),
  );

  const profit = useQuery({
    queryKey: profitQK.summary(clubId, year),
    queryFn: () => profitService.summary(clubId, year),
  });
  const shares = useQuery({
    queryKey: profitQK.shares(clubId, year),
    queryFn: () => profitService.shares.list(clubId, year),
  });
  const sharesRows = shares.data?.started ? shares.data.shares : [];

  const openStatement = (key: string) => {
    setStatementKey(key);
    document.getElementById("socios-extracto")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Desde el {formatDayKey(summary.startDate, DAY)}. Los meses se reparten cuando acaban.
        </p>
        {years.length > 1 && (
          <div className="w-32">
            <Field label="Año">
              <CustomSelect options={years.map((y) => ({ value: y, label: y }))} value={year} onChange={setYear} />
            </Field>
          </div>
        )}
      </div>

      {profit.isError ? (
        <ErrorState title="No se pudo cargar el reparto" onRetry={() => profit.refetch()} />
      ) : !profit.data ? (
        <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
      ) : !profit.data.started ? (
        <NotStarted />
      ) : (
        <>
          {profit.data.warnings.length > 0 && (
            <div role="note" className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              {profit.data.warnings.map((w) => (
                <p key={w} className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" /> {w}
                </p>
              ))}
              {!profit.data.sharesValid && (
                <Link href="/mi-club/cuentas?tab=ajustes" className="inline-block min-h-11 pt-2 text-xs underline min-[1025px]:min-h-8">
                  Fijar las partes en Ajustes
                </Link>
              )}
            </div>
          )}

          <PartnerCards
            partners={partners}
            canWrite={canWrite}
            activeIds={activeIds}
            shares={sharesRows}
            year={year}
            onStatement={openStatement}
            onMove={(partnerId) => setDialog({ kind: "move", partnerId })}
          />
          <Available data={profit.data} />
          <MonthsTable
            data={profit.data}
            canWrite={canWrite}
            onShare={(month) => setDialog({ kind: "share", month })}
          />
        </>
      )}

      <SharesList clubId={clubId} rows={sharesRows} canWrite={canWrite} isPending={shares.isPending} isError={shares.isError} onRetry={() => shares.refetch()} />

      {partners.length > 0 && (
        <div id="socios-extracto" className="scroll-mt-4">
          <TreasuryStatement clubId={clubId} summary={summary} placeKeyValue={statementKey} onPlaceChange={setStatementKey} />
        </div>
      )}

      {dialog?.kind === "move" && (
        <TreasuryTransferDialog clubId={clubId} summary={summary} partnerId={dialog.partnerId} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "share" && profit.data?.started && (
        <ProfitShareDialog
          clubId={clubId}
          summary={summary}
          month={dialog.month}
          availableCents={profit.data.available.availableCents}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function PartnerCards({ partners, canWrite, activeIds, shares, year, onStatement, onMove }: {
  partners:    PartnerTreasury[];
  canWrite:    boolean;
  activeIds:   ReadonlySet<string>;
  shares:      ProfitShareRow[];
  year:        string;
  onStatement: (key: string) => void;
  onMove:      (partnerId: string) => void;
}) {
  if (partners.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Todavía no hay socios. Añádelos en Ajustes → Socios del club.
      </p>
    );
  }
  return (
    <section aria-label="Socios" className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-3">
      {partners.map((p) => {
        const shared = shares.filter((s) => s.partnerId === p.partnerId).reduce((t, s) => t + s.amountCents, 0);
        return (
          <div key={p.partnerId} role="group" aria-label={p.name} className="flex flex-col rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {p.name}{!activeIds.has(p.partnerId) && " (de baja)"}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(p.heldCents)}</p>
            <p className="text-xs text-muted-foreground">Efectivo del club que guarda</p>
            <p className="mt-2 text-sm">{partnerAccountText(p.accountCents)}</p>
            <p className="text-xs text-muted-foreground">Repartido en {year}: {formatCents(shared)}</p>
            <div className="mt-auto flex gap-4 pt-2">
              <button type="button" onClick={() => onStatement(placeKey({ place: "PARTNER_ACCOUNT", partnerId: p.partnerId }))} className={LINK}>
                Extracto
              </button>
              {canWrite && activeIds.has(p.partnerId) && (
                <button type="button" onClick={() => onMove(p.partnerId)} className={LINK}>
                  Mover dinero
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Available({ data }: { data: ProfitSummary }) {
  const a = data.available;
  return (
    <section aria-label="Dinero disponible" className="space-y-2">
      <h3 className="text-base font-medium">Dinero disponible para repartir</h3>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {availableRows(a).map((r) => (
          <li key={r.key} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
            <span>
              {r.label}
              {r.hint && <span className="block text-xs text-muted-foreground">{r.hint}</span>}
            </span>
            <span className={`tabular-nums ${r.cents < 0 ? "text-muted-foreground" : ""}`}>{signedCents(r.cents)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 bg-[rgba(212,175,55,0.08)] px-3 py-2 text-sm font-semibold">
          <span>Disponible</span>
          <span className={`text-lg tabular-nums ${a.availableCents < 0 ? "text-red-500" : ""}`}>{formatCents(a.availableCents)}</span>
        </li>
      </ul>
    </section>
  );
}

function MonthsTable({ data, canWrite, onShare }: {
  data:     ProfitSummary;
  canWrite: boolean;
  onShare:  (month: ProfitMonth) => void;
}) {
  const people = monthPartners(data.months);
  // El mes más reciente, arriba
  const months = [...data.months].reverse();
  const blocked = !data.sharesValid || data.available.availableCents <= 0;
  if (months.length === 0) {
    return <p className="text-sm text-muted-foreground">Este año no tiene meses con la tesorería empezada.</p>;
  }
  return (
    <section aria-label="Beneficio por meses" className="space-y-2">
      <h3 className="text-base font-medium">Beneficio por meses</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mes</th>
              <th className="px-3 py-2 text-right font-medium">Resultado</th>
              {people.map((p) => <th key={p.partnerId} className="px-3 py-2 text-right font-medium">{partnerLabel(p)}</th>)}
              {canWrite && <th className="px-3 py-2"><span className="sr-only">Repartir</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {months.map((m) => (
              <tr key={m.period} className="align-top">
                <td className="px-3 py-2">
                  <span className="capitalize">{monthLabel(m.period)}</span>
                  {!m.ended && <span className="block text-xs text-muted-foreground">En curso</span>}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${m.resultCents < 0 ? "text-red-500" : ""}`}>{signedCents(m.resultCents)}</td>
                {people.map((p) => {
                  const part = m.parts.find((x) => x.partnerId === p.partnerId);
                  if (!part) return <td key={p.partnerId} className="px-3 py-2 text-right text-muted-foreground">—</td>;
                  return (
                    <td key={p.partnerId} className="px-3 py-2 text-right">
                      <span className="block font-medium tabular-nums">{formatCents(part.pendingCents)}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        de {formatCents(part.partCents)} · repartido {formatCents(part.sharedCents)}
                      </span>
                      {part.overSharedCents > 0 && (
                        <span className="block text-xs text-amber-600 tabular-nums">
                          Repartido de más: {formatCents(part.overSharedCents)}
                        </span>
                      )}
                    </td>
                  );
                })}
                {canWrite && (
                  <td className="px-3 py-2 text-right">
                    {canShare(m) && (
                      <Button size="sm" variant="outline" disabled={blocked} onClick={() => onShare(m)}>
                        Repartir
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        En cada socio: lo que le queda por cobrar del mes, de lo que le toca, y lo ya repartido. Un mes con pérdidas reparte 0 y no se compensa con otros.
      </p>
    </section>
  );
}

function SharesList({ clubId, rows, canWrite, isPending, isError, onRetry }: {
  clubId:    string;
  rows:      ProfitShareRow[];
  canWrite:  boolean;
  isPending: boolean;
  isError:   boolean;
  onRetry:   () => void;
}) {
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const [deleting, setDeleting] = useState<ProfitShareRow | null>(null);
  const remove = useMutation({
    mutationFn: (r: ProfitShareRow) => profitService.shares.remove(clubId, r.id),
    onSuccess: () => { setDeleting(null); toast.success("Reparto borrado"); invalidateTreasury(qc, clubId); },
    onError: (err: unknown) => { setDeleting(null); toast.error(accountsErrorText(err)); },
  });
  const shown = all ? rows : rows.slice(0, LIST_PREVIEW);

  return (
    <section aria-label="Repartos" className="space-y-2">
      <h3 className="text-base font-medium">Repartos apuntados</h3>
      {isError ? (
        <ErrorState title="No se pudieron cargar los repartos" onRetry={onRetry} />
      ) : isPending ? (
        <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay repartos este año. Cuando un mes acabe con beneficio, pulsa «Repartir» en su fila.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-medium tabular-nums">{formatCents(r.amountCents)}</span>
                  <span className="text-muted-foreground"> · {r.partnerName} · de {r.fromPlace === "BANK" ? "Banco" : "Caja"}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Reparto de {monthLabel(r.period)} · {formatDayKey(r.date, DAY)} · {r.createdByName}{r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              {canWrite && (
                <DeleteButton
                  label={`Borrar el reparto de ${formatCents(r.amountCents)} a ${r.partnerName} del ${formatDayKey(r.date, DAY)}`}
                  onClick={() => setDeleting(r)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <ShowMore total={rows.length} all={all} onToggle={() => setAll((v) => !v)} />
      <ConfirmModal
        open={deleting !== null}
        danger
        title="Borrar el reparto"
        description={
          deleting
            ? `Se borra el reparto de ${formatCents(deleting.amountCents)} a ${deleting.partnerName} (${monthLabel(deleting.period)}). Ese importe vuelve a quedar pendiente y el dinero vuelve a ${deleting.fromPlace === "BANK" ? "el banco" : "la caja"}.`
            : ""
        }
        confirmLabel="Borrar reparto"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </section>
  );
}
