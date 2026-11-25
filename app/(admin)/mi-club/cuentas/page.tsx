/**
 * /mi-club/cuentas — el módulo «Cuentas» del club, en pestañas (?tab=): el
 * resumen (la de por defecto para quien tiene `accounts`), gastos e ingresos con
 * sus fijos, entrenadores, ocupación de pistas, tesorería y socios y reparto
 * (solo con la tesorería encendida: dónde está el dinero y cómo se reparte el
 * beneficio), deudas (con las cuentas
 * abiertas), tienda y ajustes (socios a cuyo móvil llega un Bizum, precios
 * especiales, configuración y categorías). Solo con el módulo encendido (lo
 * enciende AMT); resumen, gastos, entrenadores y ocupación, solo propietario y
 * gestor.
 */

"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AccountsDebtsSection } from "@/components/admin/accounts-debts-section";
import { AccountsConfigSection } from "@/components/admin/accounts-config-section";
import { AccountsOccupancySection } from "@/components/admin/accounts-occupancy-section";
import { AccountsProfitSection } from "@/components/admin/accounts-profit-section";
import { AccountsPartPricesSection } from "@/components/admin/accounts-part-prices-section";
import { AccountsPartnersSection } from "@/components/admin/accounts-partners-section";
import { AccountsShopSection } from "@/components/admin/accounts-shop-section";
import { AccountsSummarySection } from "@/components/admin/accounts-summary-section";
import { AccountsTreasurySection } from "@/components/admin/accounts-treasury-section";
import { CoachesSection } from "@/components/admin/coaches-section";
import { ErrorState } from "@/components/admin/error-state";
import { Header } from "@/components/admin/header";
import { LedgerCategoriesSection } from "@/components/admin/ledger-categories-section";
import { LedgerEntriesSection } from "@/components/admin/ledger-entries-section";
import { OpenAccountsSection } from "@/components/admin/open-accounts-section";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubAccounts } from "@/lib/use-accounts-enabled";
import { useRole, isClub } from "@/lib/use-role";

// `needsTreasury`: solo con la tesorería encendida (la enciende AMT sobre «Cuentas»)
const TABS = [
  { id: "resumen",      label: "Resumen",           needsAccounts: true,  needsTreasury: false },
  { id: "gastos",      label: "Gastos e ingresos", needsAccounts: true,  needsTreasury: false },
  { id: "entrenadores", label: "Entrenadores",      needsAccounts: true,  needsTreasury: false },
  { id: "ocupacion",    label: "Ocupación",         needsAccounts: true,  needsTreasury: false },
  { id: "tesoreria",    label: "Tesorería",         needsAccounts: true,  needsTreasury: true },
  { id: "socios",       label: "Socios y reparto",  needsAccounts: true,  needsTreasury: true },
  { id: "deudas",       label: "Deudas",           needsAccounts: false, needsTreasury: false },
  { id: "tienda",       label: "Tienda",            needsAccounts: false, needsTreasury: false },
  { id: "ajustes",      label: "Ajustes",           needsAccounts: false, needsTreasury: false },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CuentasPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />}>
      <CuentasContent />
    </Suspense>
  );
}

function CuentasContent() {
  const { role, clubId } = useRole();
  const enabled = !!clubId && isClub(role);
  const accounts = useClubAccounts(clubId, enabled);
  const { can } = useClubAccess();
  const canAccounts = can("accounts", "read");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tabs = TABS.filter((t) => (canAccounts || !t.needsAccounts) && (accounts.treasuryOn || !t.needsTreasury));
  const asked = params.get("tab");
  const tab: TabId = tabs.find((t) => t.id === asked)?.id ?? tabs[0].id;
  const select = (id: TabId) => router.replace(`${pathname}?tab=${id}`, { scroll: false });

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
            <div role="tablist" aria-label="Cuentas" className="flex gap-1 overflow-x-auto border-b border-border">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`cuentas-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="cuentas-panel"
                  onClick={() => select(t.id)}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors max-[1024px]:min-h-11 ${
                    tab === t.id
                      ? "border-[#D4AF37] text-[#D4AF37]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div id="cuentas-panel" role="tabpanel" aria-labelledby={`cuentas-tab-${tab}`} className="space-y-6">
              {tab === "resumen" && <AccountsSummarySection clubId={clubId} />}
              {tab === "gastos" && <LedgerEntriesSection clubId={clubId} />}
              {tab === "entrenadores" && <CoachesSection clubId={clubId} />}
              {tab === "ocupacion" && <AccountsOccupancySection clubId={clubId} />}
              {tab === "tesoreria" && <AccountsTreasurySection clubId={clubId} />}
              {tab === "socios" && <AccountsProfitSection clubId={clubId} />}
              {tab === "deudas" && (
                <>
                  {canAccounts && <OpenAccountsSection clubId={clubId} />}
                  <AccountsDebtsSection clubId={clubId} />
                </>
              )}
              {tab === "tienda" && <AccountsShopSection clubId={clubId} />}
              {tab === "ajustes" && (
                <>
                  <AccountsPartnersSection clubId={clubId} showShares={accounts.treasuryOn && canAccounts} />
                  <AccountsPartPricesSection clubId={clubId} />
                  <AccountsConfigSection clubId={clubId} treasuryOn={accounts.treasuryOn} />
                  {canAccounts && <LedgerCategoriesSection clubId={clubId} />}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
