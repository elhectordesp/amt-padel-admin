/**
 * Programar un partido de liga: fecha y hora, y pista del club. Una liga no
 * tiene programador automático; el gestor pone cada partido cuando las parejas
 * le dicen cuándo juegan. Si la pista está ocupada (bloqueo, reserva u otro
 * partido) el back lo rechaza con lo que la ocupa y el aviso se queda aquí,
 * a la vista, para elegir otra hora u otra pista.
 */
"use client";

import { useState } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leagueMatchTitle } from "@/lib/utils/league-calendar";
import { toZonedDateTimeInput, zonedDateTimeToIso } from "@/lib/utils/time-zone";
import type { MatchResult } from "@/types";

/** Lo que se manda al back: null quita la fecha o la pista. */
export interface LeagueScheduleChange {
  date: string | null;
  court: string | null;
}

interface Props {
  match: MatchResult;
  /** Zona de la liga: la hora escrita es de esa zona. */
  timeZone: string;
  /** Nombres de las pistas activas del club. */
  courts: readonly string[];
  /** Guarda el cambio; si el back lo rechaza, lanza el error con su mensaje. */
  onSave: (change: LeagueScheduleChange) => Promise<void>;
  onClose: () => void;
}

export function LeagueMatchScheduleDialog({ match, timeZone, courts, onSave, onClose }: Props) {
  const [when, setWhen] = useState(() => toZonedDateTimeInput(match.date, timeZone));
  const [court, setCourt] = useState(match.court ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La pista que ya tiene el partido, aunque el club la haya quitado de la lista
  const courtOptions = court && !courts.includes(court) ? [...courts, court] : courts;
  const isoWhen = zonedDateTimeToIso(when, timeZone);
  const invalidWhen = when !== "" && !isoWhen;

  const save = async (change: LeagueScheduleChange) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(change);
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No se pudo programar el partido");
    } finally {
      setSaving(false);
    }
  };

  const changeWhen = (value: string) => {
    setWhen(value);
    // Una pista necesita fecha y hora
    if (!value) setCourt("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Programar partido"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarClock className="h-5 w-5 text-[#D4AF37] shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Programar partido</h2>
              <p className="text-xs text-muted-foreground truncate">{leagueMatchTitle(match)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-foreground">
            {match.team1.join(" / ") || "Por definir"} <span className="text-muted-foreground">vs</span>{" "}
            {match.team2.join(" / ") || "Por definir"}
          </p>

          <label className="block">
            <span className="text-xs text-muted-foreground">Fecha y hora</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => changeWhen(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">Pista</span>
            <select
              value={court}
              onChange={(e) => setCourt(e.target.value)}
              disabled={!when}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
            >
              <option value="">Sin pista</option>
              {courtOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {!when && <span className="text-[11px] text-muted-foreground">Pon primero la fecha y la hora.</span>}
          </label>

          {courts.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              El club no tiene pistas activas: añádelas en «Mi club» para poder asignarlas.
            </p>
          )}

          {invalidWhen && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              La fecha y la hora no son válidas.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-border">
          {match.date ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void save({ date: null, court: null })}
              disabled={saving}
            >
              Quitar fecha y pista
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button
              size="sm"
              onClick={() => void save({ date: isoWhen ?? null, court: court || null })}
              disabled={saving || invalidWhen}
            >
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
