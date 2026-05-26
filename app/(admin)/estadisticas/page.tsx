"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Users, CheckCircle, XCircle, Flame } from "lucide-react";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";

const GENDER_LABEL: Record<string, string> = { M: "Masc.", F: "Fem." };
const LEVEL_SHORT: Record<string, string> = {
  "1a": "1ª", "2a": "2ª", "3a": "3ª", "4a": "4ª", "5a": "5ª", "6a": "6ª", iniciacion: "Inic.",
};

function StatCard({
  icon: Icon, label, value, sub, color = "text-[#D4AF37]",
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-4">
      <div className="p-2 rounded-md bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] shrink-0">
        <Icon size={16} className={color} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-heading font-bold mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const GOLD = "#D4AF37";

export default function EstadisticasPage() {
  const season = new Date().getFullYear();
  const { data, isLoading, isError } = useQuery({
    queryKey:  ["growth-stats", season],
    queryFn:   () => adminService.growthStats(season),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="flex flex-col min-h-full">
      <Header title={`Estadísticas · Temporada ${season}`} />

      <div className="flex-1 p-6 space-y-6">
        {isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-card border border-border animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Error al cargar estadísticas
          </div>
        )}

        {data && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={CheckCircle}
                label="Conversión inscripción→confirmación"
                value={`${data.conversion.rate}%`}
                sub={`${data.conversion.confirmed} confirmadas de ${data.conversion.total}`}
                color="text-green-400"
              />
              <StatCard
                icon={XCircle}
                label="Tasa de cancelación"
                value={`${data.cancellationRate}%`}
                sub="sobre el total de inscripciones"
                color={data.cancellationRate > 20 ? "text-red-400" : "text-[#D4AF37]"}
              />
              <StatCard
                icon={Users}
                label="Jugadores registrados"
                value={data.players.total}
                sub={`${data.players.newThisSeason} nuevos en ${season} (${data.players.newPct}%)`}
              />
              <StatCard
                icon={TrendingUp}
                label="Semana más activa (últimas 12)"
                value={Math.max(...data.weeklyRegistrations.map((w) => w.count))}
                sub="inscripciones en una semana"
              />
            </div>

            {/* Weekly chart */}
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp size={14} className="text-[#D4AF37]" />
                Inscripciones por semana (últimas 12)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.weeklyRegistrations} barCategoryGap="30%">
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickFormatter={(v) => {
                      const d = new Date(v + "T12:00:00");
                      return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: "#1c1c1c", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}
                    labelFormatter={(v) => {
                      const d = new Date(v + "T12:00:00");
                      return `Semana del ${d.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`;
                    }}
                    formatter={(v: number) => [v, "inscripciones"]}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {data.weeklyRegistrations.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.count === Math.max(...data.weeklyRegistrations.map((w) => w.count)) ? GOLD : "#2a2a2a"}
                        stroke={GOLD}
                        strokeWidth={0.5}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* High demand categories */}
            {data.highDemandCategories.length > 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
                  <Flame size={14} className="text-[#D4AF37]" />
                  <h3 className="text-sm font-semibold text-foreground">Categorías con lista de espera</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        {["Torneo", "Categoría", "Plazas", "Inscritos", "En espera"].map((h) => (
                          <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.highDemandCategories.map((cat, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3 text-sm text-foreground">{cat.tournamentName}</td>
                          <td className="px-5 py-3 text-sm text-muted-foreground">
                            {GENDER_LABEL[cat.gender] ?? cat.gender} {LEVEL_SHORT[cat.level] ?? cat.level}
                          </td>
                          <td className="px-5 py-3 text-sm text-foreground">{Math.floor(cat.totalSpots / 2)}</td>
                          <td className="px-5 py-3 text-sm text-foreground">{Math.floor(cat.registered / 2)}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-400/10 border border-red-400/30 text-red-400">
                              +{Math.floor(cat.overflow / 2)} espera
                            </span>
                          </td>
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
