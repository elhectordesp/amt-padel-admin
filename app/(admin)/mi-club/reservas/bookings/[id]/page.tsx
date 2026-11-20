/**
 * /mi-club/reservas/bookings/[id] — detalle completo de una reserva.
 *
 * Vista admin con todos los campos relevantes: pista, modo, participantes,
 * precio, pago, cancelación, normas aceptadas, metadata. Incluye acción de
 * cancelar (confirmada en un diálogo, con motivo opcional) si la reserva aún
 * es cancelable.
 */

"use client";

import { Suspense, use, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar, CalendarClock, Clock, CreditCard, Crown, FileText, Flame,
  Loader2, MapPin, Ticket, Trophy, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { BookingCollectPanel } from "@/components/admin/booking-collect-panel";
import { BookingShopSales } from "@/components/admin/booking-shop-sales";
import { BookingResultPanel } from "@/components/admin/booking-result-panel";
import { CancelBookingDialog } from "@/components/admin/cancel-booking-dialog";
import CollectModal from "@/components/admin/collect-modal";
import { ErrorState } from "@/components/admin/error-state";
import { PayWithVoucherModal } from "@/components/admin/pay-with-voucher-modal";
import { RescheduleBookingDialog } from "@/components/admin/reschedule-booking-dialog";
import { ReservasPage } from "@/components/admin/reservas-page";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { clubVouchersQK, clubVouchersService } from "@/lib/services/club-vouchers";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useRole, isClub } from "@/lib/use-role";
import { MODE_LABELS } from "@/lib/utils/booking-labels";
import { bookingCapacity } from "@/lib/utils/booking-participants";
import { partsDescription } from "@/lib/utils/booking-parts";
import { paymentAction, paymentMethodLabel } from "@/lib/utils/booking-payment";
import { formatCents } from "@/lib/utils/booking-price";
import {
  capitalizeFirst,
  formatInTimeZone,
  zonedTime,
} from "@/lib/utils/time-zone";
import type {
  BookingParticipant, BookingParticipantStatus,
  BookingPaymentMethod, BookingStatus,
} from "@/types/bookings";

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_INVITES: "Esperando invitaciones",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  WITHOUT_RESULT: "Sin resultado",
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING_INVITES: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  CONFIRMED: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  IN_PROGRESS: "bg-green-500/15 text-green-500 border-green-500/30",
  COMPLETED: "bg-muted text-muted-foreground border-border",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/30",
  WITHOUT_RESULT: "bg-muted text-muted-foreground border-border",
};


const BACK_TO_LIST = { href: "/mi-club/reservas/bookings", label: "Volver al listado" };
const CALENDAR_PREFIX = "/mi-club/reservas/calendario";

/**
 * A dónde vuelve el enlace de arriba: al calendario, en el día y la franja de
 * donde se venía (`?volver=`), si es una ruta del calendario; si no, al listado.
 * Solo rutas del propio calendario: la URL llega del navegador.
 */
function backTarget(volver: string | null): { href: string; label: string } {
  const isCalendar =
    !!volver && (volver === CALENDAR_PREFIX || volver.startsWith(`${CALENDAR_PREFIX}?`));
  return isCalendar ? { href: volver, label: "Volver al calendario" } : BACK_TO_LIST;
}

// Como toLocaleDateString y toLocaleString («27/10/2026», «27/10/2026, 9:05»), en la zona del club
const DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" };
const DATE_TIME: Intl.DateTimeFormatOptions = { ...DATE, hour: "numeric", minute: "2-digit" };

const PARTICIPANT_STATUS_LABELS: Record<BookingParticipantStatus, string> = {
  INVITED: "Invitado",
  ACCEPTED: "Confirmado",
  AUTO_ACCEPTED: "Confirmado",
  DECLINED: "Rechazó",
  REMOVED: "Eliminado",
};

const PARTICIPANT_STATUS_COLORS: Record<BookingParticipantStatus, string> = {
  INVITED: "text-amber-500",
  ACCEPTED: "text-green-500",
  AUTO_ACCEPTED: "text-green-500",
  DECLINED: "text-destructive",
  REMOVED: "text-muted-foreground",
};

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // La vuelta sale de la URL (useSearchParams): sin Suspense, el build no prerenderiza la página
  return (
    <Suspense fallback={<Loader2 className="m-6 h-5 w-5 animate-spin text-muted-foreground" />}>
      <BookingDetail params={params} />
    </Suspense>
  );
}

