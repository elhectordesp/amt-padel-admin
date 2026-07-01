/**
 * /mi-club/reservas — landing del módulo Reservas para CLUB admin.
 *
 * Muestra estado de activación + cards de navegación a cada sub-sección.
 * Si el módulo no está activado: bloquea + invita a solicitar activación.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Loader2,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { adminService } from "@/lib/services/admin";
import { useRole, isClub } from "@/lib/use-role";

export default function MiClubReservasPage() {
  const router = useRouter();
  const { role, clubId } = useRole();

  // Datos básicos del club para mostrar nombre en el header
  const myClubQuery = useQuery({
    queryKey: ["my-club", clubId],
    queryFn: () => adminService.clubs.findOne(clubId!),
    enabled: !!clubId && isClub(role),
    staleTime: 30_000,
  });

  const activationQuery = useQuery({
    queryKey: bookingsQK.activation(clubId ?? ""),
    queryFn: () => bookingsService.activation.state(clubId!),
    enabled: !!clubId && isClub(role),
  });

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isClub(role)) {
    return (
      <div className="p-6">
        <Header title="Reservas" />
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Esta página es solo para administradores de club. Si eres admin de
            AMT, accede al club desde la sección Clubes.
          </p>
        </div>
      </div>
    );
  }

  if (!clubId) {
    return (
      <div className="p-6">
        <Header title="Reservas" />
        <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium">Tu cuenta no está asociada a un club</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Contacta con el equipo de AMT para asignarte a un club.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activation = activationQuery.data;

  return (
    <div className="p-6">
      <Header title={`Reservas — ${myClubQuery.data?.name ?? ""}`} />

      {/* Estado de activación */}
      <div className="mt-6">
        <ActivationBanner
          loading={activationQuery.isLoading}
          state={activation}
          onAction={() => router.push("/mi-club/reservas/activacion")}
        />
      </div>

      {/* Grid de secciones de configuración */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard
          href="/mi-club/reservas/horarios"
          icon={<Clock className="h-5 w-5" />}
          title="Horarios"
          description="Apertura semanal del club + excepciones (festivos, cierres)"
        />
        <NavCard
          href="/mi-club/reservas/pistas"
          icon={<Settings className="h-5 w-5" />}
          title="Pistas + duraciones"
          description="Tipo (singles/dobles), indoor/outdoor, duraciones permitidas"
        />
        <NavCard
          href="/mi-club/reservas/precios"
          icon={<DollarSign className="h-5 w-5" />}
          title="Precios"
          description="Matriz por pista × día × franja × duración"
        />
        <NavCard
          href="/mi-club/reservas/extras"
          icon={<Sparkles className="h-5 w-5" />}
          title="Extras"
          description="Luz, palas, climatización — opcionales o obligatorios"
        />
        <NavCard
          href="/mi-club/reservas/configuracion"
          icon={<Settings className="h-5 w-5" />}
          title="Configuración"
          description="Política de cancelación, slots, open matches, social"
        />
        <NavCard
          href="/mi-club/reservas/normas"
          icon={<FileText className="h-5 w-5" />}
          title="Normas del club"
          description="Reglamento que aceptan los jugadores al reservar"
        />
        <NavCard
          href="/mi-club/reservas/activacion"
          icon={<Users className="h-5 w-5" />}
          title="Activación + Testers"
          description="Estado del módulo + usuarios que pueden probar antes de la apertura pública"
        />
        <NavCard
          href="/mi-club/reservas/bookings"
          icon={<CalendarDays className="h-5 w-5" />}
          title="Reservas de hoy"
          description="Listado en tiempo real + gestión de cancelaciones"
        />
        <NavCard
          href="/mi-club/reservas/calendario"
          icon={<Eye className="h-5 w-5" />}
          title="Calendario semanal"
          description="Vista general estilo Google Calendar"
        />
      </div>
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────

function ActivationBanner({
  loading,
  state,
  onAction,
}: {
  loading: boolean;
  state:
    | { status: "INACTIVE" | "TESTER_MODE" | "PUBLIC"; activeTesterCount: number; bookingPublicAt: string | null }
    | undefined;
  onAction: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!state || state.status === "INACTIVE") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium">El módulo de Reservas no está activado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Configura horarios, pistas, precios y extras, y solicita la
                activación al equipo de AMT cuando todo esté listo.
              </p>
            </div>
          </div>
          <Button onClick={onAction} size="sm">
            Solicitar activación <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }
  if (state.status === "TESTER_MODE") {
    return (
      <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Activado en modo prueba</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Solo los {state.activeTesterCount} usuarios marcados como tester pueden
                ver y reservar. Cuando estés listo, pasa a visibilidad pública.
              </p>
            </div>
          </div>
          <Button onClick={onAction} size="sm">
            Gestionar testers <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }
  // PUBLIC
  return (
    <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-6">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-green-500" />
        <div>
          <p className="text-sm font-medium">Visible públicamente</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cualquier usuario AMT en la zona puede ver tu club y reservar pistas.
            Desde {state.bookingPublicAt ? new Date(state.bookingPublicAt).toLocaleDateString("es-ES") : "—"}.
          </p>
        </div>
      </div>
    </div>
  );
}

function NavCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-muted/50"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
        <div className="flex-1">
          <p className="text-sm font-medium group-hover:text-primary">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

