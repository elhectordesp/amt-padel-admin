/**
 * /caja — la caja del club al cerrar el día: lo cobrado por método, con cada
 * movimiento (reservas e inscripciones de torneo), y quién le debe, por
 * persona, con el cobro ahí mismo.
 */

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CajaDay } from "@/components/admin/caja-day";
import { CajaDebts } from "@/components/admin/caja-debts";
import { ErrorState } from "@/components/admin/error-state";
import { Header } from "@/components/admin/header";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useRole, isClub } from "@/lib/use-role";

type Tab = "day" | "debts";

const TABS: { id: Tab; label: string }[] = [
  { id: "day",   label: "Caja del día" },
  { id: "debts", label: "Pendiente de cobro" },
];

export default function CajaPage() {
  const { role, clubId } = useRole();
  const enabled = !!clubId && isClub(role);
  const [tab, setTab] = useState<Tab>("day");
  const { timeZone, isError, refetch } = useClubTimeZone(clubId, enabled);

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
        <Header title="Caja" />
        <p className="p-4 sm:p-6 text-sm text-muted-foreground">Requiere usuario CLUB con club asignado.</p>
      </>
    );
  }

  return (
    <>
      <Header title="Caja" />
      <div className="p-4 sm:p-6 space-y-4">
        <div role="tablist" className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-[#D4AF37] text-[#D4AF37]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isError ? (
          <ErrorState title="No se pudo cargar tu club" onRetry={() => refetch()} />
        ) : !timeZone ? (
          <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />
        ) : tab === "day" ? (
          <CajaDay clubId={clubId!} clubName={null} timeZone={timeZone} />
        ) : (
          <CajaDebts clubId={clubId!} timeZone={timeZone} />
        )}
      </div>
    </>
  );
}
