"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Calendar, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";

function StatCard({
  label, value, sub, icon: Icon, loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        {loading
          ? <div className="h-8 w-24 rounded bg-secondary animate-pulse mt-1" />
          : <p className="text-3xl font-heading text-foreground">{value}</p>
        }
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="p-2.5 rounded-md bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)]">
        <Icon size={22} className="text-[#D4AF37]" />
      </div>
    </div>
  );
}

const ALERT_ICON: Record<string, React.ElementType> = {
  match:        Calendar,
  player:       Users,
  registration: Trophy,
  payment:      DollarSign,
  system:       AlertTriangle,
};

function AlertItem({ text, href, icon: Icon }: { text: string; href?: string; icon: React.ElementType }) {
  const inner = (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 hover:bg-secondary/50 px-1 rounded transition-colors cursor-pointer">
      <Icon size={14} className="text-[#D4AF37] shrink-0" />
      <span className="text-sm text-foreground flex-1">{text}</span>
      <span className="text-muted-foreground text-xs">›</span>
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn:  adminService.stats,
    refetchInterval: 60_000,
  });

  const { data: tournaments = [], isLoading: loadingTournaments } = useQuery({
    queryKey: ["tournaments"],
    queryFn:  adminService.tournaments.list,
  });

  const { data: alerts = [] } = useQuery({
    queryKey:       ["admin-alerts"],
    queryFn:        adminService.alerts,
    refetchInterval: 60_000,
  });

  const activeTournaments = tournaments.filter((t) => t.status !== "finished");

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        <div>
          <h2 className="font-heading text-2xl text-foreground">¡Bienvenido, Admin! 👋</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Aquí tienes el resumen de la plataforma.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard
            label="Torneos activos"
            value={stats?.activeTournaments ?? "—"}
            icon={Trophy}
            loading={isLoading}
          />
          <StatCard
            label="Jugadores inscritos"
            value={stats?.registeredPlayers ?? "—"}
            icon={Users}
            loading={isLoading}
          />
          <StatCard
            label="Partidos programados"
            value={stats?.scheduledMatches ?? "—"}
            sub="Hoy"
            icon={Calendar}
            loading={isLoading}
          />
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Alertas */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">
                Alertas
                {alerts.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#D4AF37] text-[#0C0C0C] text-[9px] font-bold">
                    {alerts.length}
                  </span>
                )}
              </h3>
            </div>
            {alerts.length === 0 ? (
              <div className="py-6 text-center">
                <TrendingUp size={24} className="text-green-400 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Todo en orden</p>
              </div>
            ) : (
              <div>
                {alerts.map((a) => {
                  const Icon = ALERT_ICON[a.type] ?? AlertTriangle;
                  return <AlertItem key={a.id} icon={Icon} text={a.message} href={a.href} />;
                })}
              </div>
            )}
          </div>

          {/* Torneos próximos */}
          <div className="xl:col-span-2 bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">Torneos activos y próximos</h3>
              <a href="/torneos" className="text-xs text-[#D4AF37] hover:underline">Ver todos</a>
            </div>
            {loadingTournaments
              ? <div className="space-y-3">{[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 rounded bg-secondary animate-pulse" />
                ))}</div>
              : activeTournaments.length === 0
                ? <p className="text-sm text-muted-foreground py-6 text-center">No hay torneos activos</p>
                : <div className="space-y-0">
                    {activeTournaments.slice(0, 5).map((t) => {
                      const totalSpots      = t.categories.reduce((s, c) => s + c.totalSpots, 0);
                      const totalRegistered = t.categories.reduce((s, c) => s + c.registeredCount, 0);
                      const statusColor = t.status === "open" ? "text-green-400" : t.status === "ongoing" ? "text-yellow-400" : "text-muted-foreground";
                      const statusLabel = t.status === "open" ? "Abierto" : t.status === "ongoing" ? "En curso" : "Finalizado";
                      return (
                        <div key={t.id} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
                          <div className="w-8 h-8 rounded bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
                            <Trophy size={14} className="text-[#D4AF37]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{t.name}</p>
                            <p className="text-[11px] text-muted-foreground">{t.dates} · {t.venue}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] text-muted-foreground">{totalRegistered}/{totalSpots}</p>
                            <p className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
