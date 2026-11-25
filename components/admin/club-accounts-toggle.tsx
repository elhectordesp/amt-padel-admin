"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { accountsService } from "@/lib/services/accounts";
import { accountsErrorText } from "@/lib/utils/booking-parts";

/** Un interruptor de módulo con su título y su explicación (los dos de AMT lo comparten). */
function ModuleSwitch({ title, description, enabled, pending, disabled = false, onToggle }: {
  title:       string;
  description: string;
  enabled:     boolean;
  pending:     boolean;
  disabled?:   boolean;
  onToggle:    () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        disabled={pending || disabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60 ${
          enabled ? "border-[rgba(212,175,55,0.5)] bg-[#D4AF37]" : "border-border bg-secondary"
        }`}
      >
        {pending ? (
          <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        )}
      </button>
    </div>
  );
}

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
    <ModuleSwitch
      title="Módulo Cuentas"
      description="Cobro por partes, socios del Bizum y precios especiales"
      enabled={enabled}
      pending={toggle.isPending}
      onToggle={() => toggle.mutate(!enabled)}
    />
  );
}

/**
 * Interruptor de «Socios y tesorería» (solo AMT): dónde está el dinero del
 * club, traspasos y cuadres. Va sobre «Cuentas»: con Cuentas apagado no se
 * puede encender, y al apagar Cuentas se apaga también. Lo ya apuntado no se
 * borra.
 */
export function ClubTreasuryToggle({ clubId, enabled, accountsEnabled }: {
  clubId:          string;
  enabled:         boolean;
  /** Sin «Cuentas» encendido, la tesorería no se puede encender. */
  accountsEnabled: boolean;
}) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (next: boolean) => accountsService.setTreasuryEnabled(clubId, next),
    onSuccess: async ({ treasuryEnabled }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-clubs"] }),
        qc.invalidateQueries({ queryKey: ["my-club", clubId] }),
      ]);
      toast.success(treasuryEnabled ? "Socios y tesorería activados" : "Socios y tesorería desactivados");
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  return (
    <ModuleSwitch
      title="Socios y tesorería"
      description={accountsEnabled
        ? "Dónde está el dinero del club, traspasos y cuadres"
        : "Necesita el módulo Cuentas encendido"}
      enabled={enabled}
      pending={toggle.isPending}
      // Apagarla siempre se puede; encenderla, solo con Cuentas
      disabled={!enabled && !accountsEnabled}
      onToggle={() => toggle.mutate(!enabled)}
    />
  );
}
