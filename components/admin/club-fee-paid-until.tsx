"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import { amtPlanQK, useAmtPlan } from "@/components/admin/club-amt-plan-card";

/**
 * Solo AMT: hasta qué día tiene el club pagada la cuota (se puede vaciar). Se
 * guarda aparte del formulario del club, con su propio botón.
 */
export function ClubFeePaidUntilField({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const { data: plan } = useAmtPlan(clubId);
  // Lo que ha tecleado AMT; mientras no toca nada, lo guardado
  const [edited, setEdited] = useState<string | null>(null);
  const value = edited ?? plan?.feePaidUntil ?? "";

  const save = useMutation({
    mutationFn: (day: string) => adminService.clubs.setFeePaidUntil(clubId, day || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: amtPlanQK(clubId) });
      setEdited(null);
      toast.success("Fecha de pago guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Cuota pagada hasta
      </span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => setEdited(e.target.value)}
          aria-label="Cuota pagada hasta"
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
        <button
          type="button"
          disabled={save.isPending || edited === null}
          onClick={() => save.mutate(value)}
          className="h-9 px-3 text-sm rounded-md border border-border text-foreground hover:bg-secondary disabled:opacity-50 flex items-center gap-2"
        >
          {save.isPending && <Loader2 size={14} className="animate-spin" />}
          Apuntar fecha
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Vacío = sin dato. Con plan de pago, sin fecha cuenta como pendiente.</p>
    </div>
  );
}
