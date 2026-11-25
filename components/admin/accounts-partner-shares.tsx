"use client";

/**
 * «Cuentas» → «Ajustes» → «Reparto entre los socios» (F8, fase 3): las partes del
 * beneficio de los socios activos, «A partes iguales» o con porcentajes que suman
 * 100 %. Cada juego de partes vale desde un mes («Desde el mes») hasta que otro
 * empieza, así que cambiar las partes no toca los meses ya repartidos: solo se
 * puede empezar después del último mes con repartos. Debajo, los juegos de antes.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/admin/error-state";
import { Field, Input } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import { accountsQK, accountsService, type ClubPartner } from "@/lib/services/accounts";
import { profitQK, profitService, type PartnerShareSet, type PartnerSharesRead } from "@/lib/services/profit";
import { invalidateTreasury } from "@/lib/services/treasury";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import {
  bpsToPercentText, defaultSharesMonth, equalShares, monthLabel, partnerLabel, percentTextToBps, sharesMonthProblem, sharesProblem,
} from "@/lib/utils/profit";
import { zonedDayKey } from "@/lib/utils/time-zone";

const FIELD =
  "min-h-11 w-24 rounded-md border border-border bg-background px-3 text-right text-sm tabular-nums text-foreground focus:outline-none focus:border-[#D4AF37]";

export function AccountsPartnerShares({ clubId }: { clubId: string }) {
  const shares = useQuery({
    queryKey: profitQK.partnerShares(clubId),
    queryFn: () => profitService.partnerShares.get(clubId),
  });
  const partners = useQuery({
    queryKey: accountsQK.partners(clubId),
    queryFn: () => accountsService.partners.list(clubId),
  });
  const { timeZone } = useClubTimeZone(clubId);
  if (shares.isError || partners.isError) {
    return (
      <ErrorState
        title="No se pudieron cargar las partes de los socios"
        onRetry={() => { void shares.refetch(); void partners.refetch(); }}
      />
    );
  }
  if (!shares.data || !partners.data || !timeZone) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  const active = partners.data.filter((p) => p.active);
  const currentMonth = zonedDayKey(new Date(), timeZone).slice(0, 7);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-base font-medium">Reparto entre los socios</h3>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">Añade al menos un socio activo para repartir el beneficio.</p>
      ) : (
        // Con otros juegos guardados, el formulario vuelve a empezar
        <SharesForm
          key={`${shares.data.lockedUntil ?? "-"}|${shares.data.sets.map((s) => s.fromMonth).join(",")}|${active.map((p) => p.id).join(",")}`}
          clubId={clubId}
          partners={active}
          data={shares.data}
          currentMonth={currentMonth}
        />
      )}
      <PreviousSets sets={shares.data.sets} />
    </div>
  );
}

function SharesForm({ clubId, partners, data, currentMonth }: {
  clubId:       string;
  partners:     ClubPartner[];
  data:         PartnerSharesRead;
  currentMonth: string;
}) {
  const qc = useQueryClient();
  const canWrite = useClubAccess().can("accounts", "write");
  // Se parte del juego más reciente: sus porcentajes para los socios que siguen, o «a partes iguales» si no hay ninguno
  const latest = data.sets[data.sets.length - 1];
  const latestBps = new Map(latest?.shares.map((s) => [s.partnerId, s.shareBps]));
  const [fromMonth, setFromMonth] = useState(defaultSharesMonth(data.lockedUntil, currentMonth));
  const [equal, setEqual] = useState(!latest);
  const [texts, setTexts] = useState<Record<string, string>>(
    Object.fromEntries(partners.map((p) => [p.id, latestBps.has(p.id) ? bpsToPercentText(latestBps.get(p.id) as number) : ""])),
  );

  const monthError = sharesMonthProblem(fromMonth, data.lockedUntil);
  const percentError = equal ? null : sharesProblem(partners.map((p) => texts[p.id] ?? ""));
  const replaces = monthError === null && data.sets.some((s) => s.fromMonth === fromMonth);
  const equalBps = equalShares(partners.length);

  const save = useMutation({
    mutationFn: () =>
      profitService.partnerShares.set(clubId, {
        fromMonth,
        shares: partners.map((p, i) => ({
          partnerId: p.id,
          shareBps: equal ? equalBps[i] : percentTextToBps(texts[p.id] ?? "") ?? 0,
        })),
      }),
    onSuccess: () => {
      invalidateTreasury(qc, clubId);
      void qc.invalidateQueries({ queryKey: profitQK.partnerShares(clubId) });
      void qc.invalidateQueries({ queryKey: profitQK.current(clubId) });
      toast.success("Partes guardadas");
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const invalid = monthError !== null || percentError !== null;

  return (
    <form
      className="space-y-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid && canWrite) save.mutate();
      }}
    >
      <div className="max-w-xs">
        <Field label="Desde el mes" error={monthError ?? undefined}>
          <Input
            type="month"
            aria-label="Desde el mes"
            placeholder="AAAA-MM"
            min={data.lockedUntil ? defaultSharesMonth(data.lockedUntil, currentMonth) : undefined}
            value={fromMonth}
            onChange={(e) => setFromMonth(e.target.value)}
          />
        </Field>
      </div>
      {data.lockedUntil && (
        <p className="text-xs text-muted-foreground">
          Ya hay repartos hasta {monthLabel(data.lockedUntil)}: las partes de esos meses no se pueden cambiar.
        </p>
      )}
      {replaces && (
        <p role="note" className="text-xs text-amber-600">
          Ya hay unas partes desde {monthLabel(fromMonth)}: al guardar se sustituyen.
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="sr-only">Cómo se reparte el beneficio</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="shares-mode" checked={equal} onChange={() => setEqual(true)} />
          A partes iguales{partners.length > 1 ? ` (${equalSharesText(equalBps)})` : ""}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="shares-mode" checked={!equal} onChange={() => setEqual(false)} />
          Con porcentajes
        </label>
      </fieldset>

      {!equal && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {partners.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <label htmlFor={`share-${p.id}`} className="min-w-0 flex-1 font-medium">{p.name}</label>
              <input
                id={`share-${p.id}`}
                type="text"
                inputMode="decimal"
                aria-label={`Porcentaje de ${p.name}`}
                value={texts[p.id] ?? ""}
                onChange={(e) => setTexts((t) => ({ ...t, [p.id]: e.target.value }))}
                className={FIELD}
              />
              <span className="text-muted-foreground">%</span>
            </li>
          ))}
        </ul>
      )}
      {percentError && <p className="text-xs text-destructive">{percentError}</p>}
      <p className="text-xs text-muted-foreground">
        Cada mes con beneficio se reparte con las partes vigentes ese mes. Un mes con pérdidas reparte 0 y no se compensa con otros.
      </p>
      {canWrite && (
        <Button type="submit" size="sm" disabled={invalid || save.isPending}>
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar partes
        </Button>
      )}
    </form>
  );
}

/** «33,34 %, 33,33 % y 33,33 %» o, si todos valen lo mismo, «50 % cada uno». */
function equalSharesText(bps: number[]): string {
  const first = bps[0];
  if (bps.every((b) => b === first)) return `${bpsToPercentText(first)} % cada uno`;
  return bps.map((b) => `${bpsToPercentText(b)} %`).join(", ");
}

function PreviousSets({ sets }: { sets: PartnerShareSet[] }) {
  if (sets.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay partes fijadas: sin ellas no se puede repartir.</p>;
  }
  return (
    <section aria-label="Partes anteriores" className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Partes fijadas</h4>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {/* La más reciente, arriba */}
        {[...sets].reverse().map((s) => (
          <li key={s.fromMonth} className="px-3 py-2">
            <p className="font-medium capitalize">Desde {monthLabel(s.fromMonth)}</p>
            <p className="text-xs text-muted-foreground">
              {s.shares.map((x) => `${partnerLabel(x)} ${bpsToPercentText(x.shareBps)} %`).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
