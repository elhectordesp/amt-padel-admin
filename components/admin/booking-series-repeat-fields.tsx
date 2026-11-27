"use client";

/**
 * «Repetir cada semana» del alta de una reserva: el interruptor y, con él puesto,
 * el campo «Hasta». Sin cliente elegido o fuera del modo «Por teléfono» no se
 * pinta (lo decide quien lo usa); si no se puede repetir, sale apagado y dice por qué.
 */

interface Props {
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
  /** Por qué no se puede repetir esta hora; con motivo, el interruptor no se toca. */
  blockedReason?: string | null;
  /** «YYYY-MM-DD». */
  until: string;
  onUntilChange: (day: string) => void;
  /** Primer y último día que admite «Hasta». */
  min: string;
  max: string;
  /** «los martes a las 19:30», para decir qué se va a repetir. */
  whenText: string;
  error?: string | null;
}

export function SeriesRepeatFields({
  checked,
  onCheckedChange,
  blockedReason,
  until,
  onUntilChange,
  min,
  max,
  whenText,
  error,
}: Props) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3">
      <label
        className={`flex items-center gap-2 text-sm font-medium ${blockedReason ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!!blockedReason}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        Repetir cada semana
      </label>
      {blockedReason && <p className="text-xs text-muted-foreground">{blockedReason}</p>}
      {checked && !blockedReason && (
        <>
          <label className="block">
            <span className="text-xs text-muted-foreground">Hasta</span>
            <input
              type="date"
              value={until}
              min={min}
              max={max}
              onChange={(e) => onUntilChange(e.target.value)}
              aria-invalid={!!error}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground max-[1024px]:py-2.5"
            />
          </label>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Se reserva {whenText}. Antes de crear verás qué fechas están libres.
            </p>
          )}
        </>
      )}
    </div>
  );
}
