"use client";

/**
 * Campos de las opciones de un torneo que salen en tres sitios: las opciones
 * de torneo del club, el asistente de «Nuevo torneo» y Editar torneo. Aquí,
 * para que los tres digan lo mismo.
 */

import { useId } from "react";
import { charCount } from "@/lib/utils/char-count";
import { HIDE_FROM_APP_MAX_DAYS, PARTICIPANTS_VISIBILITY_OPTIONS } from "@/lib/utils/tournament-options";
import type { ParticipantsVisibility } from "@/types";

const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const OPTION_CARD =
  "flex items-start gap-3 p-3 rounded-md border border-border bg-secondary/40 cursor-pointer hover:bg-secondary/70 transition-colors";

/** Un texto plano (sin formato) con su contador: lo que se manda va sin los espacios de los bordes. */
export function PlainTextField({
  label, value, onChange, max, rows = 4, placeholder, help, error,
}: {
  label:        string;
  value:        string;
  onChange:     (value: string) => void;
  max:          number;
  rows?:        number;
  placeholder?: string;
  help?:        string;
  error?:       string;
}) {
  const id = useId();
  const length = charCount(value.trim());
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>{label}</label>
        <span className={`text-[11px] tabular-nums ${length > max ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
          {length}/{max}
        </span>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={`w-full px-3 py-2 rounded-md bg-input border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors ${error ? "border-destructive" : "border-border"}`}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export interface TournamentVisibility {
  participantsVisibility: ParticipantsVisibility;
  showClubInsteadOfCourt: boolean;
  /** null: nunca. NaN mientras el campo de los días está vacío (no vale al guardar). */
  hideFromAppAfterDays:   number | null;
}

/** Lo que ven los jugadores: la lista de inscritos, la pista y cuánto sigue el torneo en la app. */
export function TournamentVisibilityFields({
  value, onChange, hideFromAppError,
}: {
  value:             TournamentVisibility;
  onChange:          (patch: Partial<TournamentVisibility>) => void;
  hideFromAppError?: string;
}) {
  const name = useId();
  const hides = value.hideFromAppAfterDays !== null;
  const days = value.hideFromAppAfterDays;
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className={`${LABEL} mb-1.5`}>Quién ve la lista de inscritos</legend>
        {PARTICIPANTS_VISIBILITY_OPTIONS.map((option) => (
          <label key={option.value} className={OPTION_CARD}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value.participantsVisibility === option.value}
              onChange={() => onChange({ participantsVisibility: option.value })}
              className="mt-0.5 w-4 h-4 accent-[#D4AF37]"
            />
            <div>
              <p className="text-sm font-medium text-foreground">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.help}</p>
            </div>
          </label>
        ))}
        <p className="text-xs text-muted-foreground">
          No oculta los grupos ni el cuadro (si los publicas antes de empezar, se ven), ni cuántas parejas hay inscritas en cada categoría.
        </p>
      </fieldset>

      <label className={OPTION_CARD}>
        <input
          type="checkbox"
          checked={value.showClubInsteadOfCourt}
          onChange={(e) => onChange({ showClubInsteadOfCourt: e.target.checked })}
          className="mt-0.5 w-4 h-4 accent-[#D4AF37]"
        />
        <div>
          <p className="text-sm font-medium text-foreground">Mostrar el club en vez de la pista</p>
          <p className="text-xs text-muted-foreground">
            En la app, en los avisos y en el visor público, cada partido dice el nombre del club en vez de su pista. En el panel sigues viendo la pista. Con esto activado, mover un partido solo de pista no avisa a los jugadores.
          </p>
        </div>
      </label>

      <div className="space-y-2">
        <label className={OPTION_CARD}>
          <input
            type="checkbox"
            checked={hides}
            onChange={(e) => onChange({ hideFromAppAfterDays: e.target.checked ? 0 : null })}
            className="mt-0.5 w-4 h-4 accent-[#D4AF37]"
          />
          <div>
            <p className="text-sm font-medium text-foreground">Quitarlo del listado de la app cuando acabe</p>
            <p className="text-xs text-muted-foreground">
              Deja de salir en el listado de torneos de la app. Su ficha, el visor público y los enlaces siguen funcionando, y los jugadores lo siguen viendo en su historial.
            </p>
          </div>
        </label>
        {hides && (
          <div className="flex flex-wrap items-center gap-2 pl-1">
            <input
              type="number"
              min={0}
              max={HIDE_FROM_APP_MAX_DAYS}
              step={1}
              aria-label="Días después del último día del torneo"
              aria-invalid={!!hideFromAppError}
              value={days !== null && Number.isFinite(days) ? days : ""}
              onChange={(e) => onChange({ hideFromAppAfterDays: e.target.value === "" ? NaN : Number(e.target.value) })}
              className={`w-20 h-8 px-2 rounded-md bg-input border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] ${hideFromAppError ? "border-destructive" : "border-border"}`}
            />
            <span className="text-xs text-muted-foreground">
              días después del último día del torneo (0 = en cuanto acaba)
            </span>
          </div>
        )}
        {hideFromAppError && <p className="text-xs text-destructive">{hideFromAppError}</p>}
      </div>
    </div>
  );
}
