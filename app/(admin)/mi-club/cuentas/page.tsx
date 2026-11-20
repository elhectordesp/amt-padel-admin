/**
 * /mi-club/cuentas — el módulo «Cuentas» del club: los socios a cuyo móvil
 * llega un Bizum y los precios especiales con nombre (alumno, amigos...). Solo
 * propietario y gestor, y solo con el módulo encendido (lo enciende AMT).
 */

"use client";

import { Loader2 } from "lucide-react";
import { AccountsDebtsSection } from "@/components/admin/accounts-debts-section";
import { AccountsConfigSection } from "@/components/admin/accounts-config-section";
import { AccountsPartPricesSection } from "@/components/admin/accounts-part-prices-section";
import { AccountsPartnersSection } from "@/components/admin/accounts-partners-section";
import { ErrorState } from "@/components/admin/error-state";
import { Header } from "@/components/admin/header";
import { useClubAccounts } from "@/lib/use-accounts-enabled";
import { useRole, isClub } from "@/lib/use-role";

export default function CuentasPage() {
  const { role, clubId } = useRole();
  const enabled = !!clubId && isClub(role);
  const accounts = useClubAccounts(clubId, enabled);

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!enabled) {
    return (
      <>
        <Header title="Cuentas" />
        <p className="p-4 sm:p-6 text-sm text-muted-foreground">Requiere usuario CLUB con club asignado.</p>
      </>
    );
  }

  return (
    <>
      <Header title="Cuentas" />
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
        {accounts.isError ? (
          <ErrorState title="No se pudo cargar tu club" onRetry={() => accounts.refetch()} />
        ) : !accounts.known ? (
          <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />
        ) : !accounts.on ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            El módulo Cuentas no está activado en tu club. Si lo quieres, pídeselo a AMT.
          </p>
        ) : (
          <>
            <AccountsPartnersSection clubId={clubId} />
            <AccountsPartPricesSection clubId={clubId} />
            <AccountsConfigSection clubId={clubId} />
            <AccountsDebtsSection clubId={clubId} />
          </>
        )}
      </div>
    </>
  );
}
