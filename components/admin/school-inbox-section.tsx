"use client";

/**
 * Bandeja de la escuela: lo que el entrenador apunta de lo que le dicen los
 * alumnos (altas, ausencias, clases particulares, otras cosas) y que recepción
 * decide. Aceptar hace lo que pide (apunta al grupo, avisa la ausencia) y es
 * definitivo; rechazar guarda el motivo. El entrenador solo ve las suyas y las
 * de sus grupos, y no las resuelve.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Inbox, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { ErrorState } from "@/components/admin/error-state";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { SchoolRequestDialog } from "@/components/admin/school-request-dialog";
import { Button } from "@/components/ui/button";
import type { ClubCustomer } from "@/lib/services/club-customers";
import { invalidateSchool } from "@/lib/services/school";
import { schoolRecoveryQK, schoolRecoveryService } from "@/lib/services/school-recovery";
import { classDayText, dateTimeText, REQUEST_KIND_LABEL, requestWho } from "@/lib/utils/school-recovery";
import type { SchoolRequest } from "@/types/school-recovery";

/** Lo que pasará al aceptarla, en una frase. */
function acceptText(r: SchoolRequest): string {
  const who = requestWho(r);
  switch (r.kind) {
    case "JOIN_GROUP":
      return `Se apuntará a ${who} al grupo ${r.group?.name ?? "de la solicitud"}.`;
    case "ABSENCE":
      return `Se avisará la ausencia de ${who}, con la hora en que se apuntó la solicitud. Si avisó con margen suficiente, gana una recuperación.`;
    default:
      return "Se marca como aceptada: la gestión de esta solicitud la haces fuera de aquí.";
  }
}

