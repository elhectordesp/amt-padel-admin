"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Calendar, DollarSign, TrendingUp, AlertTriangle, Activity, Clock } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import { formatDateRange } from "@/lib/utils/formatDateRange";
import { useRole, isClub } from "@/lib/use-role";

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

function ErrorCard({ message = "Error al cargar los datos" }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">
      <AlertTriangle size={14} className="shrink-0" />
      {message}
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
  const clickable = !!href;
  const inner = (
    <div className={`flex items-center gap-3 py-2.5 border-b border-border last:border-0 px-1 rounded transition-colors ${
      clickable ? "hover:bg-secondary/50 cursor-pointer" : "cursor-default"
    }`}>
      <Icon size={14} className="text-[#D4AF37] shrink-0" />
      <span className="text-sm text-foreground flex-1">{text}</span>
      {clickable && <span className="text-muted-foreground text-xs">›</span>}
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

function useAdminUser() {
  return useQuery({
    queryKey:  ["admin-me"],
    queryFn:   adminService.me,
    staleTime: Infinity,
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { role } = useRole();

  // Un CLUB no tiene acceso al dashboard global (stats/finanzas son AMT-only).
  // Lo mandamos a su listado de torneos, su pantalla por defecto.
  useEffect(() => {
    if (isClub(role)) router.replace("/torneos");
  }, [role, router]);

  const { data: adminUser } = useAdminUser();

  const { data: stats, isLoading, isError: statsError } = useQuery({
    queryKey:        ["admin-stats"],
    queryFn:         adminService.stats,
    staleTime:       30_000,
    refetchInterval: 60_000,
  });

  const { data: tournaments = [], isLoading: loadingTournaments, isError: tournamentsError } = useQuery({
    queryKey:  ["tournaments"],
    queryFn:   adminService.tournaments.list,
    staleTime: 60_000,
  });

  const { data: alerts = [], isError: alertsError } = useQuery({
    queryKey:        ["admin-alerts"],
    queryFn:         adminService.alerts,
    staleTime:       30_000,
    refetchInterval: 60_000,
  });

  const { data: activity = [], isError: activityError } = useQuery({
    queryKey:        ["admin-activity"],
    queryFn:         adminService.activity,
    staleTime:       30_000,
    refetchInterval: 60_000,
  });

  const activeTournaments = tournaments.filter((t) => {
    const st = t.status?.toUpperCase();
    return st !== "FINISHED" && st !== "CANCELLED";
  });

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Dashboard" />

      <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h2 className="font-heading text-2xl text-foreground">
            ¡Bienvenido{adminUser?.name ? `, ${adminUser.name.split(" ")[0]}` : ""}! 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Aquí tienes el resumen de la plataforma.</p>
        </div>

        {/* Stats */}
        {statsError ? (
          <ErrorCard message="No se pudieron cargar las estadísticas" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
        )}

        {/* Middle row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

          {/* Col 1: alertas + actividad */}
          <div className="space-y-5">
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
              {alertsError ? (
                <ErrorCard message="No se pudieron cargar las alertas" />
              ) : alerts.length === 0 ? (
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

            {/* Activity feed */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={15} className="text-[#D4AF37]" />
                <h3 className="font-semibold text-foreground text-sm">Actividad reciente</h3>
              </div>
              {activityError ? (
                <ErrorCard message="No se pudo cargar la actividad reciente" />
              ) : activity.length === 0 ? (
                <div className="py-6 text-center">
                  <Clock size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Sin actividad reciente</p>
                </div>
              ) : (
                <div>
                  {activity.slice(0, 8).map((item) => {
                    const inner = (
                      <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-snug">{item.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                        </div>
                      </div>
                    );
                    return item.href
                      ? <a key={item.id} href={item.href} className="block hover:bg-secondary/50 -mx-1 px-1 rounded transition-colors">{inner}</a>
                      : <div key={item.id}>{inner}</div>;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Col 2-3: Torneos próximos */}
          <div className="xl:col-span-2 bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">Torneos activos y próximos</h3>
              <Link href="/torneos" className="text-xs text-[#D4AF37] hover:underline">Ver todos</Link>
            </div>
            {tournamentsError ? (
              <ErrorCard message="No se pudieron cargar los torneos" />
            ) : loadingTournaments
              ? <div className="space-y-3">{[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 rounded bg-secondary animate-pulse" />
                ))}</div>
              : activeTournaments.length === 0
                ? <p className="text-sm text-muted-foreground py-6 text-center">No hay torneos activos</p>
                : <div className="space-y-0">
                    {activeTournaments.slice(0, 5).map((t) => {
                      const totalSpots      = t.categories.reduce((s, c) => s + c.totalSpots, 0);
                      const totalRegistered = t.categories.reduce((s, c) => s + c.registeredCount, 0);
                      const st = t.status?.toLowerCase();
                      const statusColor = st === "open" ? "text-green-400" : st === "draw" ? "text-purple-400" : st === "scheduled" ? "text-cyan-400" : st === "ongoing" ? "text-yellow-400" : st === "draft" ? "text-blue-400" : "text-muted-foreground";
                      const statusLabel = st === "open" ? "Abierto" : st === "draw" ? "Sorteo" : st === "scheduled" ? "Programado" : st === "ongoing" ? "En curso" : st === "draft" ? "Borrador" : st === "cancelled" ? "Cancelado" : "Finalizado";
                      return (
                        <Link
                          key={t.id}
                          href={`/torneos/${t.id}`}
                          className="flex items-center gap-4 py-2.5 border-b border-border last:border-0 hover:bg-secondary/40 -mx-5 px-5 transition-colors rounded"
                        >
                          <div className="w-8 h-8 rounded bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
                            <Trophy size={14} className="text-[#D4AF37]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{t.name}</p>
                            <p className="text-[11px] text-muted-foreground">{formatDateRange(t.startDate, t.endDate)} · {t.club?.name ?? ""}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] text-muted-foreground">{totalRegistered}/{totalSpots}</p>
                            <p className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</p>
                          </div>
                        </Link>
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

