"use client";

/**
 * «Cuentas» → «Entrenadores» (F8-C2): las horas que da cada entrenador del club
 * (clases de grupo, privadas y horas a mano), lo que se le devenga con la tarifa
 * de cada día (el gasto de entrenadores es lo devengado, no lo pagado), lo que
 * se le ha pagado y lo que se le debe. Pagar apunta un gasto; deshacer el pago
 * es borrarlo. Solo propietario y gestor.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { CustomSelect, Field, Input } from "@/components/admin/form";
import { AmountField } from "@/components/admin/payment-fields";
import { SchoolDialog } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { accountsService } from "@/lib/services/accounts";
import { cashQK } from "@/lib/services/cash";
import {
  coachesQK, coachesService,
  type CoachMonth, type CoachRate,
} from "@/lib/services/coaches";
import { ledgerQK, ledgerService, type LedgerPayment } from "@/lib/services/ledger";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { formatCents } from "@/lib/utils/booking-price";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { PAYMENT_LABEL, isDayKey, minutesText, owedText } from "@/lib/utils/ledger";
import { centsToEurosInput, eurosToCents } from "@/lib/utils/payment-methods";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/utils/school-billing";
import { addDaysToKey, formatDayKey, zonedDayKey } from "@/lib/utils/time-zone";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const PAY_PAYMENTS: Exclude<LedgerPayment, "PENDING">[] = ["CASH", "BANK", "CARD", "PARTNER", "UNKNOWN"];

export function CoachesSection({ clubId }: { clubId: string }) {
  const { timeZone, isError, refetch } = useClubTimeZone(clubId);
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!timeZone) return <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />;
  return <Coaches clubId={clubId} timeZone={timeZone} />;
}

function Coaches({ clubId, timeZone }: { clubId: string; timeZone: string }) {
  const qc = useQueryClient();
  const today = zonedDayKey(new Date(), timeZone);
  const [month, setMonth] = useState(() => currentMonth(new Date(), timeZone));
  const [paying, setPaying] = useState<CoachMonth | null>(null);
  const [detail, setDetail] = useState<CoachMonth | null>(null);
  const [addingHours, setAddingHours] = useState(false);

  const overview = useQuery({
    queryKey: coachesQK.overview(clubId, month),
    queryFn: () => coachesService.overview(clubId, month),
  });
  const extra = useQuery({
    queryKey: coachesQK.extra(clubId, month),
    queryFn: () => coachesService.extraHours.list(clubId, month),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: coachesQK.all(clubId) });
    qc.invalidateQueries({ queryKey: ledgerQK.all(clubId) });
    qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
  };
  const removeExtra = useMutation({
    mutationFn: (id: string) => coachesService.extraHours.remove(clubId, id),
    onSuccess: () => { toast.success("Horas borradas"); refresh(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });

  const data = overview.data;
  return (
    <section aria-label="Entrenadores" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="Mes">
          <Button variant="outline" size="icon-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel(month)}</span>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddingHours(true)} disabled={!data || data.coaches.length === 0}>
          <Plus className="h-3.5 w-3.5" /> Añadir horas a mano
        </Button>
      </div>

      {overview.isError ? (
        <ErrorState title="No se pudieron cargar los entrenadores" onRetry={() => overview.refetch()} />
      ) : !data ? (
        <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
      ) : data.coaches.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          No hay entrenadores en el equipo. Da de alta a alguien con el rol de entrenador en Equipo.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {data.coaches.map((c) => (
              <li key={c.coachStaffId} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {c.name}
                      {c.payDue && (
                        <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-normal text-amber-600 dark:text-amber-400">
                          Toca pagar
                        </span>
                      )}
                      {c.leftAt && (
                        <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground">
                          De baja
                        </span>
                      )}
                      {c.missingRate && (
                        <span className="ml-2 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-normal text-red-600 dark:text-red-400">
                          Falta la tarifa
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Grupo {minutesText(c.groupMinutes)} · Privadas {minutesText(c.privateMinutes)} · A mano {minutesText(c.extraMinutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Devengado {formatCents(c.accruedCents)} · Pagado {formatCents(c.paidCents)} ·{" "}
                      <span className="font-medium text-foreground">Debe {owedText(c.owedCents, formatCents)}</span>
                    </p>
                    {c.previousOwedCents !== 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        De meses anteriores: {owedText(c.previousOwedCents, formatCents)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="xs" onClick={() => setPaying(c)}>
                      <Wallet className="h-3 w-3" /> Pagar
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => setDetail(c)}>Detalle</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm">
            <span className="text-muted-foreground">Total del mes: </span>
            devengado {formatCents(data.totals.accruedCents)} · pagado {formatCents(data.totals.paidCents)} · debe{" "}
            {owedText(data.totals.owedCents, formatCents)}
          </p>
        </>
      )}

      {(extra.data ?? []).length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Horas a mano del mes</h3>
          <ul className="space-y-1 text-sm">
            {(extra.data ?? []).map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 rounded border border-border px-3 py-1.5">
                <span>
                  {formatDayKey(h.date, DAY)} · {h.coachName} · {minutesText(h.minutes)}
                  {h.note ? <span className="text-muted-foreground"> · {h.note}</span> : null}
                </span>
                <Button size="icon-xs" variant="outline" aria-label={`Borrar las horas de ${h.coachName} del ${h.date}`} onClick={() => removeExtra.mutate(h.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RatesBlock clubId={clubId} coaches={data?.coaches ?? []} today={today} onChange={refresh} />

      {paying && <PayDialog clubId={clubId} month={month} coach={paying} today={today} onClose={() => setPaying(null)} onDone={refresh} />}
      {detail && <DetailDialog clubId={clubId} month={month} coach={detail} onClose={() => setDetail(null)} onChange={refresh} />}
      {addingHours && data && (
        <HoursDialog clubId={clubId} coaches={data.coaches} month={month} today={today} timeZone={timeZone} onClose={() => setAddingHours(false)} onDone={refresh} />
      )}
    </section>
  );
}

function PayDialog({
  clubId, month, coach, today, onClose, onDone,
}: { clubId: string; month: string; coach: CoachMonth; today: string; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(coach.owedCents > 0 ? centsToEurosInput(coach.owedCents) : "");
  const [payment, setPayment] = useState<Exclude<LedgerPayment, "PENDING">>("BANK");
  const [partnerId, setPartnerId] = useState("");
  const [date, setDate] = useState(today);
  const [touched, setTouched] = useState(false);
  const partners = useQuery({
    queryKey: ["club-accounts", clubId, "partners"],
    queryFn: () => accountsService.partners.list(clubId),
  });
  const cents = eurosToCents(amount);
  const valid = cents !== null && cents >= 1 && isDayKey(date) && (payment !== "PARTNER" || !!partnerId);
  const over = cents !== null && cents > Math.max(0, coach.owedCents);
  const pay = useMutation({
    mutationFn: () =>
      coachesService.pay(clubId, coach.coachStaffId, {
        month, amountCents: cents as number, payment, partnerId: payment === "PARTNER" ? partnerId : null, date,
      }),
    onSuccess: () => { toast.success(`Pago a ${coach.name} apuntado`); onDone(); onClose(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  return (
    <SchoolDialog title={`Pagar a ${coach.name} · ${monthLabel(month)}`} onClose={onClose} busy={pay.isPending}>
      <p className="text-sm text-muted-foreground">Se le debe {owedText(coach.owedCents, formatCents)} de este mes.</p>
      <AmountField label="Importe" value={amount} onChange={setAmount} invalid={touched && !(cents !== null && cents >= 1)} />
      {over && (
        <p role="note" className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
          Es más de lo que se le debe este mes. Se puede pagar igualmente: quedará a su favor.
        </p>
      )}
      <div role="group" aria-label="Cómo se paga" className="flex flex-wrap gap-2">
        {PAY_PAYMENTS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={payment === p}
            onClick={() => setPayment(p)}
            className={`min-h-9 rounded-md border px-3 text-sm ${
              payment === p
                ? "border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.15)] text-[#D4AF37]"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {PAYMENT_LABEL[p]}
          </button>
        ))}
      </div>
      {payment === "PARTNER" && (
        <CustomSelect
          options={[{ value: "", label: "Elige un socio" }, ...(partners.data ?? []).filter((p) => p.active).map((p) => ({ value: p.id, label: p.name }))]}
          value={partnerId}
          onChange={setPartnerId}
        />
      )}
      <Field label="Día del pago">
        <Input type="date" aria-label="Día del pago" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={pay.isPending}>Cancelar</Button>
        <Button
          onClick={() => { setTouched(true); if (valid) pay.mutate(); }}
          disabled={pay.isPending}
        >
          {pay.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Apuntar el pago
        </Button>
      </div>
    </SchoolDialog>
  );
}

function DetailDialog({
  clubId, month, coach, onClose, onChange,
}: { clubId: string; month: string; coach: CoachMonth; onClose: () => void; onChange: () => void }) {
  const [undoing, setUndoing] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: coachesQK.detail(clubId, coach.coachStaffId, month),
    queryFn: () => coachesService.detail(clubId, coach.coachStaffId, month),
  });
  const undo = useMutation({
    mutationFn: (entryId: string) => ledgerService.entries.remove(clubId, entryId),
    onSuccess: () => { setUndoing(null); toast.success("Pago deshecho"); onChange(); },
    onError: (err: unknown) => { setUndoing(null); toast.error(accountsErrorText(err)); },
  });
  const kindLabel = { GROUP: "Grupo", PRIVATE: "Privada", EXTRA: "A mano" } as const;
  return (
    <SchoolDialog title={`${coach.name} · ${monthLabel(month)}`} onClose={onClose} wide>
      {detail.isPending ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : detail.isError ? (
        <p className="text-sm text-destructive">No se pudo cargar el detalle</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clases y horas</h4>
            {detail.data.items.length === 0 ? (
              <p className="text-muted-foreground">Ninguna clase dada este mes.</p>
            ) : (
              <ul className="space-y-1">
                {detail.data.items.map((i, n) => (
                  <li key={`${i.date}-${n}`} className="flex flex-wrap justify-between gap-2 rounded border border-border px-3 py-1.5">
                    <span>
                      {formatDayKey(i.date, DAY)} · {kindLabel[i.kind]} · {i.label} · {minutesText(i.minutes)}
                    </span>
                    <span className={i.missingRate ? "text-red-600 dark:text-red-400" : ""}>
                      {i.missingRate ? "Falta la tarifa" : `${formatCents(i.cents)} (${formatCents(i.hourlyCents)}/h)`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagos</h4>
            {detail.data.payments.length === 0 ? (
              <p className="text-muted-foreground">Sin pagos de este mes.</p>
            ) : (
              <ul className="space-y-1">
                {detail.data.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-1.5">
                    <span>
                      {formatDayKey(p.date, DAY)} · {formatCents(p.amountCents)} · {PAYMENT_LABEL[p.payment]}
                    </span>
                    <Button size="xs" variant="outline" onClick={() => setUndoing(p.id)}>Deshacer pago</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!undoing}
        title="¿Deshacer este pago?"
        description="Se borra el apunte y vuelve a deberse esa cantidad. Si fue en efectivo, vuelve a la caja de ese día."
        confirmLabel="Deshacer pago"
        danger
        loading={undo.isPending}
        onClose={() => { if (!undo.isPending) setUndoing(null); }}
        onConfirm={() => { if (undoing) undo.mutate(undoing); }}
      />
    </SchoolDialog>
  );
}

function HoursDialog({
  clubId, coaches, month, today, timeZone, onClose, onDone,
}: { clubId: string; coaches: CoachMonth[]; month: string; today: string; timeZone: string; onClose: () => void; onDone: () => void }) {
  // Quien está de baja solo admite horas de días anteriores a su baja.
  const lastDayOf = (id: string) => {
    const leftAt = coaches.find((c) => c.coachStaffId === id)?.leftAt;
    return leftAt ? addDaysToKey(zonedDayKey(leftAt, timeZone), -1) : undefined;
  };
  const initialDate = today.startsWith(month) ? today : `${month}-01`;
  const [coachId, setCoachId] = useState(coaches[0]?.coachStaffId ?? "");
  const [date, setDate] = useState(() => {
    const last = lastDayOf(coaches[0]?.coachStaffId ?? "");
    return last && initialDate > last ? last : initialDate;
  });
  const maxDate = lastDayOf(coachId);
  const pickCoach = (id: string) => {
    setCoachId(id);
    const last = lastDayOf(id);
    if (last && date > last) setDate(last);
  };
  const [hours, setHours] = useState("1");
  const [note, setNote] = useState("");
  const minutes = Math.round(Number(hours.replace(",", ".")) * 60);
  const valid = !!coachId && isDayKey(date) && (!maxDate || date <= maxDate) && Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440;
  const save = useMutation({
    mutationFn: () => coachesService.extraHours.create(clubId, { coachStaffId: coachId, date, minutes, note: note.trim() || null }),
    onSuccess: () => { toast.success("Horas apuntadas"); onDone(); onClose(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  return (
    <SchoolDialog title="Añadir horas a mano" onClose={onClose} busy={save.isPending}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
        <Field label="Entrenador">
          <CustomSelect options={coaches.map((c) => ({ value: c.coachStaffId, label: c.name }))} value={coachId} onChange={pickCoach} />
        </Field>
        {maxDate && (
          <p role="note" className="text-xs text-muted-foreground">
            Está de baja: solo se pueden apuntar horas hasta el {formatDayKey(maxDate, { day: "numeric", month: "long" })}.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Día"><Input type="date" aria-label="Día" max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Horas"><Input aria-label="Horas" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
        </div>
        <Field label="Nota (sustitución, evento...)">
          <Input aria-label="Nota" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancelar</Button>
          <Button type="submit" disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
          </Button>
        </div>
      </form>
    </SchoolDialog>
  );
}

function RatesBlock({
  clubId, coaches, today, onChange,
}: { clubId: string; coaches: CoachMonth[]; today: string; onChange: () => void }) {
  const [coachId, setCoachId] = useState("");
  const [validFrom, setValidFrom] = useState(today);
  const [price, setPrice] = useState("");
  const rates = useQuery({
    queryKey: coachesQK.rates(clubId),
    queryFn: () => coachesService.rates.list(clubId),
  });
  const cents = eurosToCents(price);
  const valid = isDayKey(validFrom) && cents !== null && cents <= 100_000;
  const save = useMutation({
    mutationFn: () => coachesService.rates.save(clubId, { coachStaffId: coachId || null, validFrom, hourlyCents: cents as number }),
    onSuccess: () => { toast.success("Tarifa guardada"); setPrice(""); onChange(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const remove = useMutation({
    mutationFn: (r: CoachRate) => coachesService.rates.remove(clubId, r.id),
    onSuccess: () => { toast.success("Tarifa borrada"); onChange(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const club = (rates.data ?? []).filter((r) => r.coachStaffId === null);
  const own = (rates.data ?? []).filter((r) => r.coachStaffId !== null);
  const missing = coaches.filter((c) => c.missingRate);

  const row = (r: CoachRate) => (
    <li key={r.id} className="flex items-center justify-between gap-2 rounded border border-border px-3 py-1.5">
      <span>
        {r.coachName ? `${r.coachName}: ` : ""}desde el {formatDayKey(r.validFrom, { day: "numeric", month: "short", year: "numeric" })} · {formatCents(r.hourlyCents)}/h
      </span>
      <Button size="icon-xs" variant="outline" aria-label={`Borrar la tarifa de ${r.validFrom}`} onClick={() => remove.mutate(r)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </li>
  );

  return (
    <section aria-label="Tarifas" className="space-y-3 border-t border-border pt-4">
      <div>
        <h3 className="flex items-center gap-1.5 text-base font-medium"><Clock className="h-4 w-4" /> Tarifas por hora</h3>
        <p className="text-xs text-muted-foreground">
          Una del club para todos, con histórico, y, si quieres, una propia por entrenador. Cada clase se paga con la
          tarifa vigente el día en que se dio.
        </p>
      </div>
      {missing.length > 0 && (
        <p role="note" className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
          Falta la tarifa de {missing.map((m) => m.name).join(", ")}: sus clases sin tarifa cuestan 0 hasta que la pongas.
        </p>
      )}
      {rates.isPending ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-2 text-sm">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Del club</h4>
            {club.length === 0 ? <p className="text-muted-foreground">Sin tarifa del club.</p> : <ul className="space-y-1">{club.map(row)}</ul>}
          </div>
          {own.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por entrenador</h4>
              <ul className="space-y-1">{own.map(row)}</ul>
            </div>
          )}
        </div>
      )}
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-end"
        onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}
      >
        <Field label="Para">
          <CustomSelect
            options={[{ value: "", label: "Todo el club" }, ...coaches.map((c) => ({ value: c.coachStaffId, label: c.name }))]}
            value={coachId}
            onChange={setCoachId}
          />
        </Field>
        <Field label="Vale desde"><Input type="date" aria-label="Vale desde" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></Field>
        <AmountField label="€ por hora" value={price} onChange={setPrice} invalid={price !== "" && cents === null} />
        <Button type="submit" size="sm" disabled={!valid || save.isPending}>
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar tarifa
        </Button>
      </form>
    </section>
  );
}
