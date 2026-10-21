"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, DollarSign, Receipt, PieChart, Download, Wallet, Hourglass } from "lucide-react";
import { downloadCsv } from "@/lib/utils/csv";
import { DEFAULT_VAT_RATE, splitVat, vatSplitOf, type VatSplit } from "@/lib/utils/finance";
import { Header } from "@/components/admin/header";
import { ErrorState } from "@/components/admin/error-state";
import { adminService } from "@/lib/services/admin";

const EUR = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmt(n: number) {
  return EUR.format(n);
}

/** Un importe, o «—» si el back todavía no lo manda. */
function fmtOrDash(n: number | null | undefined) {
  return n == null ? "—" : `${fmt(n)} €`;
}

function StatCard({
  label, value, sub, icon: Icon, positive,
}: {
  label:    string;
  value:    string;
  sub?:     string;
  icon:     React.ElementType;
  positive?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-heading text-foreground">{value}</p>
        {sub && (
          <p className={`text-xs font-medium ${positive ? "text-green-400" : "text-muted-foreground"}`}>
            {sub}
          </p>
        )}
      </div>
      <div className="p-2.5 rounded-md bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)]">
        <Icon size={20} className="text-[#D4AF37]" />
      </div>
    </div>
  );
}

// Custom tooltip for the chart
type TooltipPayloadEntry = { name: string; value: number; color: string };
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p: TooltipPayloadEntry) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name === "revenue" ? "Devengado" : "Beneficio"}: {fmt(p.value)} €
        </p>
      ))}
    </div>
  );
}

