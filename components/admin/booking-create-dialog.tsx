/**
 * BookingCreateDialog — Crear una reserva A MANO (Reservas R1).
 *
 * El admin del club puede crear una reserva de pista para walk-in / teléfono /
 * partido abierto. Elige pista + fecha + duración, ve los huecos LIBRES
 * (GET /availability) y escoge una hora de inicio, luego el modo:
 *  - Abierta (OPEN) + min/max LSPA opcional
 *  - Con jugadores (PRIVATE_AMT / PRIVATE_WITH_GUESTS) — busca jugadores AMT
 *    y/o añade invitados por nombre (máx. 3 acompañantes)
 *  - Por teléfono / sin gente (ADMIN_MANUAL) — un contacto libre opcional
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
import type { Court, Player } from "@/types";
import type { CreateBookingPayload } from "@/types/bookings";

type Mode = "OPEN" | "PLAYERS" | "PHONE";

interface Guest {
  guestName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clubId: string;
}

const MAX_COMPANIONS = 3;

/** "YYYY-MM-DD" de hoy en local. */
function todayISODate() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function BookingCreateDialog({ open, onClose, clubId }: Props) {
  const qc = useQueryClient();

  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [duration, setDuration] = useState(90);
  const [startsAt, setStartsAt] = useState(""); // ISO UTC del slot elegido
  const [mode, setMode] = useState<Mode>("PLAYERS");
  const [isCompetitive, setIsCompetitive] = useState(false);
  const [notes, setNotes] = useState("");

  // Modo OPEN
  const [minLspa, setMinLspa] = useState("");
  const [maxLspa, setMaxLspa] = useState("");

  // Modo PLAYERS
  const [players, setPlayers] = useState<Player[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestDraft, setGuestDraft] = useState("");

  // Modo PHONE
  const [contact, setContact] = useState("");

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

  // Huecos libres para pista + fecha + duración
  const availabilityQuery = useQuery({
    queryKey: bookingsQK.availability(clubId, courtId, date, duration),
    queryFn: () =>
      bookingsService.availability({ clubId, date, duration }),
    enabled: open && !!clubId && !!courtId && !!date,
  });
  const slots = useMemo(
    () =>
      (availabilityQuery.data ?? []).filter((s) => s.courtId === courtId),
    [availabilityQuery.data, courtId],
  );

  // Resetea la hora elegida si desaparece de los huecos disponibles
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (startsAt && !slots.some((s) => s.startsAt === startsAt)) {
      setStartsAt("");
    }
  }, [slots, startsAt]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  function resetAndClose() {
    setStartsAt("");
    setMode("PLAYERS");
    setIsCompetitive(false);
    setNotes("");
    setMinLspa("");
    setMaxLspa("");
    setPlayers([]);
    setGuests([]);
    setGuestDraft("");
    setContact("");
    onClose();
  }

  function addPlayer(p: Player) {
    if (companionCount >= MAX_COMPANIONS) {
      toast.info(`Máximo ${MAX_COMPANIONS} acompañantes`);
      return;
    }
    if (players.some((x) => x.id === p.id)) return;
    setPlayers((prev) => [...prev, p]);
  }

  function addGuest() {
    const name = guestDraft.trim();
    if (!name) return;
    if (companionCount >= MAX_COMPANIONS) {
      toast.info(`Máximo ${MAX_COMPANIONS} acompañantes`);
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
      isCompetitive,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
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
      const name = contact.trim();
      return {
        ...base,
        matchMode: "ADMIN_MANUAL",
        ...(name ? { participants: [{ guestName: name }] } : {}),
      };
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

  const canSubmit = !!courtId && !!startsAt && !create.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={resetAndClose}
      />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Crear reserva
              </h2>
              <p className="text-xs text-muted-foreground">
                Alta manual (walk-in / teléfono / abierta)
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

        <div className="p-5 space-y-3">
          {/* Pista */}
          <label className="block">
            <span className="text-xs text-muted-foreground">Pista</span>
            <select
              value={courtId}
              onChange={(e) => {
                setCourtId(e.target.value);
                setStartsAt("");
              }}
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
                  setStartsAt("");
                }}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Duración</span>
              <select
                value={duration}
                onChange={(e) => {
                  setDuration(Number(e.target.value));
                  setStartsAt("");
                }}
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
                onChange={(e) => setStartsAt(e.target.value)}
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
          </label>

          {/* Modo */}
          <div className="pt-1">
            <span className="text-xs text-muted-foreground">Modo</span>
            <div className="mt-1 flex flex-col gap-1.5">
              <ModeRadio
                checked={mode === "OPEN"}
                onChange={() => setMode("OPEN")}
                label="Abierta"
                hint="Partido abierto a jugadores AMT"
              />
              <ModeRadio
                checked={mode === "PLAYERS"}
                onChange={() => setMode("PLAYERS")}
                label="Con jugadores"
                hint="Busca jugadores AMT o añade invitados"
              />
              <ModeRadio
                checked={mode === "PHONE"}
                onChange={() => setMode("PHONE")}
                label="Por teléfono / sin gente"
                hint="Reserva manual con un contacto opcional"
              />
            </div>
          </div>

          {/* Modo OPEN */}
          {mode === "OPEN" && (
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  LSPA mín. (opcional)
                </span>
                <input
                  type="number"
                  step="0.1"
                  value={minLspa}
                  onChange={(e) => setMinLspa(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  LSPA máx. (opcional)
                </span>
                <input
                  type="number"
                  step="0.1"
                  value={maxLspa}
                  onChange={(e) => setMaxLspa(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
            </div>
          )}

          {/* Modo PLAYERS */}
          {mode === "PLAYERS" && (
            <div className="space-y-2 rounded-md border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">
                Acompañantes: {companionCount}/{MAX_COMPANIONS}
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

              {companionCount < MAX_COMPANIONS && (
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

          {/* Modo PHONE */}
          {mode === "PHONE" && (
            <label className="block">
              <span className="text-xs text-muted-foreground">
                Nombre/teléfono de contacto (opcional)
              </span>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Ej. Juan · 600 123 456"
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
          )}

          {/* Competitivo */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isCompetitive}
              onChange={(e) => setIsCompetitive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Partido competitivo (cuenta para LSPA)
          </label>

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

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
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
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm ${
        checked
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-foreground/30"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
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
          placeholder="Buscar jugador AMT por nombre o email…"
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
