"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Handshake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import {
  AMT_PLAN_NOTES_MAX_LENGTH,
  amtPlanFormSchema,
  amtPlanFormValues,
  planLabel,
  planUsesCommission,
  planUsesFee,
  toAmtPlanPayload,
  type AmtPlanFormValues,
} from "@/lib/utils/amt-plan";
import { amtPlanQK } from "@/components/admin/club-amt-plan-card";
import { ClubFeePaidUntilField } from "@/components/admin/club-fee-paid-until";
import type { ClubAmtPlanInternal } from "@/types";

export const amtPlanInternalQK = (clubId: string) => ["club-amt-plan-internal", clubId] as const;

const PLANS = ["FREE", "SUBSCRIPTION", "COMMISSION", "CUSTOM"] as const;

const labelClass = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const inputClass =
  "w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]";

function AmtPlanForm({ clubId, initial }: { clubId: string; initial: ClubAmtPlanInternal }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<AmtPlanFormValues>({
    resolver: zodResolver(amtPlanFormSchema),
    defaultValues: amtPlanFormValues(initial),
  });
  const plan = useWatch({ control, name: "bookingPlan" });
  const notes = useWatch({ control, name: "notes" });

  const save = useMutation({
    mutationFn: (values: AmtPlanFormValues) => adminService.clubs.updateAmtPlan(clubId, toAmtPlanPayload(values)),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: amtPlanQK(clubId) });
      qc.invalidateQueries({ queryKey: amtPlanInternalQK(clubId) });
      // Lo que ha quedado guardado (ya normalizado) pasa a ser lo de partida
      reset(amtPlanFormValues({ ...initial, ...saved }));
      toast.success("Plan de AMT guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    // Sin <form>: va dentro del formulario del club y un <form> anidado no vale
    <div
      className="space-y-4"
      onKeyDown={(e) => {
        // Intro en un campo no debe guardar el club entero
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
      }}
    >
      <label className="space-y-1.5 block">
        <span className={labelClass}>Plan</span>
        <select {...register("bookingPlan")} className={inputClass}>
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {planLabel(p)}
            </option>
          ))}
        </select>
      </label>

      {(planUsesFee(plan) || planUsesCommission(plan)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {planUsesFee(plan) && (
            <label className="space-y-1.5 block">
              <span className={labelClass}>
                Cuota mensual (€){plan === "SUBSCRIPTION" && <span className="text-destructive"> *</span>}
              </span>
              <input {...register("fee")} inputMode="decimal" placeholder="49" className={inputClass} />
              {errors.fee && <span className="text-xs text-destructive block">{errors.fee.message}</span>}
            </label>
          )}
          {planUsesCommission(plan) && (
            <label className="space-y-1.5 block">
              <span className={labelClass}>
                Comisión (%){plan === "COMMISSION" && <span className="text-destructive"> *</span>}
              </span>
              <input {...register("commission")} inputMode="decimal" placeholder="5" className={inputClass} />
              {errors.commission && <span className="text-xs text-destructive block">{errors.commission.message}</span>}
            </label>
          )}
        </div>
      )}
      {plan === "FREE" && <p className="text-xs text-muted-foreground">El plan gratuito no lleva cuota ni comisión.</p>}
      {plan === "CUSTOM" && (
        <p className="text-xs text-muted-foreground">En el acuerdo especial la cuota y la comisión son opcionales.</p>
      )}

      <label className="space-y-1.5 block">
        <span className={labelClass}>Notas internas de AMT (el club no las ve)</span>
        <textarea {...register("notes")} rows={3} className={`${inputClass} h-auto py-2 resize-y`} />
        <span className="flex justify-between text-xs">
          <span className="text-destructive">{errors.notes?.message}</span>
          <span className="text-muted-foreground">
            {notes.length}/{AMT_PLAN_NOTES_MAX_LENGTH}
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={save.isPending || !isDirty}
          onClick={handleSubmit((values) => save.mutate(values))}
          className="h-9 px-3 text-sm rounded-md border border-border text-foreground hover:bg-secondary disabled:opacity-50 flex items-center gap-2"
        >
          {save.isPending && <Loader2 size={14} className="animate-spin" />}
          Guardar plan
        </button>
      </div>
    </div>
  );
}

/**
 * Solo AMT, en la ficha del club: fija su plan, cuota, comisión y notas
 * internas, y apunta hasta cuándo está pagada la cuota. Lo que ve el club es
 * `ClubAmtPlanCard` (sin las notas). Se guarda aparte del formulario del club,
 * con su propio botón.
 */
export function ClubAmtPlanEditor({ clubId }: { clubId: string }) {
  const {
    data: plan,
    isLoading,
    isError,
  } = useQuery({
    queryKey: amtPlanInternalQK(clubId),
    queryFn: () => adminService.clubs.amtPlanInternal(clubId),
  });

  return (
    <section className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Handshake size={16} className="text-[#D4AF37]" />
        <h3 className="font-heading text-base text-foreground">Plan de AMT</h3>
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      )}
      {isError && <p className="text-xs text-destructive">No se pudo cargar el plan del club.</p>}
      {plan && <AmtPlanForm clubId={clubId} initial={plan} />}

      <div className="pt-4 border-t border-border">
        <ClubFeePaidUntilField clubId={clubId} />
      </div>
    </section>
  );
}
