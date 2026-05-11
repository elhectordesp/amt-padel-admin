"use client";

import { Trophy, Users, Calendar, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { Header } from "@/components/admin/header";

// Stat card component
function StatCard({
  label, value, sub, icon: Icon, trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-heading text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {trend && (
          <p className={`text-xs font-semibold ${trend.positive ? "text-green-400" : "text-destructive"}`}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
      <div className="p-2.5 rounded-md bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)]">
        <Icon size={22} className="text-[#D4AF37]" />
      </div>
    </div>
  );
}

// Alert item component
function AlertItem({ text, icon: Icon }: { text: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/50 px-1 rounded transition-colors">
      <Icon size={14} className="text-[#D4AF37] shrink-0" />
      <span className="text-sm text-foreground flex-1">{text}</span>
      <span className="text-muted-foreground text-xs">›</span>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-full">
      <Header title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="font-heading text-2xl text-foreground">¡Bienvenido, Admin! 👋</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Aquí tienes el resumen de la plataforma.</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard
            label="Torneos activos"
            value="12"
            sub="3 nuevos esta semana"
            icon={Trophy}
          />
          <StatCard
            label="Jugadores inscritos"
            value="1.248"
            icon={Users}
            trend={{ value: "12% vs semana pasada", positive: true }}
          />
          <StatCard
            label="Partidos programados"
            value="86"
            sub="Hoy: 12 partidos"
            icon={Calendar}
          />
          <StatCard
            label="Ingresos (con IVA)"
            value="24.850 €"
            icon={DollarSign}
            trend={{ value: "18% vs mes pasado", positive: true }}
          />
          <StatCard
            label="Beneficio (sin IVA)"
            value="18.750 €"
            icon={TrendingUp}
            trend={{ value: "16% vs mes pasado", positive: true }}
          />
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Alertas */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">Alertas y notificaciones</h3>
              <button className="text-xs text-[#D4AF37] hover:underline">Ver todas →</button>
            </div>
            <div>
              <AlertItem icon={AlertTriangle} text="3 partidos sin pista asignada" />
              <AlertItem icon={Users}         text="5 jugadores sin disponibilidad completa" />
              <AlertItem icon={Trophy}        text="2 categorías a punto de llenarse" />
              <AlertItem icon={DollarSign}    text="Pago pendiente de 7 jugadores" />
              <AlertItem icon={AlertTriangle} text="1 solicitud de cambio de categoría" />
            </div>
          </div>

          {/* Próximos torneos */}
          <div className="xl:col-span-2 bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">Torneos próximos</h3>
              <button className="text-xs text-[#D4AF37] hover:underline">Ver todos</button>
            </div>
            <div className="space-y-3">
              {[
                { name: "AMT SILVER BARCELONA", dates: "31 May · 2 Jun 2024", venue: "Club Bruc Pàdel · Barcelona",   cat: "Masc. A / B", spots: "48/64", status: "Abierto",    statusColor: "text-green-400"  },
                { name: "AMT BRONZE VALENCIA",  dates: "7-9 Jun 2024",        venue: "Indoor Pàdel Valencia",         cat: "Mixto A / B", spots: "32/48", status: "Abierto",    statusColor: "text-green-400"  },
                { name: "AMT GOLD MARBELLA",    dates: "14-16 Jun 2024",      venue: "Club Nueva Alcántara · Marbella", cat: "Masc. A",   spots: "28/32", status: "Casi lleno", statusColor: "text-orange-400" },
                { name: "AMT SILVER SEVILLA",   dates: "21-23 Jun 2024",      venue: "Sevilla Pàdel Center",          cat: "Femen. A / B", spots: "16/32", status: "Abierto", statusColor: "text-green-400"  },
              ].map((t) => (
                <div key={t.name} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
                    <Trophy size={14} className="text-[#D4AF37]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.dates} · {t.venue}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-muted-foreground">{t.cat}</p>
                    <p className="text-[11px] text-muted-foreground">{t.spots} inscritos</p>
                  </div>
                  <span className={`text-[10px] font-semibold ${t.statusColor} w-16 text-right`}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
