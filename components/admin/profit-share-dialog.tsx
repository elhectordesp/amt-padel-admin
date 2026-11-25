"use client";

/**
 * «Repartir» el beneficio de un mes acabado (Socios y reparto), en tres pasos:
 * 1) los importes de cada socio (la sugerencia del back, que se puede cambiar),
 * de dónde sale el dinero y la fecha; 2) el resumen; 3) la confirmación. Cada
 * importe no puede pasar de lo pendiente de su socio ni la suma del disponible;
 * el back lo vuelve a comprobar dentro de la escritura.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { AmountField } from "@/components/admin/payment-fields";
import { CustomSelect, Field, Input } from "@/components/admin/form";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { profitService, type ProfitMonth } from "@/lib/services/profit";
import { invalidateTreasury, type TreasurySummary } from "@/lib/services/treasury";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import { isDayKey } from "@/lib/utils/ledger";
import { buildShareLines, monthLabel, partnerLabel, suggestedTexts } from "@/lib/utils/profit";
import { NOTE_MAX } from "@/lib/utils/treasury";
import { formatDayKey } from "@/lib/utils/time-zone";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

type Step = "edit" | "review" | "confirm";

export function ProfitShareDialog({ clubId, summary, month, availableCents, onClose }: {
  clubId:         string;
  summary:        TreasurySummary;
  month:          ProfitMonth;
  availableCents: number;
  onClose:        () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("edit");
  const [texts, setTexts] = useState<Record<string, string>>(() => suggestedTexts(month.parts));
  const [fromPlace, setFromPlace] = useState<"CASH" | "BANK">("CASH");
  const [date, setDate] = useState(summary.today);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const built = buildShareLines(month.parts, texts, availableCents);
  const dateError = isDayKey(date) && date >= summary.startDate && date <= summary.today
    ? undefined : "Elige un día entre el inicio de la tesorería y hoy";
  const invalid = Object.keys(built.errors).length > 0 || built.problem !== null || dateError !== undefined;
  const origin = summary.places.find((p) => p.place === fromPlace);
  const label = monthLabel(month.period);
  const nameOf = (id: string) => {
    const part = month.parts.find((p) => p.partnerId === id);
    return part ? partnerLabel(part) : "—";
  };

  const save = useMutation({
    mutationFn: () =>
      profitService.shares.create(clubId, {
        period: month.period,
        date,
        fromPlace,
        lines: built.lines,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      invalidateTreasury(qc, clubId);
      toast.success("Reparto apuntado");
      onClose();
    },
    onError: (err: unknown) => {
      setStep("review");
      toast.error(accountsErrorText(err));
    },
  });

  return (
    <>
      {step !== "confirm" && (
        <SchoolDialog title={`Repartir ${label}`} onClose={onClose} busy={save.isPending} wide>
          {step === "edit" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (!invalid) setStep("review");
              }}
            >
              <p className="text-sm text-muted-foreground">
                Resultado del mes: <strong className="tabular-nums text-foreground">{formatCents(month.resultCents)}</strong>.
                Los importes salen sugeridos según lo pendiente y el dinero disponible; cámbialos si quieres repartir menos.
              </p>

              <ul className="divide-y divide-border rounded-lg border border-border">
                {month.parts.map((p) => (
                  <li key={p.partnerId} className="grid grid-cols-1 gap-2 px-3 py-2 sm:grid-cols-[1fr_11rem] sm:items-end">
                    <div className="text-sm">
                      <p className="font-medium">{partnerLabel(p)}</p>
                      <p className="text-xs text-muted-foreground">
                        Le toca {formatCents(p.partCents)} · repartido {formatCents(p.sharedCents)} · pendiente {formatCents(p.pendingCents)}
                      </p>
                      {p.overSharedCents > 0 && (
                        <p className="text-xs text-amber-600">Repartido de más en {label}: {formatCents(p.overSharedCents)}</p>
                      )}
                    </div>
                    {p.pendingCents > 0 ? (
                      <div>
                        <AmountField
                          label={`Importe de ${p.name}`}
                          value={texts[p.partnerId] ?? ""}
                          onChange={(v) => setTexts((t) => ({ ...t, [p.partnerId]: v }))}
                          invalid={touched && !!built.errors[p.partnerId]}
                        />
                        {touched && built.errors[p.partnerId] && (
                          <p className="mt-1 text-xs text-destructive">{built.errors[p.partnerId]}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Ya cobrado entero</p>
                    )}
                  </li>
                ))}
              </ul>
              {touched && built.problem && <p className="text-xs text-destructive">{built.problem}</p>}
              <p className="text-xs text-muted-foreground">
                Disponible para repartir: <span className="tabular-nums">{formatCents(availableCents)}</span>. Ya descuenta lo que se debe a
                entrenadores, los gastos sin pagar, el fondo y el colchón.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="De dónde sale">
                  <CustomSelect
                    options={[
                      { value: "CASH", label: `Caja (${formatCents(summary.places.find((p) => p.place === "CASH")?.balanceCents ?? 0)})` },
                      { value: "BANK", label: `Banco (${formatCents(summary.places.find((p) => p.place === "BANK")?.balanceCents ?? 0)})` },
                    ]}
                    value={fromPlace}
                    onChange={(v) => setFromPlace(v === "BANK" ? "BANK" : "CASH")}
                  />
                </Field>
                <Field label="Fecha" error={touched ? dateError : undefined}>
                  <Input
                    type="date"
                    aria-label="Fecha"
                    min={summary.startDate}
                    max={summary.today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Nota (opcional)">
                <Input aria-label="Nota del reparto" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
              </Field>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Revisar</Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Revisa el reparto antes de apuntarlo.</p>
              <ul role="list" aria-label="Resumen del reparto" className="divide-y divide-border rounded-lg border border-border">
                {built.lines.map((l) => (
                  <li key={l.partnerId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{nameOf(l.partnerId)}</span>
                    <span className="font-medium tabular-nums">{formatCents(l.amountCents)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 bg-secondary px-3 py-2 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCents(built.totalCents)}</span>
                </li>
              </ul>
              <p role="status" className="rounded-md bg-secondary px-3 py-2 text-sm">
                Salen <strong>{formatCents(built.totalCents)}</strong> de {origin?.label ?? "—"} el {formatDayKey(date, DAY)}, como reparto de {label}.
                Después quedarán {formatCents(availableCents - built.totalCents)} disponibles.
              </p>
              {origin && built.totalCents > origin.balanceCents && (
                <p className="text-xs text-amber-600">
                  Ojo: {origin.label} tiene ahora {formatCents(origin.balanceCents)} según la tesorería. Si el dinero está en otro sitio, cambia el origen.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setStep("edit")} disabled={save.isPending}>Volver</Button>
                <Button type="button" onClick={() => setStep("confirm")} disabled={save.isPending}>Apuntar reparto</Button>
              </div>
            </div>
          )}
        </SchoolDialog>
      )}
      <ConfirmModal
        open={step === "confirm"}
        title="¿Apuntar el reparto?"
        description={`Se apuntan ${formatCents(built.totalCents)} repartidos entre ${built.lines.length === 1 ? "1 socio" : `${built.lines.length} socios`} por ${label}, y salen de ${origin?.label ?? "—"}. Si te equivocas, podrás borrarlo desde la lista de repartos.`}
        confirmLabel="Sí, apuntar"
        loading={save.isPending}
        onClose={() => setStep("review")}
        onConfirm={() => save.mutate()}
      />
    </>
  );
}
