/**
 * BookingCreateDialog — Crear una reserva A MANO (Reservas R1), la del mostrador.
 *
 * El club crea una reserva de pista por teléfono, en el mostrador o de partido
 * abierto. Elige pista + fecha + duración, ve los huecos LIBRES
 * (GET /availability) y escoge una hora de inicio, con su precio a la vista.
 * Luego el modo (por defecto «Por teléfono»):
 *  - Abierta (OPEN) + nivel mín/máx opcional
 *  - Con jugadores (PRIVATE_AMT / PRIVATE_WITH_GUESTS) — busca jugadores de la
 *    app y/o añade invitados por nombre (hasta 4 en dobles y 2 en individual:
 *    el club reserva para ellos y no figura como jugador)
 *  - Por teléfono (ADMIN_MANUAL) — solo el cliente
 * El cliente del club se busca o se da de alta ahí mismo (`clubCustomerId`) y,
 * si paga ya, «Cobrada ahora» la crea cobrada (`payNow`, en la misma operación
 * del back). El pie de botones queda fijo: el formulario se desplaza por dentro.
 *
 * Submit → bookingsService.bookings.create. Al éxito cierra + refresca la lista.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminService } from "@/lib/services/admin";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import type { ClubCustomer } from "@/lib/services/club-customers";
import { BookingCustomerPicker } from "@/components/admin/booking-customer-picker";
import { AmountField } from "@/components/admin/payment-fields";
import {
  PAYMENT_METHOD_OPTIONS,
  centsToEurosInput,
  eurosToCents,
  type CounterPaymentMethod,
} from "@/lib/utils/payment-methods";
import { formatCents } from "@/lib/utils/booking-price";
import { zonedDayKey, zonedTime } from "@/lib/utils/time-zone";
import type { Court, Player } from "@/types";
import type { CreateBookingPayload } from "@/types/bookings";

type Mode = "OPEN" | "PLAYERS" | "PHONE";

interface Guest {
  guestName: string;
}

/** Con qué se abre el alta (desde el calendario: pista, día y hora del hueco). */
export interface BookingCreateInitial {
  courtId?: string;
  date?: string; // "YYYY-MM-DD"
  startsAt?: string; // ISO UTC del hueco elegido
}

interface Props {
  open: boolean;
  onClose: () => void;
  clubId: string;
  /** La zona del club (`Club.timezone`): en ella van el día y las horas. */
  timeZone: string;
  /** Se lee al montar: quien lo pase, que monte el diálogo al abrirlo. */
  initial?: BookingCreateInitial;
}

// Lo que pide el back para el rango de un partido abierto (enteros, mín. 40)
const MIN_LSPA = 40;

/**
 * Si la reserva ya ha empezado (el club apunta una ya jugada o en juego). El
 * back la guarda como registro de la pista: nunca competitiva ni abierta
 * (fila 39; BOOKING_PAST_NOT_COMPETITIVE y BOOKING_PAST_OPEN_MATCH).
 */
export function hasStarted(startsAtIso: string, nowMs: number = Date.now()): boolean {
  return !!startsAtIso && Date.parse(startsAtIso) <= nowMs;
}

/** Error del rango LSPA (vacío = sin límite), o null si vale. */
export function lspaRangeError(min: string, max: string): string | null {
  const parse = (v: string) => (v.trim() ? Number(v) : null);
  const lo = parse(min);
  const hi = parse(max);
  for (const v of [lo, hi]) {
    if (v !== null && (!Number.isInteger(v) || v < MIN_LSPA)) {
      return `El LSPA es un número entero de ${MIN_LSPA} o más.`;
    }
  }
  if (lo !== null && hi !== null && lo > hi) {
    return "El LSPA mínimo no puede ser mayor que el máximo.";
  }
  return null;
}

