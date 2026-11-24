"use client";

/**
 * «Cuentas» → «Resumen» (F8, C4): lo que ha entrado, lo que ha salido y lo que
 * queda en una semana, un mes, un trimestre o un año; las barras de los 6
 * periodos; los ingresos por fuente, los gastos, los márgenes por actividad y
 * cómo se ha cobrado; y arriba «Requiere atención». Se descarga como Excel (mes,
 * trimestre o año) y como ZIP con los justificantes del mes. Solo propietario y
 * gestor.
 */

import { Fragment, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Loader2, FileArchive } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { ErrorState } from "@/components/admin/error-state";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  INCOME_SOURCES, reportsQK, reportsService,
  type AttentionItem, type ReportPeriod, type Summary,
} from "@/lib/services/club-reports";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import {
  INCOME_SOURCE_LABEL, METHOD_LABEL, PERIOD_OPTIONS,
  formatMargin, hasNextPeriod, saveDownload, seriesDescription, shiftPeriodDate,
} from "@/lib/utils/club-reports";
import { ACTIVITY_LABEL, PAYMENT_LABEL } from "@/lib/utils/ledger";
import { formatDayKey, zonedDayKey } from "@/lib/utils/time-zone";
import type { LedgerActivity, LedgerPayment } from "@/lib/services/ledger";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
/** Tonos que se leen sobre el fondo oscuro del panel y sobre uno claro. */
const INCOME_COLOR = "#10b981";
const EXPENSE_COLOR = "#f43f5e";
const ACTIVITIES: LedgerActivity[] = ["COURTS", "ACADEMY", "TEAMS", "TOURNAMENTS", "SHOP", "OTHER"];

export function AccountsSummarySection({ clubId }: { clubId: string }) {
  const { timeZone, isError, refetch } = useClubTimeZone(clubId);
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!timeZone) return <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />;
  return <SummaryView clubId={clubId} today={zonedDayKey(new Date(), timeZone)} />;
}

function Money({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatCents(cents)}</span>;
}

/** El resultado con su signo y su color, para que no dependa solo del color. */
function Result({ cents, className = "" }: { cents: number; className?: string }) {
  const tone = cents < 0 ? "text-red-500" : cents > 0 ? "text-emerald-500" : "text-foreground";
  return <span className={`tabular-nums ${tone} ${className}`}>{cents > 0 ? "+" : ""}{formatCents(cents)}</span>;
}

