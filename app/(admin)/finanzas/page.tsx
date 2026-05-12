"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, DollarSign, Receipt, PieChart } from "lucide-react";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";

const VAT_RATE = 0.21;

function fmt(n: number) {
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
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
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name === "revenue" ? "Ingresos" : "Beneficio"}: {fmt(p.value)} €
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

  const { data, isLoading } = useQuery({
    queryKey: ["finance", period],
    queryFn:  () => adminService.finance.stats(period),
  });

  // Use backend values directly — avoid frontend rounding drift
  const totalWithVat    = data?.revenue.total   ?? 0;
  const vatAmount       = data?.profit.vatAmount ?? 0;
  const totalWithoutVat = totalWithVat - vatAmount;
  const costsWithVat    = Math.abs(data?.costs.total ?? 0);
  const netProfit       = data?.profit.net ?? 0;
  const grossProfit     = data?.profit.gross ?? 0;

  const tableRows = [
    {
      concept: "Ingresos por inscripciones",
      withVat: data?.revenue.registrations ?? 0,
      color:   "text-foreground",
    },
    {
      concept: "Patrocinios",
      withVat: data?.revenue.sponsorships ?? 0,
      color:   "text-foreground",
    },
    {
      concept: "Merchandising / Otros",
      withVat: data?.revenue.merchandise ?? 0,
      color:   "text-foreground",
    },
  ];

  const breakdownItems = [
    { label: "Ingresos inscripciones", value: data?.revenue.registrations ?? 0, total: totalWithVat, color: "#D4AF37" },
    { label: "Patrocinios",            value: data?.revenue.sponsorships   ?? 0, total: totalWithVat, color: "#888880" },
    { label: "Merchandising / Otros",  value: data?.revenue.merchandise    ?? 0, total: totalWithVat, color: "#CD7F32" },
    { label: "Gastos operativos",      value: costsWithVat,                       total: totalWithVat, color: "#EB5757" },
  ].filter((i) => i.value > 0);

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Finanzas" />

      <div className="flex-1 p-6 space-y-6">

        {/* Period selector */}
        <div className="flex items-center gap-3">
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
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Ingresos (con IVA)"
            value={isLoading ? "—" : `${fmt(totalWithVat)} €`}
            icon={DollarSign}
          />
          <StatCard
            label="Ingresos (sin IVA)"
            value={isLoading ? "—" : `${fmt(totalWithoutVat)} €`}
            sub={`IVA: ${fmt(vatAmount)} €`}
            icon={Receipt}
          />
          <StatCard
            label="Beneficio bruto"
            value={isLoading ? "—" : `${fmt(grossProfit)} €`}
            icon={TrendingUp}
            positive
          />
          <StatCard
            label="Beneficio neto"
            value={isLoading ? "—" : `${fmt(netProfit)} €`}
            sub="Sin IVA"
            icon={PieChart}
            positive
          />
        </div>

        {/* Chart + Breakdown */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Area chart */}
          <div className="xl:col-span-2 bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-foreground">Evolución mensual</h3>
            </div>
            {isLoading ? (
              <div className="h-48 bg-secondary/50 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.chart ?? []} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
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
                    tick={{ fontSize: 11, fill: "#888880" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#888880" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}€`}
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
                <span className="w-3 h-0.5 bg-[#D4AF37] inline-block rounded" /> Ingresos
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
                <span className="text-foreground font-medium">{fmt(totalWithVat)} €</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Gastos operativos</span>
                <span className="text-destructive font-medium">-{fmt(costsWithVat)} €</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-border">
                <span className="text-foreground font-semibold">Beneficio neto</span>
                <span className="text-[#D4AF37] font-bold">{fmt(netProfit)} €</span>
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["CONCEPTO", "CON IVA", "SIN IVA", "IVA (21%)"].map((h) => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${h === "CONCEPTO" ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const withoutVat = row.withVat / (1 + VAT_RATE);
                const vat        = row.withVat - withoutVat;
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
                <td className="px-5 py-3 text-sm font-bold text-right text-[#D4AF37]">{fmt(totalWithVat)} €</td>
                <td className="px-5 py-3 text-sm font-bold text-right text-[#D4AF37]">{fmt(totalWithoutVat)} €</td>
                <td className="px-5 py-3 text-sm font-bold text-right text-[#D4AF37]">{fmt(vatAmount)} €</td>
              </tr>

              {/* Gastos */}
              <tr className="border-b border-border hover:bg-secondary/30 transition-colors">
                <td className="px-5 py-3 text-sm text-muted-foreground">Gastos operativos</td>
                <td className="px-5 py-3 text-sm text-right text-destructive">-{fmt(costsWithVat)} €</td>
                <td className="px-5 py-3 text-sm text-right text-destructive">-{fmt(costsWithVat / (1 + VAT_RATE))} €</td>
                <td className="px-5 py-3 text-sm text-right text-muted-foreground">-{fmt(costsWithVat - costsWithVat / (1 + VAT_RATE))} €</td>
              </tr>

              {/* Beneficio neto */}
              <tr className="bg-[rgba(212,175,55,0.06)]">
                <td className="px-5 py-3.5 text-sm font-bold text-[#D4AF37]">BENEFICIO NETO</td>
                <td className="px-5 py-3.5 text-sm font-bold text-right text-[#D4AF37]">{fmt(grossProfit)} €</td>
                <td className="px-5 py-3.5 text-sm font-bold text-right text-[#D4AF37]">{fmt(netProfit)} €</td>
                <td className="px-5 py-3.5 text-sm font-bold text-right text-[#D4AF37]">{fmt(data?.profit.vatAmount ?? 0)} €</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
