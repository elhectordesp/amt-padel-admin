/**
 * /mi-club/reservas/bookings — listado de reservas + acciones admin.
 *
 * Tabs: Hoy / Próximas / Histórico / Todas. Filtros adicionales por estado.
 * Búsqueda por el nombre o el email de quien juega (`q`, en el back) y
 * paginación del servidor (`limit` + `offset`).
 * Cada reserva: hora, pista, jugadores, estado, pago, acciones (cancelar).
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Calendar,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/admin/error-state";
import { Pagination, useKeepPageInRange, usePagination } from "@/components/admin/pagination";
import { ReservasPage } from "@/components/admin/reservas-page";
import { Button } from "@/components/ui/button";
import { BookingCreateDialog } from "@/components/admin/booking-create-dialog";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useRole, isClub } from "@/lib/use-role";
import { dayRangeIso } from "@/lib/utils/booking-day-grid";
import { activeParticipants, playersLabel } from "@/lib/utils/booking-participants";
import { formatCents } from "@/lib/utils/booking-price";
import {
  formatInTimeZone,
  zonedDayKey,
  zonedTime,
} from "@/lib/utils/time-zone";
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

const UPCOMING_STATUSES: BookingStatus[] = ["PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"];

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
  const [showCreate, setShowCreate] = useState(false);
  const clubTimeZone = useClubTimeZone(clubId, isClub(role));
  const timeZone = clubTimeZone.timeZone;
  const { page, setPage, pageSize, setPageSize } = usePagination();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // La búsqueda espera 300 ms sin teclear y vuelve a la primera página. Solo
  // si cambia el texto: al abrir, o con un espacio de más, no se pierde la
  // página en la que se está
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const t = setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, search, setPage]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
  };

  // null: aún sin la zona del club, no hay «hoy» con el que pedir
  const filters = useMemo<BookingFiltersQuery | null>(() => {
    if (!clubId || !timeZone) return null;
    // «Hoy» es el día del club (su zona, como el back y el calendario), no
    // el del navegador
    const todayKey = zonedDayKey(new Date(), timeZone);
    const today = dayRangeIso(todayKey, todayKey, timeZone);
    const base: BookingFiltersQuery = {
      clubId,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      q: search || undefined,
    };
    if (tab === "today") {
      return { ...base, ...today, order: "asc" };
    }
    if (tab === "upcoming") {
      // Las que siguen en pie, de la más cercana a la más lejana
      return { ...base, fromDate: today.toDate, statuses: UPCOMING_STATUSES, order: "asc" };
    }
    if (tab === "history") {
      return { ...base, toDate: today.fromDate };
    }
    return base;
  }, [clubId, timeZone, tab, page, pageSize, search]);

  const query = useQuery({
    queryKey: bookingsQK.bookingsList(filters ?? {}),
    queryFn: () => bookingsService.bookings.list(filters!),
    enabled: !!filters && isClub(role),
    // Al pasar de página o buscar se sigue viendo lo anterior hasta que llega
    placeholderData: (prev) => prev,
  });
  // Si baja el total (p. ej. al cancelar la única de la última página), a la
  // última página que haya
  useKeepPageInRange(page, setPage, pageSize, query.isPlaceholderData ? undefined : query.data?.total);

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isClub(role) || !clubId) {
    return (
      <ReservasPage title="Reservas">
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </ReservasPage>
    );
  }
  // Sin la zona del club no se pinta ninguna hora (ni el alta, que abre en «hoy»)
  if (!timeZone) {
    return (
      <ReservasPage title="Reservas">
        {clubTimeZone.isError ? (
          <ErrorState
            message="No se pudieron cargar los datos del club."
            onRetry={() => void clubTimeZone.refetch()}
          />
        ) : (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </ReservasPage>
    );
  }

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  return (
    <ReservasPage title="Reservas">
      {/* El botón va con el texto, no junto a la cabecera: en el móvil se cortaba */}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
          Listado de reservas de tu club. Cancelar aquí notifica automáticamente
          a los jugadores con el motivo opcional.
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> Crear reserva
        </Button>
      </div>

      <BookingCreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        clubId={clubId}
        timeZone={timeZone}
      />

      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === "today"} onClick={() => changeTab("today")}>
            Hoy
          </TabButton>
          <TabButton
            active={tab === "upcoming"}
            onClick={() => changeTab("upcoming")}
          >
            Próximas
          </TabButton>
          <TabButton
            active={tab === "history"}
            onClick={() => changeTab("history")}
          >
            Histórico
          </TabButton>
          <TabButton active={tab === "all"} onClick={() => changeTab("all")}>
            Todas
          </TabButton>
        </div>

        <div className="mt-4 flex w-full items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 sm:max-w-xs">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Buscar reservas"
            aria-describedby="bookings-search-help"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre o email del jugador..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query.isFetching && <Loader2 size={12} className="shrink-0 animate-spin text-muted-foreground" />}
        </div>
        {/* El back no enseña a un club los emails de los jugadores: por trozos
            podría adivinarlos, así que solo encaja el email entero */}
        <p id="bookings-search-help" className="mt-1.5 text-xs text-muted-foreground">
          Busca por el nombre o por el email completo de quien juega.
        </p>

        {!query.isError && (
          <div className="mt-4 text-sm text-muted-foreground">
            {query.isLoading ? "Cargando…" : `${total} reservas`}
          </div>
        )}

        <div className="mt-3 space-y-2">
          {query.isError ? (
            <ErrorState
              message="No se pudieron cargar las reservas."
              onRetry={() => void query.refetch()}
            />
          ) : items.length === 0 && !query.isLoading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <Calendar className="mx-auto mb-2 h-6 w-6 opacity-50" />
              {search ? "Ninguna reserva coincide con la búsqueda" : "Sin reservas en este filtro"}
            </div>
          ) : (
            items.map((b) => <BookingRow key={b.id} booking={b} timeZone={timeZone} />)
          )}
        </div>

        {!query.isLoading && !query.isError && (
          <div className="mt-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="reservas"
              busy={query.isFetching}
            />
          </div>
        )}
      </div>
    </ReservasPage>
  );
}

function BookingRow({ booking: b, timeZone }: { booking: Booking; timeZone: string }) {
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

  // En hora del club, como el detalle y el calendario
  const timeStr = `${zonedTime(b.startsAt, timeZone)} - ${zonedTime(b.endsAt, timeZone)}`;
  const dateStr = formatInTimeZone(b.startsAt, timeZone, {
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
            {playersLabel(activeParticipants(b).length)} · {formatCents(b.priceCents)}
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
