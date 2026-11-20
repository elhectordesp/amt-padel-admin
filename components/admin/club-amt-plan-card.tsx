"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Handshake, AlertTriangle } from "lucide-react";
import { adminService } from "@/lib/services/admin";
import { feeText, overdueNotice, paidUntilText, planLabel } from "@/lib/utils/amt-plan";

export const amtPlanQK = (clubId: string) => ["club-amt-plan", clubId] as const;

/** Plan del club con AMT; solo lo abren propietario, gestor y AMT (el back lo niega al resto). */
export function useAmtPlan(clubId: string, enabled = true) {
  return useQuery({
    queryKey: amtPlanQK(clubId),
    queryFn: () => adminService.clubs.amtPlan(clubId),
    enabled,
    staleTime: 60_000,
  });
}

/** Línea roja de cuota vencida; no sale si el plan está al día. */
export function AmtFeeOverdueNotice({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-red-500">
      <AlertTriangle size={14} className="shrink-0" />
      {notice}
    </p>
  );
}

/**
 * «Tu plan en AMT»: plan, cuota y hasta cuándo está pagada. AMT lo apunta a
 * mano; no hay facturas desde la plataforma.
 */
export function ClubAmtPlanCard({ clubId }: { clubId: string }) {
  const { data: plan, isLoading, isError } = useAmtPlan(clubId);

  return (
    <section className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Handshake size={18} className="text-[#D4AF37]" />
        <h2 className="font-heading text-lg text-foreground">Tu plan en AMT</h2>
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      )}
      {isError && <p className="text-xs text-destructive">No se pudo cargar tu plan.</p>}

      {plan && (
        <div className="space-y-3">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan</dt>
              <dd className="text-foreground">{planLabel(plan.bookingPlan)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cuota</dt>
              <dd className="text-foreground">{feeText(plan) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagado hasta</dt>
              <dd className="text-foreground">{paidUntilText(plan.feePaidUntil) ?? "—"}</dd>
            </div>
          </dl>
          <AmtFeeOverdueNotice notice={overdueNotice(plan)} />
        </div>
      )}
    </section>
  );
}
