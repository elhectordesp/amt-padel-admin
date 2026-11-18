"use client";

/**
 * Nueva solicitud para la bandeja de la escuela: lo que un alumno le dice al
 * entrenador (o a recepción) y que recepción decide. Un entrenador solo puede
 * elegir sus grupos y sus clases, y a quien no es cliente del club lo apunta
 * con nombre y teléfono; quien gestiona la escuela también puede buscar al
 * cliente.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import type { ClubCustomer } from "@/lib/services/club-customers";
import { invalidateSchool, schoolQK, schoolService } from "@/lib/services/school";
import { schoolRecoveryService } from "@/lib/services/school-recovery";
import { sessionLabel } from "@/lib/utils/school";
import { REQUEST_KIND_LABEL, SCHOOL_REQUEST_MESSAGE_MAX } from "@/lib/utils/school-recovery";
import type { CreateSchoolRequestPayload, SchoolRequestKind } from "@/types/school-recovery";

const KINDS: SchoolRequestKind[] = ["JOIN_GROUP", "ABSENCE", "PRIVATE_CLASS", "OTHER"];

const HINT: Record<SchoolRequestKind, string> = {
  JOIN_GROUP: "Alguien quiere apuntarse a un grupo. Al aceptarla, recepción lo da de alta en el grupo.",
  ABSENCE: "Un alumno avisa de que falta a una clase. Al aceptarla, se avisa su ausencia con la hora en que la apuntas.",
  PRIVATE_CLASS: "Alguien pide una clase particular. Recepción la gestiona y la marca como aceptada.",
  OTHER: "Cualquier otra cosa que recepción deba saber o decidir.",
};

export function SchoolRequestDialog({
  clubId,
  canPickCustomer,
  timeZone,
  onClose,
}: {
  clubId: string;
  /** Si puede buscar clientes del club (quien gestiona la escuela, no el entrenador). */
  canPickCustomer: boolean;
  timeZone: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [now] = useState(() => new Date());
  const [kind, setKind] = useState<SchoolRequestKind>("JOIN_GROUP");
  const [groupId, setGroupId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [customer, setCustomer] = useState<ClubCustomer | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");

  const needsGroup = kind === "JOIN_GROUP" || kind === "ABSENCE";
  const needsPerson = kind === "JOIN_GROUP" || kind === "PRIVATE_CLASS";

  const groups = useQuery({
    queryKey: schoolQK.groups(clubId, false),
    queryFn: () => schoolService.groups.list(clubId, false),
    enabled: needsGroup,
  });
  const group = useQuery({
    queryKey: schoolQK.group(clubId, groupId),
    queryFn: () => schoolService.groups.get(clubId, groupId),
    enabled: kind === "ABSENCE" && !!groupId,
  });

  const upcoming = (group.data?.sessions ?? []).filter((s) => s.status === "SCHEDULED" && new Date(s.startsAt) > now);
  const students = (group.data?.members ?? []).filter((m) => m.leftAt === null);

  const create = useMutation({
    mutationFn: () => {
      const text = message.trim();
      const payload: CreateSchoolRequestPayload = { kind, message: text || null };
      if (needsGroup && !groupId) throw new Error("Elige el grupo");
      if (kind === "JOIN_GROUP") payload.groupId = groupId;
      if (kind === "ABSENCE") {
        if (!sessionId) throw new Error("Elige la clase a la que falta");
        if (!studentId) throw new Error("Elige el alumno que falta");
        payload.groupId = groupId;
        payload.sessionId = sessionId;
        payload.clubCustomerId = studentId;
      }
      if (needsPerson) {
        const name = contactName.trim();
        if (customer) payload.clubCustomerId = customer.id;
        else if (name) {
          payload.contactName = name;
          payload.contactPhone = contactPhone.trim() || null;
        } else throw new Error("Indica quién es (nombre y teléfono)");
      }
      if (kind === "OTHER" && !text) throw new Error("Escribe de qué se trata");
      return schoolRecoveryService.requests.create(clubId, payload);
    },
    onSuccess: () => {
      invalidateSchool(qc, clubId);
      toast.success("Solicitud apuntada: recepción la verá en la bandeja");
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const changeKind = (next: SchoolRequestKind) => {
    setKind(next);
    setGroupId("");
    setSessionId("");
    setStudentId("");
  };

  return (
    <SchoolDialog title="Nueva solicitud" onClose={onClose} busy={create.isPending}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        noValidate
        className="space-y-4"
      >
        <label className="block text-xs text-muted-foreground">
          Tipo de solicitud
          <select
            value={kind}
            onChange={(e) => changeKind(e.target.value as SchoolRequestKind)}
            className={`${schoolInputCls} mt-1 w-full`}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {REQUEST_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <p className="-mt-2 text-xs text-muted-foreground">{HINT[kind]}</p>

        {needsGroup && (
          <label className="block text-xs text-muted-foreground">
            Grupo
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setSessionId("");
                setStudentId("");
              }}
              disabled={groups.isLoading}
              className={`${schoolInputCls} mt-1 w-full`}
            >
              <option value="">{groups.isLoading ? "Cargando..." : "Elige un grupo"}</option>
              {(groups.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {kind === "ABSENCE" && groupId && (
          <>
            <label className="block text-xs text-muted-foreground">
              Clase
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                disabled={group.isLoading}
                className={`${schoolInputCls} mt-1 w-full`}
              >
                <option value="">{group.isLoading ? "Cargando..." : "Elige la clase"}</option>
                {upcoming.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sessionLabel(s, timeZone)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Alumno que falta
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={group.isLoading}
                className={`${schoolInputCls} mt-1 w-full`}
              >
                <option value="">{group.isLoading ? "Cargando..." : "Elige al alumno"}</option>
                {students.map((m) => (
                  <option key={m.clubCustomerId} value={m.clubCustomerId}>
                    {m.name ?? "Sin nombre"}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {needsPerson && (
          <fieldset className="space-y-2">
            <legend className="text-xs text-muted-foreground">Quién</legend>
            {canPickCustomer && (
              <BookingCustomerPicker clubId={clubId} value={customer} onChange={setCustomer} />
            )}
            {!customer && (
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 block text-xs text-muted-foreground sm:col-span-1">
                  Nombre
                  <input
                    type="text"
                    maxLength={80}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className={`${schoolInputCls} mt-1 w-full`}
                  />
                </label>
                <label className="col-span-2 block text-xs text-muted-foreground sm:col-span-1">
                  Teléfono
                  <input
                    type="tel"
                    maxLength={30}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className={`${schoolInputCls} mt-1 w-full`}
                  />
                </label>
              </div>
            )}
          </fieldset>
        )}

        <label className="block text-xs text-muted-foreground">
          {kind === "OTHER" ? "Qué hay que saber" : "Notas (opcional)"}
          <textarea
            rows={3}
            maxLength={SCHOOL_REQUEST_MESSAGE_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={`${schoolInputCls} mt-1 w-full`}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Apuntar solicitud
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
