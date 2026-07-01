/**
 * /mi-club/reservas/bookings/[id] — detalle completo de una reserva.
 *
 * Vista admin con todos los campos relevantes: pista, modo, participantes,
 * precio, pago, cancelación, normas aceptadas, metadata. Incluye acción de
 * cancelar (con motivo opcional) si la reserva aún es cancelable.
 */

"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft, Calendar, Clock, CreditCard, Crown, FileText, Flame,
  Loader2, MapPin, Trophy, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";
import type {
  BookingMatchMode, BookingParticipant, BookingParticipantStatus,
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

const MODE_LABELS: Record<BookingMatchMode, string> = {
  INDIVIDUAL: "Individual",
  PRIVATE_AMT: "Privado AMT",
  PRIVATE_WITH_GUESTS: "Privado con invitados",
  OPEN: "Abierto",
  ADMIN_MANUAL: "Manual (admin)",
};

const PAYMENT_LABELS: Record<BookingPaymentMethod, string> = {
  PENDING: "Pendiente",
  CASH_AT_VENUE: "Efectivo en pista",
  ONLINE: "Online",
  PAID_MANUAL: "Cobrado manualmente",
};

const PARTICIPANT_STATUS_LABELS: Record<BookingParticipantStatus, string> = {
  INVITED: "Invitado",
  ACCEPTED: "Confirmado",
  AUTO_ACCEPTED: "Auto-confirmado",
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
  const { id } = use(params);
  const { role, clubId } = useRole();
  const qc = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: bookingsQK.bookingDetail(id),
    queryFn: () => bookingsService.bookings.detail(id),
    enabled: !!id && !!clubId && isClub(role),
  });

  const cancelMut = useMutation({
    mutationFn: () => bookingsService.bookings.cancel(id, reason || undefined),
    onSuccess: () => {
      toast.success("Reserva cancelada — jugadores notificados");
      setShowCancel(false);
      setReason("");
      qc.invalidateQueries({ queryKey: bookingsQK.bookingDetail(id) });
      qc.invalidateQueries({ queryKey: ["bookings", "list"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error al cancelar";
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
      <div className="p-6">
        <BackLink />
        <Header title="Reserva" />
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <BackLink />
        <Header title="Reserva" />
        <p className="mt-6 text-sm text-muted-foreground">
          Reserva no encontrada o sin permisos.
        </p>
      </div>
    );
  }

  const b = query.data;
  const start = new Date(b.startsAt);
  const end = new Date(b.endsAt);
  const dateStr = start.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const timeStr = `${start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  const isOpen = b.matchMode === "OPEN";
  const canCancel = !["CANCELLED", "COMPLETED", "WITHOUT_RESULT"].includes(b.status);

  return (
    <div className="p-6 max-w-4xl">
      <BackLink />
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reserva <span className="font-mono text-primary">{b.shortCode}</span>
          </h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
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
                <Flame className="h-3 w-3" /> {b.openMatchSlotsRemaining}/4 libres
              </span>
            )}
          </div>
        </div>
        {canCancel && (
          <Button variant="outline" size="sm" onClick={() => setShowCancel(true)}>
            <X className="h-3.5 w-3.5" /> Cancelar reserva
          </Button>
        )}
      </div>

      {/* Resumen */}
      <Section title="Resumen">
        <Row icon={MapPin} label="Pista">
          {b.court?.name ?? "—"}
          {b.court?.isIndoor && <span className="ml-1 text-xs text-muted-foreground">(cubierta)</span>}
          {b.court?.type && <span className="ml-1 text-xs text-muted-foreground">· {b.court.type}</span>}
        </Row>
        <Row icon={Calendar} label="Fecha">
          <span className="capitalize">{dateStr}</span>
        </Row>
        <Row icon={Clock} label="Horario">
          {timeStr} · {b.durationMinutes} min
        </Row>
        <Row icon={CreditCard} label="Precio">
          {(b.priceCents / 100).toFixed(2)} €
          <span className="ml-2 text-xs text-muted-foreground">
            ({PAYMENT_LABELS[b.paymentMethod]})
          </span>
          {b.paidAt && (
            <span className="ml-2 text-xs text-green-500">
              · pagada {new Date(b.paidAt).toLocaleDateString("es-ES")}
            </span>
          )}
        </Row>
        {b.priceBreakdown.extras.length > 0 && (
          <div className="ml-7 text-xs text-muted-foreground">
            Incluye: {b.priceBreakdown.extras.map((e) => `${e.name} (${(e.cents / 100).toFixed(2)}€)`).join(", ")}
          </div>
        )}
        {isOpen && (b.openMatchMinLspa !== null || b.openMatchMaxLspa !== null) && (
          <Row icon={Trophy} label="Rango LSPA">
            {b.openMatchMinLspa ?? "—"} a {b.openMatchMaxLspa ?? "—"}
          </Row>
        )}
      </Section>

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
            {b.cancelledAt ? new Date(b.cancelledAt).toLocaleString("es-ES") : "—"}
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
            Aceptadas el {new Date(b.rulesAcceptedAt).toLocaleString("es-ES")}
            {b.rulesVersion && ` (versión ${b.rulesVersion})`}
          </p>
        </Section>
      )}

      {/* Metadata */}
      <Section title="Metadata">
        <Row icon={Clock} label="Creada">
          {new Date(b.createdAt).toLocaleString("es-ES")}
        </Row>
        <Row icon={Clock} label="Actualizada">
          {new Date(b.updatedAt).toLocaleString("es-ES")}
        </Row>
        {b.reminder24hSentAt && (
          <p className="ml-7 text-xs text-muted-foreground">
            Recordatorio 24h enviado: {new Date(b.reminder24hSentAt).toLocaleString("es-ES")}
          </p>
        )}
        {b.reminder2hSentAt && (
          <p className="ml-7 text-xs text-muted-foreground">
            Recordatorio 2h enviado: {new Date(b.reminder2hSentAt).toLocaleString("es-ES")}
          </p>
        )}
      </Section>

      {/* Cancel dialog */}
      {showCancel && canCancel && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm font-medium text-destructive">¿Cancelar esta reserva?</p>
          <p className="text-xs text-muted-foreground">
            Se notificará a los {b.participants?.length ?? 0} participantes por push y email.
          </p>
          <input
            type="text"
            placeholder="Motivo (opcional, visible al jugador)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCancel(false)} disabled={cancelMut.isPending}>
              No, volver
            </Button>
            <Button variant="destructive" size="sm" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
              {cancelMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Sí, cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
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
          <span className="text-xs text-muted-foreground">(invitado externo)</span>
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

function BackLink() {
  return (
    <Link
      href="/mi-club/reservas/bookings"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3" /> Volver al listado
    </Link>
  );
}
