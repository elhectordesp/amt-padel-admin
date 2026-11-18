"use client";

/**
 * Recuperaciones de la escuela: los créditos de clase que ganan los alumnos
 * que avisan de que faltan (con la antelación que fija el club) o a quienes el
 * club les cancela una clase, que se gastan apuntándose a otra clase con hueco.
 * Aquí se ven, se conceden a mano y se anulan, y se ajustan las dos ventanas
 * del club (antelación del aviso y validez del crédito).
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import type { ClubCustomer } from "@/lib/services/club-customers";
import { invalidateSchool } from "@/lib/services/school";
import { schoolRecoveryQK, schoolRecoveryService } from "@/lib/services/school-recovery";
import {
  CREDIT_STATUS_LABEL,
  SCHOOL_CREDIT_NOTE_MAX,
  SCHOOL_NOTICE_HOURS_MAX,
  SCHOOL_VALID_DAYS_MAX,
  checkConfigForm,
  classDayText,
  configFormOf,
  creditText,
  dateTimeText,
} from "@/lib/utils/school-recovery";
import type { SchoolConfig, SchoolCredit, SchoolCreditStatus } from "@/types/school-recovery";

type StatusFilter = SchoolCreditStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "available", label: "Disponibles" },
  { value: "used", label: "Usadas" },
  { value: "expired", label: "Caducadas" },
  { value: "voided", label: "Anuladas" },
  { value: "all", label: "Todas" },
];

const STATUS_STYLE: Record<SchoolCreditStatus, string> = {
  available: "bg-emerald-500/15 text-emerald-500",
  used: "bg-muted text-muted-foreground",
  expired: "bg-amber-500/15 text-amber-500",
  voided: "bg-red-500/15 text-red-500",
};

function ConfigCard({ clubId, config }: { clubId: string; config: SchoolConfig }) {
  const qc = useQueryClient();
  const initial = configFormOf(config);
  const [form, setForm] = useState(initial);
  const dirty = form.recoveryNoticeHours !== initial.recoveryNoticeHours || form.recoveryValidDays !== initial.recoveryValidDays;

  const save = useMutation({
    mutationFn: () => {
      const checked = checkConfigForm(form);
      if (!checked.ok) throw new Error(checked.message);
      return schoolRecoveryService.config.update(clubId, checked.value);
    },
    onSuccess: (saved) => {
      qc.setQueryData(schoolRecoveryQK.config(clubId), saved);
      setForm(configFormOf(saved));
      toast.success("Ajustes guardados: valen para los avisos y las concesiones desde ahora");
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <form
      aria-label="Ajustes de las recuperaciones"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      noValidate
      className="space-y-3 rounded-lg border border-border p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          Antelación del aviso (horas)
          <input
            type="number"
            min={0}
            max={SCHOOL_NOTICE_HOURS_MAX}
            value={form.recoveryNoticeHours}
            onChange={(e) => setForm({ ...form, recoveryNoticeHours: e.target.value })}
            className={`${schoolInputCls} mt-1 w-full`}
          />
          <span className="mt-1 block">Quien avisa con menos antelación falta sin ganar recuperación.</span>
        </label>
        <label className="block text-xs text-muted-foreground">
          Validez del crédito (días)
          <input
            type="number"
            min={1}
            max={SCHOOL_VALID_DAYS_MAX}
            value={form.recoveryValidDays}
            onChange={(e) => setForm({ ...form, recoveryValidDays: e.target.value })}
            className={`${schoolInputCls} mt-1 w-full`}
          />
          <span className="mt-1 block">Se cuentan desde la clase perdida (o desde la concesión a mano).</span>
        </label>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Guardar ajustes
        </Button>
      </div>
    </form>
  );
}

function GrantDialog({ clubId, onClose }: { clubId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState<ClubCustomer | null>(null);
  const [note, setNote] = useState("");

  const grant = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error("Elige al cliente");
      if (!note.trim()) throw new Error("Escribe por qué se le concede");
      return schoolRecoveryService.credits.grant(clubId, customer.id, note.trim());
    },
    onSuccess: (credit) => {
      invalidateSchool(qc, clubId);
      toast.success(`Recuperación concedida a ${credit.customerName ?? "el cliente"}`);
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <SchoolDialog title="Conceder una recuperación" onClose={onClose} busy={grant.isPending}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          grant.mutate();
        }}
        noValidate
        className="space-y-4"
      >
        <BookingCustomerPicker clubId={clubId} value={customer} onChange={setCustomer} />
        <label className="block text-xs text-muted-foreground">
          Motivo
          <input
            type="text"
            maxLength={SCHOOL_CREDIT_NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Lesión, clase que no se dio, cortesía..."
            className={`${schoolInputCls} mt-1 w-full`}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          El crédito vale los días que fija el club, contados desde hoy. Quien lo recibe lo gasta apuntándose a otra
          clase con hueco.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={grant.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={grant.isPending}>
            {grant.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Conceder
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}

export function SchoolRecoveriesSection({ clubId, timeZone }: { clubId: string; timeZone: string }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("available");
  const [customer, setCustomer] = useState<ClubCustomer | null>(null);
  const [showGrant, setShowGrant] = useState(false);
  const [toVoid, setToVoid] = useState<SchoolCredit | null>(null);

  const config = useQuery({
    queryKey: schoolRecoveryQK.config(clubId),
    queryFn: () => schoolRecoveryService.config.get(clubId),
  });

  const filters = {
    ...(status === "all" ? {} : { status }),
    ...(customer ? { clubCustomerId: customer.id } : {}),
  };
  const credits = useQuery({
    queryKey: schoolRecoveryQK.credits(clubId, filters),
    queryFn: () => schoolRecoveryService.credits.list(clubId, filters),
  });

  const voidCredit = useMutation({
    mutationFn: (creditId: string) => schoolRecoveryService.credits.void(clubId, creditId),
    onSuccess: () => {
      invalidateSchool(qc, clubId);
      toast.success("Recuperación anulada");
      setToVoid(null);
    },
    onError: (err: unknown) => {
      toast.error(errorText(err));
      setToVoid(null);
    },
  });

  const list = credits.data ?? [];

  return (
    <section aria-label="Recuperaciones" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
          Las clases que los alumnos pueden recuperar: las que ganan al avisar de que faltan con margen y las que el club
          concede. Se gastan desde la ficha de una clase con hueco.
        </p>
        <Button size="sm" onClick={() => setShowGrant(true)}>
          <Plus className="h-3.5 w-3.5" /> Conceder a mano
        </Button>
      </div>

      {config.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : config.isError || !config.data ? (
        <ErrorState title="No se han podido cargar los ajustes" onRetry={() => void config.refetch()} />
      ) : (
        // Con la clave de los valores guardados, el formulario se rehace si cambian en otro sitio
        <ConfigCard
          key={`${config.data.recoveryNoticeHours}-${config.data.recoveryValidDays}`}
          clubId={clubId}
          config={config.data}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs text-muted-foreground">
          Estado
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className={`${schoolInputCls} mt-1 block`}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-56 max-w-sm flex-1 text-xs text-muted-foreground">
          Cliente
          <div className="mt-1">
            <BookingCustomerPicker clubId={clubId} value={customer} onChange={setCustomer} />
          </div>
        </div>
      </div>

      {credits.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : credits.isError ? (
        <ErrorState onRetry={() => void credits.refetch()} />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          <RotateCcw className="h-7 w-7 opacity-50" />
          No hay recuperaciones con estos filtros.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm" aria-label="Recuperaciones">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0 space-y-0.5">
                <div className="font-medium">
                  {c.customerName ?? "Sin nombre"}
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                    {CREDIT_STATUS_LABEL[c.status]}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{creditText(c, timeZone)}</div>
                {c.usedSession && (
                  <div className="text-xs text-muted-foreground">
                    Gastada en {c.usedSession.groupName}, {classDayText(c.usedSession.startsAt, timeZone)}
                  </div>
                )}
                {c.voidedAt && (
                  <div className="text-xs text-muted-foreground">Anulada el {dateTimeText(c.voidedAt, timeZone)}</div>
                )}
                {c.note && <div className="text-xs text-muted-foreground">Motivo: {c.note}</div>}
              </div>
              {c.status === "available" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setToVoid(c)}
                  aria-label={`Anular la recuperación de ${c.customerName ?? "este cliente"}`}
                >
                  <Ban className="h-3.5 w-3.5" /> Anular
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showGrant && <GrantDialog clubId={clubId} onClose={() => setShowGrant(false)} />}

      <ConfirmModal
        open={!!toVoid}
        danger
        title="Anular la recuperación"
        description={`${toVoid?.customerName ?? "El cliente"} pierde esta recuperación: ya no podrá apuntarse a una clase con ella. Si se gastó a la vez en una clase, no se anula.`}
        confirmLabel="Anular recuperación"
        cancelLabel="Volver"
        loading={voidCredit.isPending}
        onClose={() => {
          if (!voidCredit.isPending) setToVoid(null);
        }}
        onConfirm={() => toVoid && voidCredit.mutate(toVoid.id)}
      />
    </section>
  );
}
