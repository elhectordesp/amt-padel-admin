"use client";

/**
 * Extracto de un sitio del club (Tesorería): qué lo ha movido entre dos días,
 * con el saldo tras cada fila. Hasta 93 días; al abrir, los últimos 30. Una
 * fila «Cuadre» es lo que corrigió un cuadre.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ErrorState } from "@/components/admin/error-state";
import { CustomSelect, Field, Input } from "@/components/admin/form";
import { treasuryQK, treasuryService, type TreasurySummary } from "@/lib/services/treasury";
import { formatCents } from "@/lib/utils/booking-price";
import { formatDayKey } from "@/lib/utils/time-zone";
import {
  defaultStatementRange, parsePlaceKey, placeKey, signedCents, sourceLabel, statementRangeProblem,
  withRunningBalance,
} from "@/lib/utils/treasury";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

export function TreasuryStatement({ clubId, summary, placeKeyValue, onPlaceChange }: {
  clubId:        string;
  summary:       TreasurySummary;
  placeKeyValue: string;
  onPlaceChange: (key: string) => void;
}) {
  const initial = defaultStatementRange(summary.today, summary.startDate);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const problem = statementRangeProblem(from, to, summary.startDate, summary.today);
  const query = { ...parsePlaceKey(placeKeyValue), from, to };
  const statement = useQuery({
    queryKey: treasuryQK.statement(clubId, query),
    queryFn: () => treasuryService.statement(clubId, query),
    enabled: problem === null,
  });
  const data = statement.data?.started ? statement.data : null;
  const rows = data ? withRunningBalance(data.openingCents, data.rows) : [];

  return (
    <section aria-label="Extracto" className="space-y-3">
      <h3 className="text-base font-medium">Extracto</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Sitio">
          <CustomSelect
            options={summary.places.map((p) => ({ value: placeKey(p), label: p.label }))}
            value={placeKeyValue}
            onChange={onPlaceChange}
          />
        </Field>
        <Field label="Desde">
          <Input type="date" aria-label="Extracto desde" min={summary.startDate} max={summary.today} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" aria-label="Extracto hasta" min={summary.startDate} max={summary.today} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {problem ? (
        <p role="alert" className="text-sm text-destructive">{problem}</p>
      ) : statement.isError ? (
        <ErrorState title="No se pudo cargar el extracto" onRetry={() => statement.refetch()} />
      ) : !data ? (
        <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Día</th>
                <th className="px-3 py-2 font-medium">Concepto</th>
                <th className="px-3 py-2 text-right font-medium">Importe</th>
                <th className="px-3 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="text-muted-foreground">
                <td className="px-3 py-2" colSpan={3}>Saldo al empezar</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(data.openingCents)}</td>
              </tr>
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={4}>No hay movimientos en esos días.</td>
                </tr>
              )}
              {rows.map((r, i) => (
                // Una misma referencia puede dar varias filas (p. ej. el cobro y su comisión): el orden las distingue
                <tr key={`${i}-${r.source}-${r.refId}`}>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDayKey(r.day, DAY)}</td>
                  <td className="px-3 py-2">
                    <span className="mr-2 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{sourceLabel(r.source)}</span>
                    {r.concept}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${r.amountCents < 0 ? "text-red-500" : "text-green-600"}`}>
                    {signedCents(r.amountCents)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatCents(r.balanceCents)}</td>
                </tr>
              ))}
              <tr className="bg-secondary/30 font-medium">
                <td className="px-3 py-2" colSpan={3}>Saldo al acabar</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCents(data.closingCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
