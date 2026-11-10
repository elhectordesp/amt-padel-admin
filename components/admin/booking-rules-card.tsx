/**
 * Tarjeta «Reglas de reserva» de la configuración de reservas del club:
 * «Reservas sin huecos» (flexible o estricto) y «Antelación con arrastre».
 * Solo afectan a lo que reserva un jugador desde la app; las reservas que
 * crea o mueve el club desde el panel no las sufren.
 */

"use client";

import {
  DEFAULT_RULE_FROM,
  DEFAULT_RULE_TO,
  STRICT_EXAMPLE,
  advanceExample,
  type BookingRulesForm,
} from "@/lib/utils/booking-rules";

interface Props {
  value: BookingRulesForm;
  onChange: (patch: Partial<BookingRulesForm>) => void;
}

const CONTROL = "max-[1024px]:min-h-11";
const TIME_INPUT = `rounded border border-border bg-background px-2 py-1.5 text-sm ${CONTROL}`;

export function BookingRulesCard({ value, onChange }: Props) {
  const strictOn = value.strictModeEnabled;
  const advanceOn = value.advanceRuleEnabled;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-medium">Reglas de reserva</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Valen para lo que reservan los jugadores desde la app. Las reservas que haces tú desde el panel
        no las tienen en cuenta.
      </p>

      <div className="space-y-6">
        {/* Reservas sin huecos */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Reservas sin huecos</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              En estricto, el jugador solo ve las horas que no dejan en la pista un hueco suelto más
              corto que la reserva mínima que ofrece.
            </p>
          </div>
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Modo de reservas">
            <ModeButton
              active={!strictOn}
              onClick={() => onChange({ strictModeEnabled: false })}
            >
              Flexible
            </ModeButton>
            <ModeButton
              active={strictOn}
              onClick={() =>
                onChange({
                  strictModeEnabled: true,
                  strictFrom: value.strictFrom ?? DEFAULT_RULE_FROM,
                  strictTo: value.strictTo ?? DEFAULT_RULE_TO,
                })
              }
            >
              Estricto
            </ModeButton>
          </div>
          {strictOn && (
            <TimeRange
              label="Estricto para las reservas que empiezan"
              from={value.strictFrom}
              to={value.strictTo}
              onFrom={(v) => onChange({ strictFrom: v })}
              onTo={(v) => onChange({ strictTo: v })}
            />
          )}
          <p className="text-xs text-muted-foreground">Ejemplo: {STRICT_EXAMPLE}</p>
        </div>

        <hr className="border-border" />

        {/* Antelación con arrastre */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <input
              id="advance-rule-enabled"
              type="checkbox"
              checked={advanceOn}
              onChange={(e) =>
                onChange({
                  advanceRuleEnabled: e.target.checked,
                  ...(e.target.checked
                    ? {
                        advanceRuleFrom: value.advanceRuleFrom ?? DEFAULT_RULE_FROM,
                        advanceRuleTo: value.advanceRuleTo ?? DEFAULT_RULE_TO,
                      }
                    : {}),
                })
              }
              className="mt-0.5 h-4 w-4 accent-primary max-[1024px]:h-6 max-[1024px]:w-6"
            />
            <div>
              <label htmlFor="advance-rule-enabled" className="text-sm font-medium">
                Antelación con arrastre
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                En las horas flojas, quien organiza un partido tiene que reservar con más antelación para
                dar tiempo a llenarlo. Los demás jugadores se apuntan hasta el último momento.
              </p>
            </div>
          </div>
          {advanceOn && (
            <div className="space-y-3">
              <TimeRange
                label="Se aplica a las reservas que empiezan"
                from={value.advanceRuleFrom}
                to={value.advanceRuleTo}
                onFrom={(v) => onChange({ advanceRuleFrom: v })}
                onTo={(v) => onChange({ advanceRuleTo: v })}
              />
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto]">
                <label htmlFor="advance-rule-minutes" className="text-sm">
                  Antelación que se exige en esa franja (minutos)
                </label>
                <input
                  id="advance-rule-minutes"
                  type="number"
                  min={0}
                  max={2880}
                  value={value.advanceRuleMinutes}
                  onChange={(e) => onChange({ advanceRuleMinutes: Number(e.target.value) })}
                  className={`w-24 rounded border border-border bg-background px-2 py-1.5 text-sm ${CONTROL}`}
                />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Ejemplo: {advanceExample(value.advanceRuleFrom, value.advanceRuleMinutes)}
          </p>
        </div>
      </div>
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded px-4 py-1.5 text-sm transition-colors ${CONTROL} ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function TimeRange({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string | null;
  to: string | null;
  onFrom: (v: string | null) => void;
  onTo: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{label}</span>
      <label className="flex items-center gap-1.5">
        <span className="text-muted-foreground">desde</span>
        <input
          type="time"
          aria-label={`${label}: desde`}
          value={from ?? ""}
          onChange={(e) => onFrom(e.target.value || null)}
          className={TIME_INPUT}
        />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-muted-foreground">hasta</span>
        <input
          type="time"
          aria-label={`${label}: hasta`}
          value={to ?? ""}
          onChange={(e) => onTo(e.target.value || null)}
          className={TIME_INPUT}
        />
      </label>
    </div>
  );
}
