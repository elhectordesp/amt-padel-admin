/**
 * /mi-club/reservas/bookings — listado de reservas + acciones admin.
 *
 * Tabs: Hoy / Próximas / Histórico / Todas. Filtros adicionales por estado.
 * Búsqueda por el nombre o el email de quien juega (`q`, en el back) y
 * paginación del servidor (`limit` + `offset`).
 * Tabla compacta: hora, pista, titular, jugadores, importe, pago y estado, con
 * «Sin pagar» para ver quién debe dinero. Cada fila, su casilla (cancelar
 * varias) y «Cancelar».
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import {
  Calendar,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { CancelBookingDialog } from "@/components/admin/cancel-booking-dialog";
import { CancelManyBookingsDialog } from "@/components/admin/cancel-many-bookings-dialog";
import { ErrorState } from "@/components/admin/error-state";
import { Pagination, useKeepPageInRange, usePagination } from "@/components/admin/pagination";
import { ReservasPage } from "@/components/admin/reservas-page";
import { Button } from "@/components/ui/button";
import { BookingCreateDialog } from "@/components/admin/booking-create-dialog";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useRole, isClub } from "@/lib/use-role";
import { cancelFailureReason, cancelledSummary } from "@/lib/utils/booking-cancel-many";
import { dayRangeIso } from "@/lib/utils/booking-day-grid";
import { bookingHolder, isUnpaid, MODE_LABELS } from "@/lib/utils/booking-labels";
import { activeParticipants, playersLabel } from "@/lib/utils/booking-participants";
import { paymentMethodLabel } from "@/lib/utils/booking-payment";
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
  CancelManyResult,
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

// Las que aún se pueden cancelar (las mismas para las que el listado enseña «Cancelar»)
const CANCELABLE_STATUSES: BookingStatus[] = ["PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"];
const isCancelable = (b: Booking) => CANCELABLE_STATUSES.includes(b.status);

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
  // Un día concreto (YYYY-MM-DD, el del club): manda sobre la pestaña
  const [day, setDay] = useState("");
  // Solo las que se deben (sin cobrar, con importe)
  const [unpaid, setUnpaid] = useState(false);
  // Las marcadas para cancelar de golpe, con sus datos para el resumen
  const [selected, setSelected] = useState<Map<string, Booking>>(new Map());
  const [selectingAll, setSelectingAll] = useState(false);
  const [showCancelMany, setShowCancelMany] = useState(false);
  const [cancelResult, setCancelResult] = useState<{
    result: CancelManyResult;
    byId: Map<string, Booking>;
  } | null>(null);
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
      setSelected(new Map());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, search, setPage]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setDay("");
    setPage(1);
    setSelected(new Map());
  };

  const changeUnpaid = (next: boolean) => {
    setUnpaid(next);
    setPage(1);
    setSelected(new Map());
  };

  const changeDay = (next: string) => {
    setDay(next);
    setPage(1);
    setSelected(new Map());
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
      unpaid: unpaid ? ("true" as const) : undefined,
    };
    if (day) {
      return { ...base, ...dayRangeIso(day, day, timeZone), order: "asc" };
    }
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
  }, [clubId, timeZone, tab, day, page, pageSize, search, unpaid]);

  const query = useQuery({
    queryKey: bookingsQK.bookingsList(filters ?? {}),
    queryFn: () => bookingsService.bookings.list(filters!),
    enabled: !!filters && isClub(role),
    // Al pasar de página o buscar se sigue viendo lo anterior hasta que llega;
    // al cambiar de pestaña no: serían las de otra pestaña con esta marcada
    meta: { tab },
    placeholderData: (prev, prevQuery) => (prevQuery?.meta?.tab === tab ? prev : undefined),
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

  const toggle = (b: Booking) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (!next.delete(b.id)) next.set(b.id, b);
      return next;
    });

  // Todas las cancelables del filtro (no solo las de esta página)
  const selectAll = async () => {
    if (!filters) return;
    setSelectingAll(true);
    try {
      // listAll pide página a página: su límite y desplazamiento mandan sobre los del filtro
      const all = await bookingsService.bookings.listAll({ ...filters, statuses: CANCELABLE_STATUSES });
      setSelected(new Map(all.map((b) => [b.id, b])));
    } catch {
      toast.error("No se han podido seleccionar las reservas");
    } finally {
      setSelectingAll(false);
    }
  };

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
          <TabButton active={!day && tab === "today"} onClick={() => changeTab("today")}>
            Hoy
          </TabButton>
          <TabButton
            active={!day && tab === "upcoming"}
            onClick={() => changeTab("upcoming")}
          >
            Próximas
          </TabButton>
          <TabButton
            active={!day && tab === "history"}
            onClick={() => changeTab("history")}
          >
            Histórico
          </TabButton>
          <TabButton active={!day && tab === "all"} onClick={() => changeTab("all")}>
            Todas
          </TabButton>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Día
            <input
              type="date"
              aria-label="Ver un día concreto"
              value={day}
              onChange={(e) => changeDay(e.target.value)}
              className={`rounded-md border bg-background px-2 py-1.5 text-sm text-foreground ${
                day ? "border-primary" : "border-border"
              }`}
            />
          </label>
          {day && (
            <Button variant="ghost" size="sm" onClick={() => changeDay("")}>
              <X className="h-3.5 w-3.5" /> Quitar día
            </Button>
          )}
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-primary ${
              unpaid
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <input
              type="checkbox"
              checked={unpaid}
              onChange={(e) => changeUnpaid(e.target.checked)}
              className="sr-only"
            />
            Sin pagar
          </label>
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

        {cancelResult && (
          <CancelResultCard
            result={cancelResult.result}
            byId={cancelResult.byId}
            timeZone={timeZone}
            onDismiss={() => setCancelResult(null)}
          />
        )}

        {!query.isError && items.some(isCancelable) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void selectAll()} disabled={selectingAll}>
              {selectingAll && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Seleccionar todas
            </Button>
            {selected.size > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>
                  Quitar selección
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowCancelMany(true)}>
                  <X className="h-3.5 w-3.5" /> Cancelar seleccionadas ({selected.size})
                </Button>
              </>
            )}
          </div>
        )}

        <div className="mt-3">
          {query.isError ? (
            <ErrorState
              message="No se pudieron cargar las reservas."
              onRetry={() => void query.refetch()}
            />
          ) : items.length === 0 && !query.isLoading ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <Calendar className="mx-auto mb-2 h-6 w-6 opacity-50" />
              {search
                ? "Ninguna reserva coincide con la búsqueda"
                : unpaid
                  ? "Ninguna reserva sin pagar en este filtro"
                  : "Sin reservas en este filtro"}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[56rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-8 px-3 py-2" aria-label="Seleccionar" />
                    <th className="px-3 py-2 font-medium">Hora</th>
                    <th className="px-3 py-2 font-medium">Pista</th>
                    <th className="px-3 py-2 font-medium">Titular</th>
                    <th className="px-3 py-2 font-medium">Jugadores</th>
                    <th className="px-3 py-2 text-right font-medium">Importe</th>
                    <th className="px-3 py-2 font-medium">Pago</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2" aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <BookingRow
                      key={b.id}
                      booking={b}
                      timeZone={timeZone}
                      selected={selected.has(b.id)}
                      onToggle={() => toggle(b)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
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

      {showCancelMany && (
        <CancelManyBookingsDialog
          ids={[...selected.keys()]}
          onClose={() => setShowCancelMany(false)}
          onDone={(result) => {
            setCancelResult({ result, byId: selected });
            setSelected(new Map());
            setShowCancelMany(false);
          }}
        />
      )}
    </ReservasPage>
  );
}

/** Qué pasó con cada reserva marcada: las canceladas y las que no se pudieron, con el motivo. */
function CancelResultCard({
  result,
  byId,
  timeZone,
  onDismiss,
}: {
  result: CancelManyResult;
  byId: Map<string, Booking>;
  timeZone: string;
  onDismiss: () => void;
}) {
  const failed = result.failed.length;
  return (
    <div role="status" className="mt-3 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {cancelledSummary(result)}
          {failed > 0 && `; ${failed === 1 ? "1 no se ha" : `${failed} no se han`} podido cancelar`}.
        </p>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Cerrar
        </Button>
      </div>
      {failed > 0 && (
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {result.failed.map((f) => {
            const b = byId.get(f.id);
            return (
              <li key={f.id}>
                {b ? bookingLabel(b, timeZone) : f.id}: {cancelFailureReason(f.code)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** «Pista 2 · lun, 9 nov · 18:00 - 19:00» */
function bookingLabel(b: Booking, timeZone: string): string {
  const dateStr = formatInTimeZone(b.startsAt, timeZone, { weekday: "short", day: "numeric", month: "short" });
  return `${b.court?.name ?? "Pista?"} · ${dateStr} · ${zonedTime(b.startsAt, timeZone)} - ${zonedTime(b.endsAt, timeZone)}`;
}

function BookingRow({
  booking: b,
  timeZone,
  selected,
  onToggle,
}: {
  booking: Booking;
  timeZone: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const [showCancel, setShowCancel] = useState(false);

  // En hora del club, como el detalle y el calendario
  const timeStr = `${zonedTime(b.startsAt, timeZone)} - ${zonedTime(b.endsAt, timeZone)}`;
  const dateStr = formatInTimeZone(b.startsAt, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const href = `/mi-club/reservas/bookings/${b.id}`;
  const holder = bookingHolder(b);
  const phone = b.clubCustomer?.phone;
  const unpaid = isUnpaid(b);

  return (
    <tr className="border-b border-border last:border-0 transition-colors hover:bg-muted/40">
      <td className="px-3 py-2 align-top">
        {isCancelable(b) && (
          <input
            type="checkbox"
            aria-label={`Seleccionar la reserva ${b.shortCode}`}
            checked={selected}
            onChange={onToggle}
            className="mt-0.5 h-4 w-4 cursor-pointer"
          />
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <Link href={href} className="block cursor-pointer">
          <span className="font-medium tabular-nums">{timeStr}</span>
          <span className="block text-xs text-muted-foreground">
            {dateStr} · {b.shortCode}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 align-top">{b.court?.name ?? "Pista?"}</td>
      <td className="px-3 py-2 align-top">
        <Link href={href} className="block cursor-pointer">
          <span className="font-medium">{holder ?? "—"}</span>
          <span className="block text-xs text-muted-foreground">
            {[phone, MODE_LABELS[b.matchMode]].filter(Boolean).join(" · ")}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 align-top">{playersLabel(activeParticipants(b).length)}</td>
      <td className="px-3 py-2 text-right align-top tabular-nums">{formatCents(b.priceCents)}</td>
      <td className="px-3 py-2 align-top">
        {unpaid ? (
          <span className="font-medium text-red-600 dark:text-red-400">Sin cobrar</span>
        ) : b.paymentMethod && b.paymentMethod !== "PENDING" && b.priceCents > 0 ? (
          <span
            className="text-green-600 dark:text-green-400"
            title={paymentMethodLabel(b.paymentMethod)}
          >
            Cobrada
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[b.status]}`}>
          {STATUS_LABELS[b.status]}
        </span>
      </td>
      <td className="px-3 py-2 text-right align-top">
        {isCancelable(b) && (
          <Button variant="ghost" size="sm" onClick={() => setShowCancel(true)}>
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
        )}
        {showCancel && (
          <CancelBookingDialog booking={b} timeZone={timeZone} onClose={() => setShowCancel(false)} />
        )}
      </td>
    </tr>
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