function RequestCard({
  request,
  timeZone,
  canResolve,
  onAccept,
  onReject,
}: {
  request: SchoolRequest;
  timeZone: string;
  canResolve: boolean;
  onAccept: (r: SchoolRequest) => void;
  onReject: (r: SchoolRequest) => void;
}) {
  const r = request;
  const pending = r.status === "PENDING";
  return (
    <li className="space-y-1.5 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal">{REQUEST_KIND_LABEL[r.kind]}</span>
          {requestWho(r)}
          {!r.customerName && r.contactPhone && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{r.contactPhone}</span>
          )}
        </span>
        {!pending && (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              r.status === "ACCEPTED" ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
            }`}
          >
            {r.status === "ACCEPTED" ? "Aceptada" : "Rechazada"}
          </span>
        )}
      </div>

      {(r.group || r.session || r.coach) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {r.group && <span>Grupo: {r.group.name}</span>}
          {r.session && (
            <span>
              Clase: {r.session.groupName}, {classDayText(r.session.startsAt, timeZone)}
            </span>
          )}
          {r.coach && <span>Entrenador: {r.coach.name}</span>}
        </div>
      )}
      {r.message && <p className="whitespace-pre-line text-muted-foreground">{r.message}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <span className="text-xs text-muted-foreground">
          Apuntada por {r.createdBy} el {dateTimeText(r.createdAt, timeZone)}
          {!pending && r.resolvedAt && (
            <>
              {" "}
              · {r.status === "ACCEPTED" ? "aceptada" : "rechazada"}
              {r.resolvedBy ? ` por ${r.resolvedBy}` : ""} el {dateTimeText(r.resolvedAt, timeZone)}
              {r.resolutionNote ? `: ${r.resolutionNote}` : ""}
            </>
          )}
        </span>
        {pending && canResolve && (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => onReject(r)} aria-label={`Rechazar la solicitud de ${requestWho(r)}`}>
              <X className="h-3.5 w-3.5" /> Rechazar
            </Button>
            <Button size="sm" onClick={() => onAccept(r)} aria-label={`Aceptar la solicitud de ${requestWho(r)}`}>
              <Check className="h-3.5 w-3.5" /> Aceptar
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function AcceptDialog({
  clubId,
  request,
  canPickCustomer,
  onClose,
}: {
  clubId: string;
  request: SchoolRequest;
  canPickCustomer: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // Un alta sin cliente del club (alguien que aún no lo es): hay que elegir o dar de alta al cliente
  const needsCustomer = request.kind === "JOIN_GROUP" && !request.clubCustomerId;
  const [customer, setCustomer] = useState<ClubCustomer | null>(null);

  const accept = useMutation({
    mutationFn: () => schoolRecoveryService.requests.accept(clubId, request.id, customer ? { clubCustomerId: customer.id } : {}),
    onSuccess: () => {
      invalidateSchool(qc, clubId);
      toast.success(
        request.kind === "JOIN_GROUP"
          ? `${requestWho(request)} se ha apuntado al grupo`
          : request.kind === "ABSENCE"
            ? "Ausencia avisada"
            : "Solicitud aceptada",
      );
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <SchoolDialog title="Aceptar la solicitud" onClose={onClose} busy={accept.isPending}>
      <div className="space-y-4">
        <p className="text-sm">{acceptText(request)}</p>
        <p className="text-xs text-muted-foreground">Es definitivo: una solicitud resuelta no se vuelve a abrir.</p>

        {needsCustomer && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {request.contactName ?? "Esta persona"} no es aún cliente del club. Elige su ficha o dala de alta aquí.
            </p>
            {canPickCustomer ? (
              <BookingCustomerPicker clubId={clubId} value={customer} onChange={setCustomer} />
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={accept.isPending}>
            Volver
          </Button>
          <Button size="sm" disabled={accept.isPending || (needsCustomer && !customer)} onClick={() => accept.mutate()}>
            {accept.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Aceptar
          </Button>
        </div>
      </div>
    </SchoolDialog>
  );
}

function RejectDialog({ clubId, request, onClose }: { clubId: string; request: SchoolRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const reject = useMutation({
    mutationFn: () => schoolRecoveryService.requests.reject(clubId, request.id, note.trim() || undefined),
    onSuccess: () => {
      invalidateSchool(qc, clubId);
      toast.success("Solicitud rechazada");
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <SchoolDialog title="Rechazar la solicitud" onClose={onClose} busy={reject.isPending}>
      <div className="space-y-4">
        <p className="text-sm">
          Solicitud de {requestWho(request)} ({REQUEST_KIND_LABEL[request.kind].toLowerCase()}). Queda rechazada y no se
          vuelve a abrir.
        </p>
        <label className="block text-xs text-muted-foreground">
          Motivo (opcional)
          <input
            type="text"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Grupo completo, fuera de horario..."
            className={`${schoolInputCls} mt-1 w-full`}
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={reject.isPending}>
            Volver
          </Button>
          <Button variant="destructive" size="sm" disabled={reject.isPending} onClick={() => reject.mutate()}>
            {reject.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Rechazar
          </Button>
        </div>
      </div>
    </SchoolDialog>
  );
}

export function SchoolInboxSection({
  clubId,
  timeZone,
  canWrite,
  canPickCustomer,
}: {
  clubId: string;
  timeZone: string;
  /** Si resuelve solicitudes (acepta y rechaza); el entrenador solo las apunta y las ve. */
  canWrite: boolean;
  canPickCustomer: boolean;
}) {
  const [showNew, setShowNew] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [accepting, setAccepting] = useState<SchoolRequest | null>(null);
  const [rejecting, setRejecting] = useState<SchoolRequest | null>(null);

  const pending = useQuery({
    queryKey: schoolRecoveryQK.requests(clubId, "PENDING"),
    queryFn: () => schoolRecoveryService.requests.list(clubId, "PENDING"),
  });
  const history = useQuery({
    queryKey: schoolRecoveryQK.requests(clubId, "RESOLVED"),
    queryFn: () => schoolRecoveryService.requests.list(clubId, "RESOLVED"),
    enabled: showHistory,
  });

  const open = pending.data ?? [];

  return (
    <section aria-label="Bandeja" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
          {canWrite
            ? "Lo que los entrenadores apuntan de lo que les dicen los alumnos. Aceptar lo hace (apunta al grupo, avisa la ausencia) y es definitivo."
            : "Apunta lo que te dicen tus alumnos: recepción lo verá aquí y lo decidirá."}
        </p>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> Nueva solicitud
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-medium">
          Pendientes{" "}
          <span className="text-sm font-normal text-muted-foreground" aria-label={`${open.length} pendientes`}>
            {open.length}
          </span>
        </h2>
        {pending.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : pending.isError ? (
          <ErrorState onRetry={() => void pending.refetch()} />
        ) : open.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            <Inbox className="h-7 w-7 opacity-50" />
            No hay solicitudes pendientes.
          </div>
        ) : (
          <ul className="space-y-2">
            {open.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                timeZone={timeZone}
                canResolve={canWrite}
                onAccept={setAccepting}
                onReject={setRejecting}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Button variant="ghost" size="sm" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "Ocultar historial" : "Ver historial"}
        </Button>
        {showHistory &&
          (history.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : history.isError ? (
            <ErrorState onRetry={() => void history.refetch()} />
          ) : (history.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
              Aún no hay solicitudes resueltas.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="Historial de solicitudes">
              {(history.data ?? []).map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  timeZone={timeZone}
                  canResolve={false}
                  onAccept={setAccepting}
                  onReject={setRejecting}
                />
              ))}
            </ul>
          ))}
      </div>

      {showNew && (
        <SchoolRequestDialog
          clubId={clubId}
          canPickCustomer={canPickCustomer}
          timeZone={timeZone}
          onClose={() => setShowNew(false)}
        />
      )}
      {accepting && (
        <AcceptDialog
          clubId={clubId}
          request={accepting}
          canPickCustomer={canPickCustomer}
          onClose={() => setAccepting(null)}
        />
      )}
      {rejecting && <RejectDialog clubId={clubId} request={rejecting} onClose={() => setRejecting(null)} />}
    </section>
  );
}
