"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, Loader2, Plus, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminService } from "@/lib/services/admin";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { bookingHolder } from "@/lib/utils/booking-labels";
import { dayRangeIso, resolveDayWindow } from "@/lib/utils/booking-day-grid";
import {
  launchPending, launchSteps, liveBookings, todayOccupancy, upcomingBookings,
} from "@/lib/utils/club-today";
import { useClubAccess } from "@/lib/use-club-access";
import { AmtFeeOverdueNotice, useAmtPlan } from "@/components/admin/club-amt-plan-card";
import { UnclosedDaysNotice } from "@/components/admin/unclosed-days-notice";
import { overdueNotice } from "@/lib/utils/amt-plan";
import { formatInTimeZone, tournamentTimeZone, zonedDayKey } from "@/lib/utils/time-zone";

const REFRESH_MS = 60_000;

/** Los pasos para arrancar las reservas de un club a medio configurar (null: aún sin datos). */
export function useLaunchSteps(clubId: string | null) {
  const enabled = !!clubId;
  const activation = useQuery({
    queryKey: bookingsQK.activation(clubId ?? ""),
    queryFn: () => bookingsService.activation.state(clubId!),
    enabled,
  });
  const rules = useQuery({
    queryKey: bookingsQK.rules(clubId ?? ""),
    queryFn: () => bookingsService.rules.get(clubId!),
    enabled,
  });
  const club = useQuery({
    queryKey: ["my-club", clubId],
    queryFn: () => adminService.clubs.findOne(clubId!),
    enabled,
  });
  const loaded = activation.isSuccess && rules.isSuccess && club.isSuccess;
  const steps = useMemo(
    () =>
      loaded
        ? launchSteps({
            activation: activation.data,
            rulesMarkdown: rules.data.rulesMarkdown,
            clubPendingSetup: club.data.pendingSetup,
          })
        : null,
    [loaded, activation.data, rules.data, club.data],
  );
  return { steps, pending: launchPending(steps) };
}