function Figure({ label, children, sub }: { label: string; children: React.ReactNode; sub?: string }) {
  return (
    <div role="group" aria-label={label} className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl text-foreground">{children}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Block({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
      {note && <p className="mt-3 text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}

function Row({ label, children, sub }: { label: string; children: React.ReactNode; sub?: boolean }) {
  return (
    <li className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${sub ? "pl-4 text-muted-foreground" : "text-foreground"}`}>
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0">{children}</span>
    </li>
  );
}

function AttentionBlock({ clubId }: { clubId: string }) {
  const query = useQuery({
    queryKey: reportsQK.attention(clubId),
    queryFn: () => reportsService.attention(clubId),
  });
  if (query.isError) return <ErrorState title="No se pudieron cargar los avisos" onRetry={() => query.refetch()} />;
  const items = query.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-label="Requiere atención" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <AlertTriangle size={14} className="text-amber-500" /> Requiere atención
      </h3>
      <ul className="divide-y divide-border">
        {items.map((item) => <AttentionRow key={item.key} item={item} />)}
      </ul>
    </section>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <li className="py-2">
      <Link href={item.href} className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-1 text-sm hover:bg-secondary/40">
        <span className="min-w-0 flex-1 text-foreground">
          {item.title}
          <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{item.count}</span>
        </span>
        {item.severity === "high" && (
          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs font-medium text-red-400">Urgente</span>
        )}
        {item.amountCents !== null && <Money cents={item.amountCents} className="text-xs text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">Ver ›</span>
      </Link>
      {item.details.length > 0 && (
        <ul className="mt-0.5 space-y-0.5 pl-1 text-xs text-muted-foreground">
          {item.details.map((d, i) => (
            <li key={`${d.label}-${i}`} className="flex flex-wrap items-baseline gap-x-3">
              {d.href
                ? <Link href={d.href} className="hover:text-foreground hover:underline">{d.label}</Link>
                : <span>{d.label}</span>}
              {d.date && <span>{formatDayKey(d.date, DAY)}</span>}
              {d.amountCents !== undefined && <Money cents={d.amountCents} />}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SummaryView({ clubId, today }: { clubId: string; today: string }) {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [date, setDate] = useState(today);
  const query = useQuery({
    queryKey: reportsQK.summary(clubId, period, date),
    queryFn: () => reportsService.summary(clubId, period, date),
    placeholderData: (previous) => previous,
  });
  const data = query.data;

  const excel = useMutation({
    mutationFn: () => reportsService.excel(clubId, period as Exclude<ReportPeriod, "week">, date),
    onSuccess: (file) => saveDownload(file),
    onError: (err) => toast.error(accountsErrorText(err)),
  });
  const receiptsMonth = date.slice(0, 7);
  const receipts = useMutation({
    mutationFn: () => reportsService.receipts(clubId, receiptsMonth),
    onSuccess: (file) => saveDownload(file),
    onError: (err) => toast.error(accountsErrorText(err)),
  });

  const changePeriod = (next: ReportPeriod) => {
    setPeriod(next);
    setDate(today);
  };

  return (
    <div className="flex flex-col gap-4">
      <AttentionBlock clubId={clubId} />

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Periodo" className="flex gap-1">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={period === p.value}
              onClick={() => changePeriod(p.value)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                period === p.value
                  ? "border-gold-border bg-gold-muted text-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Periodo anterior"
            onClick={() => setDate(shiftPeriodDate(period, date, -1))}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <span aria-live="polite" className="min-w-32 text-center text-sm font-medium text-foreground">
            {data?.label ?? "…"}
          </span>
          <button
            type="button"
            aria-label="Periodo siguiente"
            disabled={!hasNextPeriod(period, date, today)}
            onClick={() => setDate(shiftPeriodDate(period, date, 1))}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {query.isFetching && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={period === "week" || excel.isPending}
            title={period === "week" ? "El Excel es de un mes, un trimestre o un año" : undefined}
            onClick={() => excel.mutate()}
          >
            {excel.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Descargar Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={receipts.isPending}
            title={`Justificantes de ${receiptsMonth}`}
            onClick={() => receipts.mutate()}
          >
            {receipts.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileArchive className="mr-1.5 h-4 w-4" />}
            Justificantes del mes (ZIP)
          </Button>
        </div>
      </div>

      {query.isError && !data && (
        <ErrorState
          title="No se pudo cargar el resumen"
          // Un periodo fuera del plazo de conservación es un 400 con su motivo
          message={query.error instanceof ApiError && query.error.status === 400 ? query.error.message : undefined}
          onRetry={() => query.refetch()}
        />
      )}
      {query.isPending && <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />}

      {data && <SummaryBody data={data} />}
    </div>
  );
}

function SummaryBody({ data }: { data: Summary }) {
  const ledgerMethods = Object.entries(data.byMethod.ledgerIncomeByPayment);
  const bizum = Object.entries(data.byMethod.bizumByReceiver);
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {formatDayKey(data.from, DAY)} – {formatDayKey(data.to, DAY)}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label="Ingresos"><Money cents={data.income.totalCents} /></Figure>
        <Figure label="Gastos"><Money cents={data.expenses.totalCents} /></Figure>
        <Figure label="Resultado"><Result cents={data.result} /></Figure>
        <Figure label="Margen" sub="Resultado entre ingresos">{formatMargin(data.marginPct)}</Figure>
      </div>

      {data.warnings.length > 0 && (
        <ul aria-label="Avisos del resumen" className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
          {data.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" /> {w}
            </li>
          ))}
        </ul>
      )}

      <Block title="Ingresos y gastos de los últimos 6 periodos">
        <div role="img" aria-label={seriesDescription(data.series)} className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.series} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke="#6b728033" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis
                width={56}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickFormatter={(v: number) => `${Math.round(v / 100).toLocaleString("es-ES")} €`}
              />
              <Tooltip
                contentStyle={{ background: "#1c1c1c", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}
                formatter={(v) => formatCents(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="incomeCents" name="Ingresos" fill={INCOME_COLOR} radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenseCents" name="Gastos" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Block>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Ingresos por fuente">
          <ul className="divide-y divide-border">
            {INCOME_SOURCES.filter((s) => data.income.bySource[s] !== 0 && s !== "LEDGER").map((s) => (
              <Row key={s} label={INCOME_SOURCE_LABEL[s]}><Money cents={data.income.bySource[s]} /></Row>
            ))}
            {data.income.contractCents > 0 && (
              <Row label="De ellas, contrato de pistas" sub><Money cents={data.income.contractCents} /></Row>
            )}
            {data.income.ledgerByCategory.map((c) => (
              <Row key={c.categoryId} label={`${INCOME_SOURCE_LABEL.LEDGER}: ${c.name}`}><Money cents={c.cents} /></Row>
            ))}
            <li className="flex items-baseline justify-between gap-3 pt-2 text-sm font-semibold text-foreground">
              <span>Total</span><Money cents={data.income.totalCents} />
            </li>
          </ul>
        </Block>

        <Block
          title="Gastos"
          note="Los pagos a entrenadores no son gasto: lo es lo que han devengado por sus horas. Las compras de cajas de la tienda ya cuentan solas."
        >
          <ul className="divide-y divide-border">
            {data.expenses.byCategory.map((c) => (
              <Row key={c.categoryId} label={c.name}><Money cents={c.cents} /></Row>
            ))}
            {data.expenses.coaches.accruedCents > 0 && (
              <Row label="Entrenadores (horas dadas)"><Money cents={data.expenses.coaches.accruedCents} /></Row>
            )}
            {data.expenses.shopPurchasesCents > 0 && (
              <Row label="Compras de la tienda"><Money cents={data.expenses.shopPurchasesCents} /></Row>
            )}
            {data.expenses.cardFeesCents > 0 && (
              <Row label="Comisión del datáfono"><Money cents={data.expenses.cardFeesCents} /></Row>
            )}
            <li className="flex items-baseline justify-between gap-3 pt-2 text-sm font-semibold text-foreground">
              <span>Total</span><Money cents={data.expenses.totalCents} />
            </li>
          </ul>
        </Block>
      </div>

      <Block
        title="Márgenes por actividad"
        note={`En la tienda, el gasto es el coste de lo vendido (${formatCents(data.shop.costOfSoldCents)}); en el total de gastos de arriba cuentan las compras de cajas.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Actividad</th>
                <th className="py-1 pr-3 text-right font-medium">Ingresos</th>
                <th className="py-1 pr-3 text-right font-medium">Gastos</th>
                <th className="py-1 text-right font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ACTIVITIES.map((a) => {
                const m = data.byActivity[a];
                return (
                  <tr key={a}>
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-foreground">{ACTIVITY_LABEL[a]}</th>
                    <td className="py-1.5 pr-3 text-right"><Money cents={m.incomeCents} /></td>
                    <td className="py-1.5 pr-3 text-right"><Money cents={m.expenseCents} /></td>
                    <td className="py-1.5 text-right"><Result cents={m.resultCents} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        title="Cómo se ha cobrado"
        note="Lo cobrado en el periodo por su fecha real, aunque la cuota o el bono cuenten en otro mes."
      >
        {Object.keys(data.byMethod.totalsByMethod).length === 0 ? (
          <p className="text-sm text-muted-foreground">No se ha cobrado nada en este periodo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {Object.entries(data.byMethod.totalsByMethod).map(([method, cents]) => (
              <Fragment key={method}>
                <Row label={METHOD_LABEL[method] ?? method}><Money cents={cents} /></Row>
                {method === "BIZUM" && bizum.map(([receiver, c]) => (
                  <Row key={receiver} label={`Móvil de ${receiver}`} sub><Money cents={c} /></Row>
                ))}
              </Fragment>
            ))}
          </ul>
        )}
        {ledgerMethods.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">Ingresos apuntados a mano, por forma de cobro</p>
            <ul className="divide-y divide-border">
              {ledgerMethods.map(([payment, cents]) => (
                <Row key={payment} label={PAYMENT_LABEL[payment as LedgerPayment] ?? payment}><Money cents={cents} /></Row>
              ))}
            </ul>
          </div>
        )}
      </Block>
    </>
  );
}
