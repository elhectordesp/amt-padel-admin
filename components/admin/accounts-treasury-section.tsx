"use client";

/**
 * «Cuentas» → «Tesorería» (F8, fase 3): dónde está el dinero del club (caja,
 * banco y lo que guardan los socios), cuánto hay en total, la cuenta de cada
 * socio con el club, «Mover dinero», «Cuadrar» contra lo que hay de verdad,
 * el extracto y los traspasos y cuadres apuntados. Un socio dado de baja con
 * saldo se salda desde su fila. Solo propietario y gestor.
 * Los saldos los calcula el back; aquí no se guarda nada aparte.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, ClipboardCheck, Loader2 } from "lucide-react";
import { ErrorState } from "@/components/admin/error-state";
import { TreasuryCountDialog } from "@/components/admin/treasury-count-dialog";
import { TreasuryCountsList, TreasuryTransfersList } from "@/components/admin/treasury-lists";
import { TreasurySettleDialog } from "@/components/admin/treasury-settle-dialog";
import { TreasuryStatement } from "@/components/admin/treasury-statement";
import { TreasuryTransferDialog } from "@/components/admin/treasury-transfer-dialog";
import { Button } from "@/components/ui/button";
import { treasuryQK, treasuryService, type PlaceBalance, type TreasurySummary } from "@/lib/services/treasury";
import { useClubAccess } from "@/lib/use-club-access";
import { formatCents } from "@/lib/utils/booking-price";
import { formatDayKey } from "@/lib/utils/time-zone";
import { partnerAccountText, pendingSettlements, placeKey } from "@/lib/utils/treasury";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

export function AccountsTreasurySection({ clubId }: { clubId: string }) {
  const summary = useQuery({
    queryKey: treasuryQK.summary(clubId),
    queryFn: () => treasuryService.summary(clubId),
  });

  if (summary.isError) return <ErrorState title="No se pudo cargar la tesorería" onRetry={() => summary.refetch()} />;
  if (!summary.data) return <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />;
  if (!summary.data.started) return <NotStarted />;
  return <Started clubId={clubId} summary={summary.data} />;
}

/** Sin fecha de inicio: qué es la tesorería y dónde se pone. */
function NotStarted() {
  return (
    <section aria-label="Tesorería" className="space-y-3 rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-medium">Tesorería</h2>
      <p className="text-sm text-muted-foreground">
        La tesorería dice dónde está el dinero del club: cuánto hay en la caja, cuánto en el banco y cuánto guarda cada
        socio. Parte de lo que ya cuenta el panel (cobros, apuntes, compras de la tienda y cierres de caja) y de los
        traspasos y cuadres que apuntes tú.
      </p>
      <p className="text-sm text-muted-foreground">
        Para empezar, pon el día desde el que quieres llevarla en Ajustes. Ese día cuadrarás la caja y el banco con lo
        que hay de verdad.
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

type Dialog = { kind: "transfer" } | { kind: "count"; key: string } | { kind: "settle"; partnerId: string };

function Started({ clubId, summary }: { clubId: string; summary: TreasurySummary }) {
  const canWrite = useClubAccess().can("accounts", "write");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [statementKey, setStatementKey] = useState("CASH");
  const activePartners = new Set(summary.partners.filter((p) => p.active).map((p) => p.partnerId));
  // Las tarjetas de «lo que guarda cada socio»: los de baja solo si aún guardan algo (y se pueden cuadrar para saldarlo)
  const held = summary.places.filter((p) => p.place === "PARTNER_HELD" && (p.balanceCents !== 0 || activePartners.has(p.partnerId ?? "")));
  const cash = summary.places.find((p) => p.place === "CASH");
  const bank = summary.places.find((p) => p.place === "BANK");
  const partners = summary.partners.filter((p) => p.active || p.accountCents !== 0 || p.heldCents !== 0);

  const openStatement = (key: string) => {
    setStatementKey(key);
    document.getElementById("tesoreria-extracto")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Desde el {formatDayKey(summary.startDate, { ...DAY, year: "numeric" })}. Saldos a hoy.
        </p>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog({ kind: "transfer" })}>
              <ArrowLeftRight className="h-4 w-4" /> Mover dinero
            </Button>
            <Button variant="outline" onClick={() => setDialog({ kind: "count", key: "CASH" })}>
              <ClipboardCheck className="h-4 w-4" /> Cuadrar
            </Button>
          </div>
        )}
      </div>

      {summary.unplaced.count > 0 && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            Hay {summary.unplaced.count} {summary.unplaced.count === 1 ? "movimiento" : "movimientos"} sin lugar
            ({formatCents(summary.unplaced.cents)}) que no suman en ninguna parte: cobros con «Otro», apuntes con la
            forma de pago sin saber o compras de la tienda sin «Pagado con». Se ven en «Requiere atención», en Resumen.
          </span>
        </p>
      )}

      <section aria-label="Saldos" className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-3">
        {cash && <PlaceCard place={cash} warnUncounted canWrite={canWrite} onCount={(k) => setDialog({ kind: "count", key: k })} onStatement={openStatement} />}
        {bank && <PlaceCard place={bank} warnUncounted canWrite={canWrite} onCount={(k) => setDialog({ kind: "count", key: k })} onStatement={openStatement} />}
        {held.map((p) => (
          <PlaceCard key={placeKey(p)} place={p} canWrite={canWrite} onCount={(k) => setDialog({ kind: "count", key: k })} onStatement={openStatement} />
        ))}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fondo (no se reparte)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(summary.fundCents)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Está dentro de la caja y el banco, pero no se reparte entre los socios. Se marca en las categorías de Ajustes.</p>
        </div>
        <div className="rounded-lg border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.08)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total del club</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(summary.totalCents)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Caja, banco y lo que guardan los socios. La cuenta de cada socio va aparte.</p>
        </div>
      </section>

      {partners.length > 0 && (
        <section aria-label="Cuentas de los socios" className="space-y-2">
          <h3 className="text-base font-medium">Cuentas de los socios</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {partners.map((p) => {
              const key = placeKey({ place: "PARTNER_ACCOUNT", partnerId: p.partnerId });
              // De baja con saldo: se puede saldar y, si su cuenta no está a cero, cuadrar
              const toSettle = p.active ? [] : pendingSettlements(p);
              return (
                <li key={p.partnerId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{p.name}</span>
                    {!p.active && (
                      <span className={`ml-2 text-xs ${toSettle.length > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {toSettle.length > 0 ? "De baja · pendiente de saldar" : "(de baja)"}
                      </span>
                    )}
                    <span className="block text-muted-foreground">
                      {toSettle.length > 0 ? toSettle.map((i) => i.text).join(" · ") : partnerAccountText(p.accountCents)}
                    </span>
                  </span>
                  {canWrite && toSettle.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "settle", partnerId: p.partnerId })}
                      className="min-h-11 rounded-md border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] px-3 text-xs font-semibold text-[#D4AF37] min-[1025px]:min-h-8"
                    >
                      Saldar
                    </button>
                  )}
                  <button type="button" onClick={() => openStatement(key)} className="min-h-11 text-xs text-muted-foreground underline hover:text-foreground min-[1025px]:min-h-8">
                    Extracto
                  </button>
                  {canWrite && (p.active || p.accountCents !== 0) && (
                    <button type="button" onClick={() => setDialog({ kind: "count", key })} className="min-h-11 text-xs text-muted-foreground underline hover:text-foreground min-[1025px]:min-h-8">
                      Cuadrar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div id="tesoreria-extracto" className="scroll-mt-4">
        <TreasuryStatement clubId={clubId} summary={summary} placeKeyValue={statementKey} onPlaceChange={setStatementKey} />
      </div>

      <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-2">
        <TreasuryTransfersList clubId={clubId} canWrite={canWrite} />
        <TreasuryCountsList clubId={clubId} canWrite={canWrite} />
      </div>

      {dialog?.kind === "transfer" && <TreasuryTransferDialog clubId={clubId} summary={summary} onClose={() => setDialog(null)} />}
      {dialog?.kind === "count" && <TreasuryCountDialog clubId={clubId} summary={summary} initialKey={dialog.key} onClose={() => setDialog(null)} />}
      {dialog?.kind === "settle" && <TreasurySettleDialog clubId={clubId} summary={summary} partnerId={dialog.partnerId} onClose={() => setDialog(null)} />}
    </div>
  );
}

function PlaceCard({ place, warnUncounted = false, canWrite, onCount, onStatement }: {
  place:          PlaceBalance;
  /** Caja y banco: sin ningún cuadre, se avisa. */
  warnUncounted?: boolean;
  canWrite:       boolean;
  onCount:        (key: string) => void;
  onStatement:    (key: string) => void;
}) {
  const key = placeKey(place);
  const last = place.lastCount;
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{place.label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${place.balanceCents < 0 ? "text-red-500" : ""}`}>
        {formatCents(place.balanceCents)}
      </p>
      <p className={`mt-1 text-xs ${!last && warnUncounted ? "text-amber-600" : "text-muted-foreground"}`}>
        {last
          ? `Último cuadre: hasta el ${formatDayKey(last.upTo, DAY)}, ${formatCents(last.countedCents)}`
          : warnUncounted ? "Sin cuadrar: cuenta lo que hay de verdad" : "Sin cuadrar"}
      </p>
      <div className="mt-auto flex gap-4 pt-2">
        <button type="button" onClick={() => onStatement(key)} className="min-h-11 text-xs text-muted-foreground underline hover:text-foreground min-[1025px]:min-h-8">
          Extracto
        </button>
        {canWrite && (
          <button type="button" onClick={() => onCount(key)} className="min-h-11 text-xs text-muted-foreground underline hover:text-foreground min-[1025px]:min-h-8">
            Cuadrar
          </button>
        )}
      </div>
    </div>
  );
}
