"use client";

/**
 * Ajustes de las cuotas de la escuela (F8-C3): el día del mes hasta el que se
 * pueden pagar sin estar «atrasadas» y si se generan solas cada mes (el sistema
 * crea cada hora las que falten del mes en curso, prorrateadas si el alumno
 * entró a mitad de mes; nunca repite ni cambia una que ya existe).
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/admin/error-state";
import { errorText } from "@/components/admin/price-seasons-panel";
import { schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { schoolRecoveryQK, schoolRecoveryService } from "@/lib/services/school-recovery";
import { FEE_DUE_DAY_MAX, FEE_DUE_DAY_MIN, checkFeeSettings, feeSettingsOf } from "@/lib/utils/school-billing";
import type { SchoolConfig } from "@/types/school-recovery";

export function SchoolFeeSettings({ clubId, canWrite }: { clubId: string; canWrite: boolean }) {
  const config = useQuery({
    queryKey: schoolRecoveryQK.config(clubId),
    queryFn: () => schoolRecoveryService.config.get(clubId),
  });
  if (config.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (config.isError || !config.data) {
    return <ErrorState title="No se han podido cargar los ajustes de las cuotas" onRetry={() => void config.refetch()} />;
  }
  // Con la clave de los valores guardados, el formulario se rehace si cambian en otro sitio
  return (
    <SettingsForm
      key={`${config.data.feeDueDay}-${config.data.autoGenerateFees}`}
      clubId={clubId}
      config={config.data}
      canWrite={canWrite}
    />
  );
}

function SettingsForm({ clubId, config, canWrite }: { clubId: string; config: SchoolConfig; canWrite: boolean }) {
  const qc = useQueryClient();
  const initial = feeSettingsOf(config);
  const [form, setForm] = useState(initial);
  const dirty = form.feeDueDay !== initial.feeDueDay || form.autoGenerateFees !== initial.autoGenerateFees;

  const save = useMutation({
    mutationFn: () => {
      const checked = checkFeeSettings(form);
      if (!checked.ok) throw new Error(checked.message);
      return schoolRecoveryService.config.update(clubId, checked.value);
    },
    onSuccess: (saved) => {
      qc.setQueryData(schoolRecoveryQK.config(clubId), saved);
      // La fecha límite cambia qué cuotas están atrasadas
      void qc.invalidateQueries({ queryKey: ["school-billing", clubId] });
      toast.success("Ajustes de las cuotas guardados");
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <form
      aria-label="Ajustes de las cuotas"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="flex flex-wrap items-end gap-4 rounded-lg border border-border p-3"
    >
      <label className="block text-xs text-muted-foreground">
        Día límite de pago
        <input
          type="number"
          min={FEE_DUE_DAY_MIN}
          max={FEE_DUE_DAY_MAX}
          value={form.feeDueDay}
          onChange={(e) => setForm({ ...form, feeDueDay: e.target.value })}
          disabled={!canWrite || save.isPending}
          className={`${schoolInputCls} mt-1 block w-24`}
        />
        <span className="mt-1 block">Pasado ese día del mes, la cuota sin pagar sale «atrasada».</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.autoGenerateFees}
          onChange={(e) => setForm({ ...form, autoGenerateFees: e.target.checked })}
          disabled={!canWrite || save.isPending}
        />
        Generar las cuotas solas cada mes
      </label>
      {canWrite && (
        <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Guardar ajustes
        </Button>
      )}
    </form>
  );
}
