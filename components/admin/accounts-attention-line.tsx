"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { reportsQK, reportsService, type AttentionKey } from "@/lib/services/club-reports";
import { useAccountsEnabled } from "@/lib/use-accounts-enabled";
import { useClubAccess } from "@/lib/use-club-access";

const REFRESH_MS = 5 * 60_000;

/** Los avisos que la portada ya enseña con su propio bloque: aquí no se repiten. */
export const AVISOS_YA_EN_PORTADA: readonly AttentionKey[] = ["DEBTS_WARN", "UNCLOSED_DAYS", "LOW_STOCK"];

/**
 * «Cuentas: N avisos» de la portada (F8, C4): cuántas cosas piden atención en
 * las cuentas del club, con enlace al «Resumen». No cuenta las que la portada
 * ya enseña (deudas que avisan, días sin cerrar, poco stock). Solo con el
 * módulo «Cuentas» y para propietario y gestor; sin avisos, no sale.
 */
export function AccountsAttentionLine({ clubId }: { clubId: string }) {
  const accountsEnabled = useAccountsEnabled(clubId);
  const canSeeAccounts = useClubAccess().can("accounts", "read");
  const enabled = accountsEnabled && canSeeAccounts;
  const query = useQuery({
    queryKey: reportsQK.attention(clubId),
    queryFn: () => reportsService.attention(clubId),
    enabled,
    refetchInterval: REFRESH_MS,
  });

  if (!enabled || !query.data) return null;
  const count = query.data.items.filter((i) => !AVISOS_YA_EN_PORTADA.includes(i.key)).length;
  if (count === 0) return null;
  return (
    <Link
      href="/mi-club/cuentas?tab=resumen"
      className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-foreground hover:bg-amber-500/20"
    >
      <AlertTriangle size={14} className="shrink-0 text-amber-500" />
      <span className="flex-1">Cuentas: {count} {count === 1 ? "aviso" : "avisos"}</span>
      <span className="text-xs text-muted-foreground">Ver el resumen ›</span>
    </Link>
  );
}
