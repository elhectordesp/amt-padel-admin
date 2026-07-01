/**
 * /mi-club/reservas/bookings — listado de reservas + acciones admin.
 *
 * Tabs: Hoy / Próximas / Histórico / Todas. Filtros adicionales por estado.
 * Cada reserva: hora, pista, jugadores, estado, pago, acciones (cancelar).
 */

"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import type {
  Booking,
  BookingFiltersQuery,
  BookingStatus,
} from "@/types/bookings";

type Tab = "today" | "upcoming" | "history" | "all";

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_INVITES: "Esperando invitaciones",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  WITHOUT_RESULT: "Sin resultado",
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING_INVITES: "bg-amber-500/15 text-amber-500",
  CONFIRMED: "bg-blue-500/15 text-blue-500",
  IN_PROGRESS: "bg-green-500/15 text-green-500",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/15 text-destructive",
  WITHOUT_RESULT: "bg-muted text-muted-foreground",
};

export default function BookingsListPage() {
  const { role, clubId } = useRole();
  const [tab, setTab] = useState<Tab>("today");

  const filters = useMemo<BookingFiltersQuery>(() => {
    if (!clubId) return {};
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const base: BookingFiltersQuery = { clubId, limit: 50 };
    if (tab === "today") {
      return {
        ...base,
        fromDate: start.toISOString(),
        toDate: end.toISOString(),
      };
    }
    if (tab === "upcoming") {
      return { ...base, fromDate: end.toISOString() };
    }
    if (tab === "history") {
      return { ...base, toDate: start.toISOString() };
    }
    return base;
  }, [clubId, tab]);

  const query = useQuery({
    queryKey: bookingsQK.bookingsList(filters),
    queryFn: () => bookingsService.bookings.list(filters),
    enabled: !!clubId && isClub(role),
  });

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isClub(role) || !clubId) {
    return (
      <div className="p-6">
        <BackLink />
        <Header title="Reservas" />
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </div>
    );
  }

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div className="p-6">
      <BackLink />
      <Header title="Reservas" />
      <p className="mt-2 text-sm text-muted-foreground">
        Listado de reservas de tu club. Cancelar aquí notifica automáticamente
        a los jugadores con el motivo opcional.
      </p>

      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === "today"} onClick={() => setTab("today")}>
            Hoy
          </TabButton>
          <TabButton
            active={tab === "upcoming"}
            onClick={() => setTab("upcoming")}
          >
            Próximas
          </TabButton>
          <TabButton
            active={tab === "history"}
            onClick={() => setTab("history")}
          >
            Histórico
          </TabButton>
          <TabButton active={tab === "all"} onClick={() => setTab("all")}>
            Todas
          </TabButton>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          {query.isLoading
            ? "Cargando…"
            : `${items.length} de ${total} reservas`}
        </div>

        <div className="mt-3 space-y-2">
          {items.length === 0 && !query.isLoading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <Calendar className="mx-auto mb-2 h-6 w-6 opacity-50" />
              Sin reservas en este filtro
            </div>
          ) : (
            items.map((b) => <BookingRow key={b.id} booking={b} />)
          )}
        </div>
      </div>
    </div>
  );
}

function BookingRow({ booking: b }: { booking: Booking }) {
  const qc = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");

  const cancel = useMutation({
    mutationFn: () => bookingsService.bookings.cancel(b.id, reason || undefined),
    onSuccess: () => {
      toast.success("Reserva cancelada — jugadores notificados");
      setShowCancel(false);
      qc.invalidateQueries({ queryKey: ["bookings", "list"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error";
      toast.error(msg);
    },
  });

  const start = new Date(b.startsAt);
  const end = new Date(b.endsAt);
  const timeStr = `${start.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  const dateStr = start.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-card/70">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/mi-club/reservas/bookings/${b.id}`}
          className="min-w-0 flex-1 cursor-pointer"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {b.shortCode}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[b.status]}`}>
              {STATUS_LABELS[b.status]}
            </span>
            <span className="text-xs text-muted-foreground">{b.matchMode}</span>
          </div>
          <div className="mt-1.5 text-sm font-medium">
            {b.court?.name ?? "Pista?"} · {dateStr} · {timeStr}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {b.participants?.length ?? 0} jugadores · {(b.priceCents / 100).toFixed(2)} €
            {b.paidAt && <span> · pagada</span>}
          </div>
        </Link>
        {b.status !== "CANCELLED" && b.status !== "COMPLETED" && b.status !== "WITHOUT_RESULT" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCancel(true)}
          >
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
        )}
      </div>
      {showCancel && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3">
          <p className="text-sm font-medium">¿Cancelar esta reserva?</p>
          <input
            type="text"
            placeholder="Motivo (opcional, visible al jugador)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCancel(false)}>
              Cerrar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Confirmar cancelación"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function BackLink() {
  return (
    <Link
      href="/mi-club/reservas"
      className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3" /> Volver a Reservas
    </Link>
  );
}
