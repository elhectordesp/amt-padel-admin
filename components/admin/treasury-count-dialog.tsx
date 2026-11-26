"use client";

/**
 * «Cuadrar» (Tesorería): se cuenta lo que hay de verdad en un sitio (caja,
 * banco, lo que guarda un socio o la cuenta de un socio) hasta hoy o hasta
 * ayer. Antes de confirmar se enseña lo que el panel tenía calculado y la
 * diferencia: al confirmar, ese día el saldo pasa a ser lo contado y los
 * saldos siguientes parten de ahí. Los lugares de un socio de baja con saldo se
 * pueden cuadrar solo para saldarlos: acercarlos a 0, sin pasarse.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CustomSelect, Field, Input } from "@/components/admin/form";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import {
  invalidateTreasury, treasuryQK, treasuryService, type TreasurySummary,
} from "@/lib/services/treasury";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import { formatDayKey } from "@/lib/utils/time-zone";
import {
  allowsNegativeCount, beforeStartBalance, countablePlaces, countDay, countDiffText, NOTE_MAX, parsePlaceKey,
  parseSignedCents, placeKey, settleCountNote, signedCents, TREASURY_MAX_CENTS, type CountUpTo,
} from "@/lib/utils/treasury";

const DAY: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };

export function TreasuryCountDialog({ clubId, summary, initialKey = "CASH", onClose }: {
  clubId:      string;
  summary:     TreasurySummary;
  /** El lugar con el que se abre (el de la tarjeta desde la que se pulsó). */
  initialKey?: string;
  onClose:     () => void;
}) {
  const qc = useQueryClient();
  const activePartners = new Set(summary.partners.filter((p) => p.active).map((p) => p.partnerId));
  // Un socio de baja solo se ofrece mientras tenga saldo: cuadrarlo es una forma de saldarlo
  const places = countablePlaces(summary.places, activePartners);
  const [key, setKey] = useState(places.some((p) => placeKey(p) === initialKey) ? initialKey : "CASH");
  const [upTo, setUpTo] = useState<CountUpTo>("today");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const ref = parsePlaceKey(key);
  const balance = summary.places.find((p) => placeKey(p) === key);
  const inactivePartner = ref.partnerId ? summary.partners.find((p) => p.partnerId === ref.partnerId && !p.active) : undefined;
  const day = countDay(upTo, summary.today);
  // Un día anterior al inicio no tiene extracto: vale 0 salvo que ese día ya se cuadrara
  const beforeStart = day < summary.startDate;

  // Hasta hoy, el saldo ya viene en el resumen; hasta ayer, es el cierre de ese día en el extracto
  const statement = useQuery({
    queryKey: treasuryQK.statement(clubId, { ...ref, from: day, to: day }),
    queryFn: () => treasuryService.statement(clubId, { ...ref, from: day, to: day }),
    enabled: upTo === "yesterday" && !beforeStart,
  });
  const computedCents: number | null =
    upTo === "today" ? balance?.balanceCents ?? null
    : beforeStart ? beforeStartBalance(balance?.lastCount ?? null, day)
    : statement.data?.started ? statement.data.closingCents : null;

  const countedCents = parseSignedCents(counted);
  const negativeOk = allowsNegativeCount(ref.place);
  const countedError =
    countedCents === null ? "Escribe lo que hay de verdad (por ejemplo 350,00)"
    : Math.abs(countedCents) > TREASURY_MAX_CENTS ? "Un cuadre llega como mucho a 100.000 €"
    : countedCents < 0 && !negativeOk ? "Aquí no puede haber menos de 0 €"
    : undefined;
  const diff = computedCents !== null && countedCents !== null && !countedError
    ? countDiffText(computedCents, countedCents) : null;

  const save = useMutation({
    mutationFn: () =>
      treasuryService.counts.create(clubId, {
        ...ref,
        upTo: day,
        countedCents: countedCents as number,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (done) => {
      invalidateTreasury(qc, clubId);
      toast.success(
        done.diffCents === 0
          ? "Cuadre guardado: no había diferencia"
          : `Cuadre guardado: el saldo se ha ajustado ${signedCents(done.diffCents)}`,
      );
      onClose();
    },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  return (
    <SchoolDialog title="Cuadrar" onClose={onClose} busy={save.isPending}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (diff && !countedError) save.mutate();
        }}
      >
        <Field label="Qué se cuenta">
          <CustomSelect
            options={places.map((p) => ({
              value: placeKey(p),
              label: p.partnerId && !activePartners.has(p.partnerId) ? `${p.label} (de baja)` : p.label,
            }))}
            value={key}
            onChange={setKey}
          />
        </Field>
        {inactivePartner && balance && (
          <p role="note" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
            <span>{settleCountNote(inactivePartner.name, balance.balanceCents)}</span>
          </p>
        )}

        <div role="group" aria-label="Hasta cuándo">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hasta cuándo</span>
          <div className="grid grid-cols-2 gap-2">
            {([["today", "Hasta hoy"], ["yesterday", "Hasta ayer"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={upTo === id}
                onClick={() => setUpTo(id)}
                className={`min-h-11 rounded-md border text-sm font-medium transition-colors ${
                  upTo === id
                    ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Cuenta lo de {formatDayKey(day, DAY)} y los días anteriores. Si cuentas por la mañana, elige «hasta ayer»
            para no mezclar lo de hoy.
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lo que hay de verdad</span>
          <div className="relative">
            <Input
              type="text"
              inputMode="decimal"
              aria-label="Lo que hay de verdad"
              aria-invalid={touched && !!countedError}
              className="pr-8"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
          </div>
          {(touched || counted !== "") && countedError && <span className="mt-1 block text-xs text-red-400">{countedError}</span>}
          {negativeOk && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {ref.place === "BANK" ? "Si el banco está en descubierto, escríbelo en negativo (-120,00)." : "En negativo, si el club le debe al socio."}
            </span>
          )}
        </label>

        <Field label="Nota (opcional)">
          <Input aria-label="Nota del cuadre" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div role="status" className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm">
          {computedCents === null ? (
            statement.isError ? (
              <span className="text-destructive">No se pudo calcular lo que debería haber. Vuelve a intentarlo.</span>
            ) : (
              <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando…</span>
            )
          ) : (
            <dl className="space-y-0.5">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Calculado por el panel</dt>
                <dd className="font-medium tabular-nums">{formatCents(computedCents)}</dd>
              </div>
              {countedCents !== null && !countedError && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Lo que has contado</dt>
                  <dd className="font-medium tabular-nums">{formatCents(countedCents)}</dd>
                </div>
              )}
              {diff && (
                <div className="flex justify-between gap-3 border-t border-border pt-1">
                  <dt>Diferencia</dt>
                  <dd className={`font-semibold tabular-nums ${diff.diffCents === 0 ? "text-green-600" : "text-amber-600"}`}>
                    {signedCents(diff.diffCents)}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {diff && (
            <p className={`mt-1 text-xs ${diff.diffCents === 0 ? "text-muted-foreground" : "text-amber-600"}`}>
              {diff.text}
              {diff.diffCents !== 0 && " Al confirmar, el saldo de ese día pasa a ser lo contado y la diferencia queda en el extracto."}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button type="submit" disabled={save.isPending || !diff}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirmar cuadre
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}