export function BookingCreateDialog({ open, onClose, clubId, timeZone, initial }: Props) {
  const qc = useQueryClient();

  const [courtId, setCourtId] = useState(initial?.courtId ?? "");
  // Sin día elegido, hoy en el club
  const [date, setDate] = useState(() => initial?.date ?? zonedDayKey(new Date(), timeZone));
  const [duration, setDuration] = useState(90);
  // La hora pedida (ISO UTC): la del hueco del calendario o la elegida aquí.
  // Se conserva al cambiar de pista o de duración; vale si es un hueco libre
  const [wantedStartsAt, setWantedStartsAt] = useState(initial?.startsAt ?? "");
  // Lo habitual en el mostrador: alguien llama y se le apunta
  const [mode, setMode] = useState<Mode>("PHONE");
  const [isCompetitive, setIsCompetitive] = useState(false);
  const [notes, setNotes] = useState("");

  // Modo OPEN
  const [minLspa, setMinLspa] = useState("");
  const [maxLspa, setMaxLspa] = useState("");

  // Modo PLAYERS
  const [players, setPlayers] = useState<Player[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestDraft, setGuestDraft] = useState("");

  // El cliente del club a quien se reserva (opcional) y si paga ya
  const [customer, setCustomer] = useState<ClubCustomer | null>(null);
  const [payNow, setPayNow] = useState(false);
  const [payMethod, setPayMethod] = useState<CounterPaymentMethod>("CASH");
  // El importe cobrado, en euros; sin tocar, el precio de la reserva
  const [payAmount, setPayAmount] = useState<string | null>(null);

  const courtsQuery = useQuery({
    queryKey: ["admin-courts", clubId],
    queryFn: () => adminService.courts.list(clubId),
    enabled: open && !!clubId,
  });
  const courts = useMemo(
    () => (courtsQuery.data ?? []).filter((c) => c.active),
    [courtsQuery.data],
  );

  // Selecciona la primera pista automáticamente al abrir
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!courtId && courts.length > 0) setCourtId(courts[0].id);
  }, [courts, courtId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Duraciones permitidas de la pista elegida
  const durationsQuery = useQuery({
    queryKey: bookingsQK.courtDurations(clubId, courtId),
    queryFn: () => bookingsService.courtDurations.list(clubId, courtId),
    enabled: open && !!clubId && !!courtId,
  });
  const durations = useMemo(() => {
    const list = (durationsQuery.data ?? [])
      .map((d) => d.minutes)
      .sort((a, b) => a - b);
    return list.length > 0 ? list : [60, 90];
  }, [durationsQuery.data]);

  // Ajusta la duración si la actual no está permitida por la pista
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (durations.length > 0 && !durations.includes(duration)) {
      setDuration(durations[0]);
    }
  }, [durations, duration]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Huecos libres para pista + fecha + duración, con el precio del cliente
  // elegido (si es socio): el mismo que guarda el back al crear la reserva
  const availabilityKey = bookingsQK.availability(clubId, courtId, date, duration, customer?.id);
  const availabilityQuery = useQuery({
    queryKey: availabilityKey,
    // Al elegir o quitar el cliente solo cambia el precio: los huecos de antes siguen
    // a la vista mientras llegan los nuevos (con otra pista, fecha o duración, no)
    placeholderData: (previous, previousQuery) =>
      previousQuery &&
      previousQuery.queryKey.slice(0, -1).join("|") === availabilityKey.slice(0, -1).join("|")
        ? previous
        : undefined,
    queryFn: () =>
      bookingsService.availability({
        clubId,
        date,
        duration,
        ...(customer ? { clubCustomerId: customer.id } : {}),
      }),
    enabled: open && !!clubId && !!courtId && !!date,
  });
  const slots = useMemo(
    () =>
      (availabilityQuery.data ?? []).filter((s) => s.courtId === courtId),
    [availabilityQuery.data, courtId],
  );

  // La hora con la que se crea: la pedida, si es uno de los huecos libres
  const startsAt = slots.some((s) => s.startsAt === wantedStartsAt) ? wantedStartsAt : "";
  // Una reserva ya empezada se apunta como registro: ni competitiva ni abierta
  const started = hasStarted(startsAt);
  // El hueco elegido: de él salen el precio y lo que incluye
  const pickedSlot = slots.find((s) => s.startsAt === startsAt);
  // Si ya se sabe que no cabe (huecos cargados para una duración que admite
  // la pista), se dice por qué en vez de dejar la hora en blanco sin más
  const slotsSettled =
    availabilityQuery.isSuccess && !availabilityQuery.isFetching && durations.includes(duration);
  const unavailableNotice =
    wantedStartsAt && !startsAt && slotsSettled
      ? `A las ${zonedTime(wantedStartsAt, timeZone)} no hay hueco de ${duration} min en ${
          courts.find((c) => c.id === courtId)?.name ?? "esta pista"
        }.`
      : null;

  // Lo cobrado ahora: lo escrito o, sin tocar, el precio del hueco
  const payAmountText = payAmount ?? centsToEurosInput(pickedSlot?.priceCents ?? 0);
  const payCents = eurosToCents(payAmountText);
  const payInvalid = payNow && payCents === null;

  const create = useMutation({
    mutationFn: () => bookingsService.bookings.create(buildPayload()),
    onSuccess: () => {
      toast.success("Reserva creada");
      qc.invalidateQueries({ queryKey: ["bookings", "list"] });
      resetAndClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        (err as Error)?.message ??
        "No se pudo crear la reserva";
      toast.error(msg);
    },
  });

  if (!open) return null;

  const companionCount = players.length + guests.length;
  // El club no ocupa plaza (D14): caben todos los de la pista
  const maxPlayers = courts.find((c) => c.id === courtId)?.type === "SINGLES" ? 2 : 4;

  function resetAndClose() {
    setWantedStartsAt("");
    setMode("PHONE");
    setIsCompetitive(false);
    setNotes("");
    setMinLspa("");
    setMaxLspa("");
    setPlayers([]);
    setGuests([]);
    setGuestDraft("");
    setCustomer(null);
    setPayNow(false);
    setPayMethod("CASH");
    setPayAmount(null);
    onClose();
  }

  function addPlayer(p: Player) {
    if (companionCount >= maxPlayers) {
      toast.info(`Máximo ${maxPlayers} jugadores en esta pista`);
      return;
    }
    if (players.some((x) => x.id === p.id)) return;
    setPlayers((prev) => [...prev, p]);
  }

  function addGuest() {
    const name = guestDraft.trim();
    if (!name) return;
    if (companionCount >= maxPlayers) {
      toast.info(`Máximo ${maxPlayers} jugadores en esta pista`);
      return;
    }
    setGuests((prev) => [...prev, { guestName: name }]);
    setGuestDraft("");
  }

  function buildPayload(): CreateBookingPayload {
    const base = {
      courtId,
      startsAt,
      durationMinutes: duration,
      isCompetitive: isCompetitive && !started,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(customer ? { clubCustomerId: customer.id } : {}),
      ...(payNow && (pickedSlot?.priceCents ?? 0) > 0
        ? { payNow: { method: payMethod, ...(payCents !== null ? { amountCents: payCents } : {}) } }
        : {}),
    };

    if (mode === "OPEN") {
      const min = minLspa.trim() ? Number(minLspa) : undefined;
      const max = maxLspa.trim() ? Number(maxLspa) : undefined;
      return {
        ...base,
        matchMode: "OPEN",
        ...(min !== undefined ? { openMatchMinLspa: min } : {}),
        ...(max !== undefined ? { openMatchMaxLspa: max } : {}),
      };
    }

    if (mode === "PHONE") {
      return { ...base, matchMode: "ADMIN_MANUAL" };
    }

    // PLAYERS
    const participants = [
      ...players.map((p) => ({ userId: p.id })),
      ...guests.map((g) => ({ guestName: g.guestName })),
    ];
    return {
      ...base,
      matchMode: guests.length > 0 ? "PRIVATE_WITH_GUESTS" : "PRIVATE_AMT",
      ...(participants.length > 0 ? { participants } : {}),
    };
  }

  const lspaError = mode === "OPEN" ? lspaRangeError(minLspa, maxLspa) : null;
  // Pasa a una pista individual con más jugadores de los que caben
  const tooManyPlayers = mode === "PLAYERS" && companionCount > maxPlayers;
  // Abierta y con una hora que ya ha empezado: el back no la crea
  const openButStarted = mode === "OPEN" && started;
  // La hora tiene que ser uno de los huecos libres de ahora (no basta con la
  // que vino del calendario si aún se están buscando o ya no está libre)
  const canSubmit =
    !!courtId &&
    slots.some((s) => s.startsAt === startsAt) &&
    !lspaError &&
    !tooManyPlayers &&
    !openButStarted &&
    !payInvalid &&
    !create.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={resetAndClose}
      />
      <div className="relative flex w-full max-w-md max-h-[90vh] flex-col bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Crear reserva
              </h2>
              <p className="text-xs text-muted-foreground">
                Por teléfono, en el mostrador o abierta a otros jugadores
              </p>
            </div>
          </div>
          <button
            onClick={resetAndClose}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Solo el formulario se desplaza: el pie con los botones siempre a la vista */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-3">
          {/* Pista */}
          <label className="block">
            <span className="text-xs text-muted-foreground">Pista</span>
            <select
              value={courtId}
              // La hora pedida se queda: vale si en esta pista también está
              // libre, y si no, se dice
              onChange={(e) => setCourtId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {courts.length === 0 && (
                <option value="">Sin pistas disponibles</option>
              )}
              {courts.map((c: Court) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Fecha + duración */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-muted-foreground">Fecha</span>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setWantedStartsAt("");
                }}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Duración</span>
              <select
                value={duration}
                // Igual que la pista: la hora pedida vale si con esta
                // duración sigue libre
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {durations.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Hora (huecos libres) */}
          <label className="block">
            <span className="text-xs text-muted-foreground">Hora de inicio</span>
            {availabilityQuery.isLoading ? (
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando
                huecos…
              </div>
            ) : slots.length === 0 ? (
              <p className="mt-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-muted-foreground">
                Sin huecos libres para esta pista, fecha y duración.
              </p>
            ) : (
              <select
                value={startsAt}
                onChange={(e) => setWantedStartsAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">— elige una hora —</option>
                {slots.map((s) => (
                  <option key={s.startsAt} value={s.startsAt}>
                    {s.startsAtLocal}
                  </option>
                ))}
              </select>
            )}
            {unavailableNotice && (
              <p role="status" className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {unavailableNotice}
              </p>
            )}
          </label>

          {/* Precio, antes de crear */}
          {pickedSlot && (
            <p className="text-sm">
              <span className="font-semibold">{formatCents(pickedSlot.priceCents)}</span>
              <span className="text-muted-foreground"> · {pickedSlot.durationMinutes} min</span>
              {pickedSlot.priceBreakdown.extras.length > 0 && (
                <span className="block text-xs text-muted-foreground">
                  Incluye: {pickedSlot.priceBreakdown.extras.map((e) => e.name).join(", ")}
                </span>
              )}
            </p>
          )}

          {/* Modo */}
          <div className="pt-1">
            <span className="text-xs text-muted-foreground">Modo</span>
            <div className="mt-1 flex flex-col gap-1.5">
              <ModeRadio
                checked={mode === "OPEN"}
                onChange={() => setMode("OPEN")}
                label="Abierta"
                hint={
                  started
                    ? "No se puede: el partido ya ha empezado"
                    : "Partido abierto a otros jugadores de la app"
                }
                disabled={started}
              />
              <ModeRadio
                checked={mode === "PLAYERS"}
                onChange={() => setMode("PLAYERS")}
                label="Con jugadores"
                hint="Busca jugadores de la app o añade invitados"
              />
              <ModeRadio
                checked={mode === "PHONE"}
                onChange={() => setMode("PHONE")}
                label="Por teléfono"
                hint="Solo el cliente, sin lista de jugadores"
              />
            </div>
            {openButStarted && (
              <p role="alert" className="mt-1.5 text-xs text-destructive">
                Esa hora ya ha empezado: una reserva así se apunta como
                registro de la pista y no se puede abrir a otros jugadores.
                Elige otro modo.
              </p>
            )}
          </div>

          {/* Modo OPEN */}
          {mode === "OPEN" && (
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  Nivel mín. (opcional)
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={MIN_LSPA}
                  value={minLspa}
                  onChange={(e) => setMinLspa(e.target.value)}
                  aria-invalid={!!lspaError}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  Nivel máx. (opcional)
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={MIN_LSPA}
                  value={maxLspa}
                  onChange={(e) => setMaxLspa(e.target.value)}
                  aria-invalid={!!lspaError}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              {lspaError && (
                <p role="alert" className="col-span-2 text-xs text-destructive">
                  {lspaError}
                </p>
              )}
            </div>
          )}

          {/* Modo PLAYERS */}
          {mode === "PLAYERS" && (
            <div className="space-y-2 rounded-md border border-border bg-background p-3">
              <p className={`text-xs ${tooManyPlayers ? "text-destructive" : "text-muted-foreground"}`}>
                Jugadores: {companionCount}/{maxPlayers}
                {tooManyPlayers && " — quita alguno: en esta pista no caben tantos"}
              </p>

              {(players.length > 0 || guests.length > 0) && (
                <ul className="space-y-1">
                  {players.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded border border-primary/30 bg-primary/5 px-2 py-1 text-sm"
                    >
                      <span className="font-medium">{p.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPlayers((prev) =>
                            prev.filter((x) => x.id !== p.id),
                          )
                        }
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Quitar jugador"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                  {guests.map((g, i) => (
                    <li
                      key={`guest-${i}`}
                      className="flex items-center justify-between rounded border border-border bg-muted/40 px-2 py-1 text-sm"
                    >
                      <span>
                        {g.guestName}{" "}
                        <span className="text-xs text-muted-foreground">
                          (invitado)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setGuests((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Quitar invitado"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {companionCount < maxPlayers && (
                <>
                  <PlayerSearch onPick={addPlayer} />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Invitado por nombre…"
                      value={guestDraft}
                      onChange={(e) => setGuestDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addGuest();
                        }
                      }}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addGuest}
                      disabled={!guestDraft.trim()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Cliente del club: se busca, o se da de alta ahí mismo */}
          <BookingCustomerPicker clubId={clubId} value={customer} onChange={setCustomer} />

          {/* Cobrada ahora: solo si la reserva tiene importe */}
          {pickedSlot && pickedSlot.priceCents > 0 && (
            <div className="rounded-md border border-border bg-background p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={payNow}
                  onChange={(e) => setPayNow(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Cobrada ahora ({formatCents(pickedSlot.priceCents)})
              </label>
              {payNow && (
                <div className="mt-2 space-y-2">
                  <select
                    aria-label="Cómo se ha cobrado"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as CounterPaymentMethod)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <AmountField value={payAmountText} onChange={setPayAmount} invalid={payInvalid} />
                </div>
              )}
            </div>
          )}

          {/* Competitivo (no en una reserva ya empezada: fila 39) */}
          <div>
            <label className={`flex items-center gap-2 text-sm ${started ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                checked={isCompetitive && !started}
                onChange={(e) => setIsCompetitive(e.target.checked)}
                disabled={started}
                className="h-4 w-4 accent-primary"
              />
              Partido competitivo (puntúa en el ranking)
            </label>
            {started && (
              <p className="mt-1 text-xs text-muted-foreground">
                Esa hora ya ha empezado: se apunta como registro de la pista y su
                resultado no puntúa.
              </p>
            )}
          </div>

          {/* Notas */}
          <label className="block">
            <span className="text-xs text-muted-foreground">
              Notas (opcional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={resetAndClose}
            disabled={create.isPending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={!canSubmit}
          >
            {create.isPending && (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            )}
            Crear reserva
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModeRadio({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${
        checked
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-foreground/30"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/** Buscador de jugadores AMT por nombre/email con debounce. */
function PlayerSearch({ onPick }: { onPick: (p: Player) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const query = useQuery({
    queryKey: ["players-search", debounced],
    queryFn: () => adminService.players.search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar jugador de la app por nombre o email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-sm text-foreground"
        />
      </div>
      {debounced.length >= 2 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background">
          {query.isLoading ? (
            <div className="flex items-center justify-center p-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (query.data ?? []).length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Sin resultados.</p>
          ) : (
            <ul>
              {(query.data ?? []).slice(0, 8).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(p);
                      setQ("");
                      setDebounced("");
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      {p.email && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.email}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