function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const back = backTarget(useSearchParams().get("volver"));
  const { role, clubId } = useRole();
  const qc = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCollect, setShowCollect] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);
  const clubTimeZone = useClubTimeZone(clubId, isClub(role));
  // Mover, cancelar y cobrar la reserva son del área «bookings»; pagar con
  // bono es un cobro de caja: el área «cash» (el back lo exige igual)
  const { can } = useClubAccess();
  const canWrite = can("bookings", "write");
  const canVoucher = can("cash", "write");
  // Con el módulo Cuentas, cobrar es la hoja de partes (el back la pide en el área «cash»)
  const accountsOn = useAccountsEnabled(clubId, isClub(role));

  const query = useQuery({
    queryKey: bookingsQK.bookingDetail(id),
    queryFn: () => bookingsService.bookings.detail(id),
    enabled: !!id && !!clubId && isClub(role),
  });

  const markPaidMut = useMutation({
    mutationFn: (method: BookingPaymentMethod) =>
      bookingsService.bookings.markPaid(id, { method }),
    onSuccess: () => {
      toast.success("Pago actualizado");
      qc.invalidateQueries({ queryKey: bookingsQK.bookingDetail(id) });
      qc.invalidateQueries({ queryKey: ["bookings", "list"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error al actualizar el pago";
      toast.error(msg);
    },
  });

  // Qué cambia al cobrar con la hoja de partes: la reserva, sus listas y la caja
  const refreshAfterCollect = () => {
    qc.invalidateQueries({ queryKey: bookingsQK.bookingDetail(id) });
    qc.invalidateQueries({ queryKey: ["bookings", "list"] });
    qc.invalidateQueries({ queryKey: ["club-cash"] });
  };

  // Qué cambia al pagar con bono o quitárselo: la reserva, sus listas, la caja y los bonos
  const refreshAfterVoucher = () => {
    qc.invalidateQueries({ queryKey: bookingsQK.bookingDetail(id) });
    qc.invalidateQueries({ queryKey: ["bookings", "list"] });
    qc.invalidateQueries({ queryKey: ["club-cash"] });
    if (clubId) qc.invalidateQueries({ queryKey: clubVouchersQK.all(clubId) });
  };
  const removeVoucherMut = useMutation({
    mutationFn: () => clubVouchersService.booking.remove(clubId!, id),
    onSuccess: () => {
      toast.success("Bono quitado: la sesión vuelve al bono y la reserva queda sin pagar");
      refreshAfterVoucher();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error al quitar el bono";
      toast.error(msg);
    },
  });

  if (role === null || query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isClub(role) || !clubId) {
    return (
      <ReservasPage title="Reserva" back={back}>
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </ReservasPage>
    );
  }
  if (clubTimeZone.isError) {
    return (
      <ReservasPage title="Reserva" back={back}>
        <ErrorState
          message="No se pudieron cargar los datos del club."
          onRetry={() => void clubTimeZone.refetch()}
        />
      </ReservasPage>
    );
  }
  // Sin la zona del club no se pinta ninguna fecha ni hora
  const tz = clubTimeZone.timeZone;
  if (!tz) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ReservasPage title="Reserva" back={back}>
        <p className="mt-6 text-sm text-muted-foreground">
          Reserva no encontrada o sin permisos.
        </p>
      </ReservasPage>
    );
  }

  const b = query.data;
  // En hora del club (su zona, como el back y el calendario), no del navegador
  const dateStr = capitalizeFirst(formatInTimeZone(b.startsAt, tz, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }));
  const timeStr = `${zonedTime(b.startsAt, tz)} – ${zonedTime(b.endsAt, tz)}`;
  const at = (iso: string) => formatInTimeZone(iso, tz, DATE_TIME);
  const isOpen = b.matchMode === "OPEN";
  const canCancel = canWrite && !["CANCELLED", "COMPLETED", "WITHOUT_RESULT"].includes(b.status);
  // Solo una que aún no ha empezado: después ya no tiene sentido moverla
  const canReschedule =
    canWrite && ["PENDING_INVITES", "CONFIRMED"].includes(b.status) && new Date(b.startsAt) > new Date();
  const payment = b.status === "CANCELLED" ? null : paymentAction(b.paymentMethod);
  // Qué botones de cobro le tocan a quien mira: así no queda una fila vacía
  // Con partes, la reserva se cobra, se deshace y se devuelve parte a parte (el back responde 409 si no)
  const hasParts = b.partsSummary != null;
  // Con el módulo apagado, una reserva que ya tiene partes sigue con su hoja
  const showCollectPanel =
    canVoucher && b.status !== "CANCELLED" && (hasParts || (accountsOn && payment === "markPaid"));
  const showCollectBtn = canWrite && payment === "markPaid" && !hasParts && !showCollectPanel;
  const showVoucherBtn = canVoucher && payment === "markPaid" && !hasParts && !!b.clubCustomerId;
  const showRemoveVoucherBtn = canVoucher && payment === "removeVoucher";
  const showUnpaidBtn = canWrite && payment === "markUnpaid" && !hasParts;

  return (
    <ReservasPage title={`Reserva ${b.shortCode}`} back={back} className="max-w-4xl">
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status]}`}>
              {STATUS_LABELS[b.status]}
            </span>
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {MODE_LABELS[b.matchMode]}
            </span>
            {b.isCompetitive && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary">
                <Trophy className="h-3 w-3" /> Competitivo
              </span>
            )}
            {isOpen && b.openMatchSlotsRemaining !== null && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-500">
                <Flame className="h-3 w-3" /> {b.openMatchSlotsRemaining}/{bookingCapacity(b)} libres
              </span>
            )}
          </div>
        </div>
        {(canReschedule || canCancel) && (
          <div className="flex flex-wrap items-center gap-2">
            {canReschedule && (
              <Button variant="outline" size="sm" onClick={() => setShowReschedule(true)}>
                <CalendarClock className="h-3.5 w-3.5" /> Cambiar hora o pista
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" size="sm" onClick={() => setShowCancel(true)}>
                <X className="h-3.5 w-3.5" /> Cancelar reserva
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Resumen */}
      <Section title="Resumen">
        <Row icon={MapPin} label="Pista">
          {b.court?.name ?? "—"}
          {b.court?.isIndoor && <span className="ml-1 text-xs text-muted-foreground">(cubierta)</span>}
          {b.court?.type && (
            <span className="ml-1 text-xs text-muted-foreground">
              · {b.court.type === "SINGLES" ? "Individual" : "Dobles"}
            </span>
          )}
        </Row>
        <Row icon={Calendar} label="Fecha">
          {dateStr}
        </Row>
        <Row icon={Clock} label="Horario">
          {timeStr} · {b.durationMinutes} min
        </Row>
        <Row icon={CreditCard} label="Precio">
          {formatCents(b.priceCents)}
          <span className="ml-2 text-xs text-muted-foreground">
            ({paymentMethodLabel(b.paymentMethod)})
          </span>
          {b.partsSummary && (
            <span className="ml-2 text-xs text-muted-foreground">· {partsDescription(b.partsSummary)}</span>
          )}
          {b.paidAt && (
            <span className="ml-2 text-xs text-green-500">
              · pagada {formatInTimeZone(b.paidAt, tz, DATE)}
            </span>
          )}
        </Row>
        {(showCollectBtn || showVoucherBtn || showRemoveVoucherBtn || showUnpaidBtn) && (
          <div className="ml-7 flex flex-wrap items-center gap-2">
            {showCollectBtn && (
              <Button variant="outline" size="sm" onClick={() => setShowCollect(true)}>
                <CreditCard className="h-3.5 w-3.5" /> Cobrar
              </Button>
            )}
            {/* Un bono solo paga reservas de su dueño: sin cliente, no hay bono que elegir */}
            {showVoucherBtn && (
              <Button variant="outline" size="sm" onClick={() => setShowVoucher(true)}>
                <Ticket className="h-3.5 w-3.5" /> Pagar con bono
              </Button>
            )}
            {showRemoveVoucherBtn && (
              <Button variant="outline" size="sm" onClick={() => removeVoucherMut.mutate()} disabled={removeVoucherMut.isPending}>
                {removeVoucherMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Quitar el bono
              </Button>
            )}
            {showUnpaidBtn && (
              <Button variant="outline" size="sm" onClick={() => markPaidMut.mutate("PENDING")} disabled={markPaidMut.isPending}>
                {markPaidMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Marcar como no pagada
              </Button>
            )}
          </div>
        )}
        {b.priceBreakdown.extras.length > 0 && (
          <div className="ml-7 text-xs text-muted-foreground">
            Incluye: {b.priceBreakdown.extras.map((e) => `${e.name} (${formatCents(e.cents)})`).join(", ")}
          </div>
        )}
        {isOpen && (b.openMatchMinLspa !== null || b.openMatchMaxLspa !== null) && (
          <Row icon={Trophy} label="Rango LSPA">
            {b.openMatchMinLspa ?? "—"} a {b.openMatchMaxLspa ?? "—"}
          </Row>
        )}
      </Section>

      {/* Cobro por partes: la hoja del club (módulo Cuentas) */}
      {showCollectPanel && (
        <Section title="Cobro">
          <BookingCollectPanel clubId={clubId} booking={b} accountsOn={accountsOn} onChanged={refreshAfterCollect} />
        </Section>
      )}

      <BookingShopSales clubId={clubId} bookingId={b.id} status={b.status} hasCustomer={!!b.clubCustomerId} onChanged={refreshAfterCollect} />

      {/* Participantes */}
      <Section title={`Participantes (${b.participants?.length ?? 0})`}>
        {(b.participants?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Sin participantes registrados.</p>
        ) : (
          <ul className="space-y-2">
            {b.participants!.map((p) => (
              <ParticipantItem key={p.id} p={p} />
            ))}
          </ul>
        )}
      </Section>

      {/* Resultado: desde que empieza el partido */}
      {(b.result || ["IN_PROGRESS", "COMPLETED", "WITHOUT_RESULT"].includes(b.status)) && (
        <Section title="Resultado">
          <BookingResultPanel booking={b} timeZone={tz} />
        </Section>
      )}

      {/* Notas */}
      {b.notes && (
        <Section title="Notas del creador">
          <p className="text-sm whitespace-pre-wrap">{b.notes}</p>
        </Section>
      )}

      {/* Cancelación */}
      {b.status === "CANCELLED" && (
        <Section title="Cancelación">
          <Row icon={Clock} label="Cancelada el">
            {b.cancelledAt ? at(b.cancelledAt) : "—"}
          </Row>
          {b.cancellationReason && (
            <Row icon={FileText} label="Motivo">
              {b.cancellationReason}
            </Row>
          )}
        </Section>
      )}

      {/* Normas */}
      {b.rulesAcceptedAt && (
        <Section title="Normas">
          <p className="text-sm text-muted-foreground">
            Aceptadas el {at(b.rulesAcceptedAt)}
            {b.rulesVersion && ` (versión ${b.rulesVersion})`}
          </p>
        </Section>
      )}

      {/* Metadata */}
      <Section title="Datos de la reserva">
        <Row icon={Clock} label="Creada">
          {at(b.createdAt)}
        </Row>
        <Row icon={Clock} label="Actualizada">
          {at(b.updatedAt)}
        </Row>
        {b.reminder24hSentAt && (
          <p className="ml-7 text-xs text-muted-foreground">
            Recordatorio 24h enviado: {at(b.reminder24hSentAt)}
          </p>
        )}
        {b.reminder2hSentAt && (
          <p className="ml-7 text-xs text-muted-foreground">
            Recordatorio 2h enviado: {at(b.reminder2hSentAt)}
          </p>
        )}
      </Section>

      {showReschedule && canReschedule && (
        <RescheduleBookingDialog booking={b} timeZone={tz} onClose={() => setShowReschedule(false)} />
      )}
      {showCancel && canCancel && (
        <CancelBookingDialog booking={b} timeZone={tz} onClose={() => setShowCancel(false)} />
      )}
      {showCollect && (
        <CollectModal
          title="Cobrar reserva"
          subtitle={`${b.shortCode} · ${b.court?.name ?? "—"}`}
          defaultCents={b.priceCents}
          onSubmit={(method, amountCents) => bookingsService.bookings.markPaid(id, { method, amountCents })}
          onDone={() => {
            qc.invalidateQueries({ queryKey: bookingsQK.bookingDetail(id) });
            qc.invalidateQueries({ queryKey: ["bookings", "list"] });
            qc.invalidateQueries({ queryKey: ["club-cash"] });
          }}
          onClose={() => setShowCollect(false)}
        />
      )}
      {showVoucher && (
        <PayWithVoucherModal
          clubId={clubId}
          bookingId={id}
          subtitle={`${b.shortCode} · ${b.court?.name ?? "—"} · ${dateStr}, ${timeStr}`}
          timeZone={tz}
          onDone={refreshAfterVoucher}
          onClose={() => setShowVoucher(false)}
        />
      )}
    </ReservasPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon, label, children,
}: { icon: typeof Calendar; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground min-w-[80px]">{label}:</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function ParticipantItem({ p }: { p: BookingParticipant }) {
  const name = p.user?.name ?? p.guestName ?? "Invitado sin nombre";
  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{name}</span>
        {p.isCreator && (
          <span title="Creador de la reserva">
            <Crown className="h-3.5 w-3.5 text-primary shrink-0" />
          </span>
        )}
        {!p.userId && (
          <span className="text-xs text-muted-foreground">(sin cuenta)</span>
        )}
        {p.user?.email && (
          <span className="text-xs text-muted-foreground truncate">· {p.user.email}</span>
        )}
      </div>
      <span className={`text-xs ${PARTICIPANT_STATUS_COLORS[p.status]}`}>
        {PARTICIPANT_STATUS_LABELS[p.status]}
      </span>
    </li>
  );
}
