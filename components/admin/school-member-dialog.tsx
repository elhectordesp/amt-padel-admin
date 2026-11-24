"use client";

/**
 * El alumno dentro de un grupo (F8-C3): cómo paga (cuota mensual o bono de
 * clases), su descuento fijo con motivo y su baja temporal con su vuelta
 * prevista. Al guardar, el back anula las cuotas sin pagos que ya no tocan y
 * avisa de las que tienen pagos y se quedan como están.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { schoolService } from "@/lib/services/school";
import { formatCents } from "@/lib/utils/booking-price";
import {
  BILLING_LABEL,
  MEMBER_REASON_MAX,
  checkMemberForm,
  memberFormOf,
  type MemberFormValues,
} from "@/lib/utils/school-member";
import { zonedDayKey } from "@/lib/utils/time-zone";
import type { SchoolGroupMember, SchoolMemberBilling } from "@/types/school";

export function SchoolMemberDialog({
  clubId, groupId, groupFeeCents, member, timeZone, onSaved, onClose,
}: {
  clubId:        string;
  groupId:       string;
  /** La cuota del grupo, en céntimos; null: el grupo no cobra cuota. */
  groupFeeCents: number | null;
  member:        SchoolGroupMember;
  timeZone:      string;
  /** Tras guardar: recargar lo que corresponda. */
  onSaved:       () => void;
  onClose:       () => void;
}) {
  const today = zonedDayKey(new Date(), timeZone);
  const [form, setForm] = useState<MemberFormValues>(() => memberFormOf(member, today));
  const set = (patch: Partial<MemberFormValues>) => setForm((f) => ({ ...f, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      const checked = checkMemberForm(form, member, groupFeeCents, today);
      if (!checked.ok) throw new Error(checked.message);
      if (Object.keys(checked.value).length === 0) return null;
      return schoolService.members.update(clubId, groupId, member.id, checked.value);
    },
    onSuccess: (result) => {
      onSaved();
      toast.success(result ? "Alumno guardado" : "No había cambios");
      for (const w of result?.warnings ?? []) toast.warning(w);
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });
  const close = () => { if (!save.isPending) onClose(); };
  const voucher = form.billing === "VOUCHER";

  return (
    <SchoolDialog title={`${member.name ?? "Alumno"}: pago y baja`} onClose={close} busy={save.isPending}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="block text-xs text-muted-foreground">
          Forma de pago
          <select
            value={form.billing}
            onChange={(e) => set({ billing: e.target.value as SchoolMemberBilling })}
            disabled={save.isPending}
            className={`${schoolInputCls} mt-1 w-full`}
          >
            {(Object.keys(BILLING_LABEL) as SchoolMemberBilling[]).map((b) => (
              <option key={b} value={b}>
                {BILLING_LABEL[b]}
              </option>
            ))}
          </select>
        </label>
        {voucher ? (
          <p className="-mt-2 text-xs text-muted-foreground">
            No se le genera cuota: cada clase a la que viene se descuenta de su bono de clases al pasar lista.
            Al cambiar, se anulan las cuotas sin pagos de los meses siguientes.
          </p>
        ) : groupFeeCents !== null ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">
              Descuento en cada cuota (€, opcional)
              <input
                type="text"
                inputMode="decimal"
                value={form.discount}
                onChange={(e) => set({ discount: e.target.value })}
                disabled={save.isPending}
                placeholder={`De 0 a ${formatCents(groupFeeCents)}`}
                className={`${schoolInputCls} mt-1 w-full`}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Motivo del descuento
              <input
                type="text"
                maxLength={MEMBER_REASON_MAX}
                value={form.discountReason}
                onChange={(e) => set({ discountReason: e.target.value })}
                disabled={save.isPending}
                placeholder="Hermanos, familia numerosa…"
                className={`${schoolInputCls} mt-1 w-full`}
              />
            </label>
          </div>
        ) : (
          <p className="-mt-2 text-xs text-muted-foreground">El grupo no tiene cuota mensual: no hay descuento que poner.</p>
        )}

        <fieldset className="space-y-3 rounded-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Baja temporal</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.paused}
              onChange={(e) => set({ paused: e.target.checked, pausedFrom: e.target.checked && !form.pausedFrom ? today : form.pausedFrom })}
              disabled={save.isPending}
            />
            De baja temporalmente
          </label>
          {form.paused && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs text-muted-foreground">
                  Desde
                  <input
                    type="date"
                    value={form.pausedFrom}
                    onChange={(e) => set({ pausedFrom: e.target.value })}
                    disabled={save.isPending}
                    className={`${schoolInputCls} mt-1 w-full`}
                  />
                </label>
                <label className="block text-xs text-muted-foreground">
                  Vuelve el… (opcional)
                  <input
                    type="date"
                    value={form.pausedUntil}
                    min={form.pausedFrom || undefined}
                    onChange={(e) => set({ pausedUntil: e.target.value })}
                    disabled={save.isPending}
                    className={`${schoolInputCls} mt-1 w-full`}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="block min-w-48 flex-1 text-xs text-muted-foreground">
                  Motivo
                  <input
                    type="text"
                    maxLength={MEMBER_REASON_MAX}
                    value={form.pauseReason}
                    onChange={(e) => set({ pauseReason: e.target.value })}
                    disabled={save.isPending}
                    placeholder="Lesión, viaje…"
                    className={`${schoolInputCls} mt-1 w-full`}
                  />
                </label>
                <Button type="button" variant="outline" size="sm" disabled={save.isPending} onClick={() => set({ pausedUntil: today })}>
                  Reactivar hoy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                El mes en que empieza la baja se paga entero; los meses que cubre entera no tienen cuota. Al volver a
                mitad de mes, la cuota se prorratea por las clases que quedan.
              </p>
            </>
          )}
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={close} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
