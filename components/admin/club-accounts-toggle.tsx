"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { accountsService } from "@/lib/services/accounts";
import { accountsErrorText } from "@/lib/utils/booking-parts";

/**
 * Interruptor del módulo «Cuentas» de un club (solo AMT): cobro de reservas por
 * partes, socios del Bizum y precios especiales. Apagado, el club sigue como
 * antes; lo ya apuntado no se borra.
 */
export function ClubAccountsToggle({ clubId, enabled }: { clubId: string; enabled: boolean }) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (next: boolean) => accountsService.setEnabled(clubId, next),
    onSuccess: async ({ accountsEnabled }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-clubs"] }),
        qc.invalidateQueries({ queryKey: ["my-club", clubId] }),
      ]);
      toast.success(accountsEnabled ? "Módulo Cuentas activado" : "Módulo Cuentas desactivado");
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">Módulo Cuentas</p>
        <p className="text-[10px] text-muted-foreground">Cobro por partes, socios del Bizum y precios especiales</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Módulo Cuentas"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60 ${
          enabled ? "border-[rgba(212,175,55,0.5)] bg-[#D4AF37]" : "border-border bg-secondary"
        }`}
      >
        {toggle.isPending ? (
          <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        )}
      </button>
    </div>
  );
}