// Breakdown bar (visual split of revenue sources)
function BreakdownBar({ items }: { items: { label: string; value: number; total: number; color: string }[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
        return (
          <div key={item.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="text-foreground font-medium">{pct}% · {fmt(item.value)} €</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FinanzasPage() {
  const [period, setPeriod] = useState<"month" | "year">("month");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["finance", period],
    queryFn:  () => adminService.finance.stats(period),
  });

  const periodText = period === "month" ? "este mes" : "este año";
  // El IVA va incluido en los precios: sin IVA = importe ÷ (1 + IVA). La base
  // y la cuota, las que manda el back; splitVat solo si no vienen
  const vatRate = data?.vatRate ?? DEFAULT_VAT_RATE;
  const vatPct  = Math.round(vatRate * 100);
  // Devengado: el precio de cada pareja confirmada, haya pagado o no
  const accrued     = data?.revenue.registrations ?? 0;
  // Cobrado: la mitad del precio por jugador que ha pagado; pendiente: lo que falta
  const collected   = data?.revenue.collected;
  const outstanding = data?.revenue.outstanding;
  const confirmedPairs = (data?.byTournament ?? []).reduce((s, t) => s + t.registrations, 0);
  // Total de ingresos (inscripciones + patrocinios + otros), gastos y beneficio
  const income = vatSplitOf(data?.revenue.total ?? 0, data?.revenue, vatRate);
  const costsTotal = Math.abs(data?.costs.total ?? 0);
  const costs = vatSplitOf(
    costsTotal,
    data?.costs.withoutVat != null && data.costs.vatAmount != null
      ? { withoutVat: Math.abs(data.costs.withoutVat), vatAmount: Math.abs(data.costs.vatAmount) }
      : undefined,
    vatRate,
  );
  const profit = vatSplitOf(
    data?.profit.gross ?? 0,
    data ? { withoutVat: data.profit.net, vatAmount: data.profit.vatAmount } : undefined,
    vatRate,
  );
  // Una fila igual al total (lo normal: solo hay inscripciones) usa la misma base y cuota
  const rowVat = (amount: number): VatSplit => (amount === income.withVat ? income : splitVat(amount, vatRate));

  const tableRows = [
    { concept: "Inscripciones (devengado)", withVat: data?.revenue.registrations ?? 0 },
    { concept: "Patrocinios",               withVat: data?.revenue.sponsorships  ?? 0 },
    { concept: "Merchandising / Otros",     withVat: data?.revenue.merchandise   ?? 0 },
  ];

  const breakdownItems = [
    { label: "Inscripciones (devengado)", value: data?.revenue.registrations ?? 0, total: income.withVat, color: "#D4AF37" },
    { label: "Patrocinios",               value: data?.revenue.sponsorships  ?? 0, total: income.withVat, color: "#888880" },
    { label: "Merchandising / Otros",     value: data?.revenue.merchandise   ?? 0, total: income.withVat, color: "#CD7F32" },
    { label: "Gastos operativos",         value: costs.withVat,                     total: income.withVat, color: "#EB5757" },
  ].filter((i) => i.value > 0);

  const exportCsv = () => {
    const line = (concept: string, v: VatSplit, sign = 1) => ({
      Concepto:      concept,
      "Con IVA (€)": fmt(sign * v.withVat),
      "Sin IVA (€)": fmt(sign * v.withoutVat),
      "IVA (€)":     fmt(sign * v.vat),
    });
    downloadCsv(`finanzas-${period}`, [
      ...tableRows.map((r) => line(r.concept, rowVat(r.withVat))),
      line("TOTAL INGRESOS", income),
      line("Gastos operativos", costs, -1),
      line("BENEFICIO NETO", profit),
      ...(collected   != null ? [line("Cobrado (inscripciones del periodo)", splitVat(collected, vatRate))] : []),
      ...(outstanding != null ? [line("Pendiente de cobro (inscripciones del periodo)", splitVat(outstanding, vatRate))] : []),
    ]);
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Finanzas" />

      <div className="flex-1 p-6 space-y-6">

        {/* Period selector + export */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {([
              { key: "month", label: "Este mes" },
              { key: "year",  label: "Este año"  },
            ] as { key: "month" | "year"; label: string }[]).map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  period === p.key
                    ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={exportCsv}
            disabled={!data}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#D4AF37] disabled:opacity-40 transition-colors"
          >
            <Download size={13} /> Exportar P&L
          </button>
        </div>

        {isError ? (
          <div className="bg-card border border-border rounded-lg">
            <ErrorState message="No se pudieron cargar las finanzas." onRetry={() => refetch()} />
          </div>
        ) : (
        <>
        {/* KPI cards: cobrado, pendiente de cobro y devengado; luego el P&L */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            <StatCard
              label="Cobrado"
              value={isLoading ? "—" : fmtOrDash(collected)}
              sub={data ? `De ${fmt(accrued)} € devengados` : undefined}
              icon={Wallet}
            />
            <StatCard
              label="Pendiente de cobro"
              value={isLoading ? "—" : fmtOrDash(outstanding)}
              sub={data ? "De las parejas confirmadas" : undefined}
              icon={Hourglass}
            />
            <StatCard
              label="Devengado"
              value={isLoading ? "—" : `${fmt(accrued)} €`}
              sub={data ? `${confirmedPairs} pareja${confirmedPairs === 1 ? "" : "s"} confirmada${confirmedPairs === 1 ? "" : "s"} × precio` : undefined}
              icon={DollarSign}
            />
            <StatCard
              label="Ingresos (sin IVA)"
              value={isLoading ? "—" : `${fmt(income.withoutVat)} €`}
              sub={data ? `IVA: ${fmt(income.vat)} €` : undefined}
              icon={Receipt}
            />
            <StatCard
              label="Beneficio bruto"
              value={isLoading ? "—" : `${fmt(profit.withVat)} €`}
              icon={TrendingUp}
              positive
            />
            <StatCard
              label="Beneficio neto"
              value={isLoading ? "—" : `${fmt(profit.withoutVat)} €`}
              sub={data ? "Sin IVA" : undefined}
              icon={PieChart}
              positive
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Cifras de las inscripciones dadas de alta {periodText} (por su fecha de inscripción): lo cobrado y lo pendiente son de esas parejas, no lo que ha entrado en caja {periodText}. Importes con IVA incluido.
          </p>
        </div>

        {/* Chart + Breakdown */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Area chart */}
          <div className="xl:col-span-2 bg-card border border-border rounded-lg p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <h3 className="text-sm font-semibold text-foreground">Evolución mensual</h3>
            </div>
            {isLoading ? (
              <div className="h-56 sm:h-48 bg-secondary/50 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data?.chart ?? []} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#D4AF37" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#27AE60" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#27AE60" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#888880" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#888880" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}€`}
                    width={60}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#D4AF37"
                    strokeWidth={2}
                    fill="url(#revGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#27AE60"
                    strokeWidth={2}
                    fill="url(#profGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-5 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-0.5 bg-[#D4AF37] inline-block rounded" /> Devengado
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Beneficio
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Desglose</h3>
            {isLoading
              ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-6 rounded bg-secondary animate-pulse" />)}</div>
              : <BreakdownBar items={breakdownItems} />
            }

            <div className="mt-5 pt-4 border-t border-border space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Ingresos totales</span>
                <span className="text-foreground font-medium">{fmt(income.withVat)} €</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Gastos operativos</span>
                <span className="text-destructive font-medium">-{fmt(costs.withVat)} €</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-border">
                <span className="text-foreground font-semibold">Beneficio neto</span>
                <span className="text-[#D4AF37] font-bold">{fmt(profit.withoutVat)} €</span>
              </div>
            </div>
          </div>
        </div>

        {/* P&L table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Balance de beneficios <span className="text-muted-foreground font-normal">({period === "month" ? "Mensual" : "Anual"})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["CONCEPTO", "CON IVA", "SIN IVA", `IVA (${vatPct}%)`].map((h) => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${h === "CONCEPTO" ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const { withoutVat, vat } = rowVat(row.withVat);
                return (
                  <tr key={row.concept} className="border-b border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 text-sm text-muted-foreground">{row.concept}</td>
                    <td className="px-5 py-3 text-sm text-right text-foreground">{fmt(row.withVat)} €</td>
                    <td className="px-5 py-3 text-sm text-right text-foreground">{fmt(withoutVat)} €</td>
                    <td className="px-5 py-3 text-sm text-right text-muted-foreground">{fmt(vat)} €</td>
                  </tr>
                );
              })}

              {/* Total ingresos */}
              <tr className="border-b border-border bg-[rgba(212,175,55,0.04)]">
                <td className="px-5 py-3 text-sm font-bold text-[#D4AF37]">TOTAL INGRESOS</td>
                <td className="px-5 py-3 text-sm font-bold text-right text-[#D4AF37]">{fmt(income.withVat)} €</td>
                <td className="px-5 py-3 text-sm font-bold text-right text-[#D4AF37]">{fmt(income.withoutVat)} €</td>
                <td className="px-5 py-3 text-sm font-bold text-right text-[#D4AF37]">{fmt(income.vat)} €</td>
              </tr>

              {/* Gastos */}
              <tr className="border-b border-border hover:bg-secondary/30 transition-colors">
                <td className="px-5 py-3 text-sm text-muted-foreground">Gastos operativos</td>
                <td className="px-5 py-3 text-sm text-right text-destructive">-{fmt(costs.withVat)} €</td>
                <td className="px-5 py-3 text-sm text-right text-destructive">-{fmt(costs.withoutVat)} €</td>
                <td className="px-5 py-3 text-sm text-right text-muted-foreground">-{fmt(costs.vat)} €</td>
              </tr>

              {/* Beneficio neto */}
              <tr className="bg-[rgba(212,175,55,0.06)]">
                <td className="px-5 py-3.5 text-sm font-bold text-[#D4AF37]">BENEFICIO NETO</td>
                <td className="px-5 py-3.5 text-sm font-bold text-right text-[#D4AF37]">{fmt(profit.withVat)} €</td>
                <td className="px-5 py-3.5 text-sm font-bold text-right text-[#D4AF37]">{fmt(profit.withoutVat)} €</td>
                <td className="px-5 py-3.5 text-sm font-bold text-right text-[#D4AF37]">{fmt(profit.vat)} €</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>

        {/* Desglose por torneo */}
        {data?.byTournament && data.byTournament.length > 0 && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Desglose por torneo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Parejas confirmadas inscritas {periodText}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    {["TORNEO", "PAREJAS", "COBRADO", "PENDIENTE", "DEVENGADO"].map((h) => (
                      <th key={h} className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${h === "TORNEO" ? "text-left" : "text-right"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byTournament.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3 text-sm text-foreground">{t.name}</td>
                      <td className="px-5 py-3 text-sm text-right text-muted-foreground">{t.registrations}</td>
                      <td className="px-5 py-3 text-sm text-right text-[#D4AF37] font-medium whitespace-nowrap">{fmtOrDash(t.collected)}</td>
                      <td className="px-5 py-3 text-sm text-right text-muted-foreground whitespace-nowrap">{fmtOrDash(t.outstanding)}</td>
                      <td className="px-5 py-3 text-sm text-right text-foreground whitespace-nowrap">{fmt(t.revenue)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
        )}

      </div>
    </div>
  );
}