export function LaunchChecklist({ clubId }: { clubId: string }) {
  const { steps, pending } = useLaunchSteps(clubId);
  if (!steps || !pending) return null;
  const done = steps.filter((s) => s.ok).length;
  return (
    <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Para arrancar las reservas</h3>
        <span className="text-xs text-muted-foreground">{done} de {steps.length} listos</span>
      </div>
      <ul className="divide-y divide-border">
        {steps.map((s) => (
          <li key={s.key}>
            <Link href={s.href} className="-mx-2 flex items-center gap-3 rounded px-2 py-2.5 hover:bg-secondary/40">
              {s.ok
                ? <CheckCircle2 size={16} className="shrink-0 text-green-500" />
                : <Circle size={16} className="shrink-0 text-amber-500" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{s.label}</p>
                {!s.ok && <p className="text-xs text-muted-foreground">{s.hint}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{s.ok ? "Listo" : "Pendiente ›"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({ label, value, sub, href, loading }: {
  label: string; value: string; sub?: string; href?: string; loading: boolean;
}) {
  const inner = (
    <div className="h-full rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading
        ? <div className="mt-1 h-8 w-16 animate-pulse rounded bg-secondary" />
        : <p className="font-heading text-3xl text-foreground">{value}</p>}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const hours1 = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

/** «Hoy en el club»: reservas de hoy, sin pagar, ocupación y las próximas. */
export function ClubToday({ clubId }: { clubId: string }) {
  // La cuota con AMT solo se avisa al propietario
  const { roles, can } = useClubAccess();
  const isOwner = !!roles?.includes("OWNER");
  // Quien solo lee las reservas no las crea: sin el atajo de «Nueva reserva»
  const canCreateBooking = can("bookings", "write");
  const amtPlan = useAmtPlan(clubId, isOwner);
  const club = useQuery({
    queryKey: ["my-club", clubId],
    queryFn: () => adminService.clubs.findOne(clubId),
  });
  const timeZone = club.data ? tournamentTimeZone(club.data) : null;
  const dayKey = timeZone ? zonedDayKey(new Date(), timeZone) : null;
  const range = useMemo(
    () => (dayKey && timeZone ? dayRangeIso(dayKey, dayKey, timeZone) : null),
    [dayKey, timeZone],
  );

  const courtsQ = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId),
  });
  const hoursQ = useQuery({
    queryKey: bookingsQK.operatingHours(clubId),
    queryFn: () => bookingsService.operatingHours.list(clubId),
  });
  const exceptionsQ = useQuery({
    queryKey: bookingsQK.exceptions(clubId, dayKey ?? "", dayKey ?? ""),
    queryFn: () => bookingsService.exceptions.list(clubId, { fromDate: dayKey!, toDate: dayKey! }),
    enabled: !!dayKey,
  });
  const bookingsFilters = { clubId, ...(range ?? { fromDate: "", toDate: "" }) };
  const bookingsQ = useQuery({
    queryKey: bookingsQK.bookingsAll(bookingsFilters),
    queryFn: () => bookingsService.bookings.listAll(bookingsFilters),
    enabled: !!range,
    refetchInterval: REFRESH_MS,
  });
  const occupationsQ = useQuery({
    queryKey: bookingsQK.occupations(clubId, range?.fromDate ?? "", range?.toDate ?? ""),
    queryFn: () => bookingsService.occupations.list(clubId, { from: range!.fromDate, to: range!.toDate }),
    enabled: !!range,
    refetchInterval: REFRESH_MS,
  });
  // Lo que se debe, en total: el mismo número que enseña el listado con «Sin pagar»
  const unpaidFilters = { clubId, unpaid: "true" as const, limit: 1, offset: 0 };
  const unpaidQ = useQuery({
    queryKey: bookingsQK.bookingsList(unpaidFilters),
    queryFn: () => bookingsService.bookings.list(unpaidFilters),
    refetchInterval: REFRESH_MS,
  });

  const queries = [club, courtsQ, hoursQ, exceptionsQ, bookingsQ, occupationsQ];
  const failed = queries.some((q) => q.isLoadingError) || unpaidQ.isLoadingError;
  const loading = !failed && queries.some((q) => q.isPending);

  const view = useMemo(() => {
    if (!timeZone || !dayKey || !bookingsQ.data) return null;
    const courts = (courtsQ.data ?? []).filter((c) => c.active);
    const window = resolveDayWindow(dayKey, hoursQ.data ?? [], exceptionsQ.data ?? []);
    const occupancy = todayOccupancy({
      courtIds: courts.map((c) => c.id),
      window,
      bookings: bookingsQ.data,
      occupations: occupationsQ.data ?? [],
      dayKey,
      timeZone,
    });
    return {
      count: liveBookings(bookingsQ.data).length,
      occupancy,
      next: upcomingBookings(bookingsQ.data, bookingsQ.dataUpdatedAt),
      courtNames: new Map(courts.map((c) => [c.id, c.name])),
    };
  }, [timeZone, dayKey, bookingsQ.data, bookingsQ.dataUpdatedAt, courtsQ.data, hoursQ.data, exceptionsQ.data, occupationsQ.data]);

  const hhmm = (iso: string) =>
    timeZone ? formatInTimeZone(iso, timeZone, { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <section className="space-y-3">
      {isOwner && <AmtFeeOverdueNotice notice={overdueNotice(amtPlan.data)} />}
      <UnclosedDaysNotice clubId={clubId} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-lg text-foreground">Hoy en el club</h3>
        <div className="flex flex-wrap gap-2">
          <Link href="/mi-club/reservas/calendario" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <CalendarDays className="mr-1.5 h-4 w-4" />Abrir calendario
          </Link>
          {canCreateBooking && (
            <Link href="/mi-club/reservas/calendario?nueva=1" className={cn(buttonVariants({ size: "sm" }))}>
              <Plus className="mr-1.5 h-4 w-4" />Nueva reserva
            </Link>
          )}
          {can("cash", "read") && (
            <Link href="/caja" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Wallet className="mr-1.5 h-4 w-4" />Caja del día
            </Link>
          )}
        </div>
      </div>

      {failed ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">
          <AlertTriangle size={14} className="shrink-0" />
          No se pudo cargar el día del club
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Reservas de hoy" value={String(view?.count ?? "—")} loading={loading}
              href="/mi-club/reservas/bookings" />
            <Tile label="Sin pagar" value={String(unpaidQ.data?.total ?? "—")} loading={unpaidQ.isPending}
              sub="En total, de cualquier día" href="/mi-club/reservas/bookings?sinpagar=1" />
            <Tile
              label="Ocupación de hoy"
              value={view?.occupancy.percent == null ? "—" : `${view.occupancy.percent} %`}
              sub={view
                ? view.occupancy.percent == null
                  ? "Cerrado hoy o sin pistas activas"
                  : `${hours1(view.occupancy.occupiedMinutes)} h de ${hours1(view.occupancy.openMinutes)} h abiertas`
                : undefined}
              loading={loading}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Próximas reservas</h4>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : !view || view.next.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">No quedan reservas para hoy</p>
            ) : (
              <ul className="divide-y divide-border">
                {view.next.map((b) => (
                  <li key={b.id}>
                    <Link href={`/mi-club/reservas/bookings/${b.id}`} className="-mx-2 flex items-center gap-3 rounded px-2 py-2 text-sm hover:bg-secondary/40">
                      <span className="w-12 font-semibold tabular-nums">{hhmm(b.startsAt)}</span>
                      <span className="flex-1 truncate">{bookingHolder(b) ?? "Sin titular"}</span>
                      <span className="text-xs text-muted-foreground">{view.courtNames.get(b.courtId) ?? ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
