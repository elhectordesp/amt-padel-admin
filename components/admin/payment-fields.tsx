"use client";

import { PAYMENT_METHOD_OPTIONS, type CounterPaymentMethod } from "@/lib/utils/payment-methods";

/**
 * El selector de método de cobro y el campo de importe que comparten todos los
 * cobros del club (reservas, inscripciones por jugador, «Cobrar pareja» y la
 * caja): la misma lista en todos, para no cobrar nunca «a ojo».
 */

interface MethodProps {
  value:    string;
  onChange: (method: CounterPaymentMethod) => void;
  disabled?: boolean;
}

export function PaymentMethodPicker({ value, onChange, disabled }: MethodProps) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Método de pago</span>
      <div className="grid grid-cols-3 gap-2">
        {PAYMENT_METHOD_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`px-3 py-2 rounded-md text-sm border transition-colors disabled:opacity-50 ${
              value === o.value
                ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border-[rgba(212,175,55,0.4)]"
                : "bg-secondary text-muted-foreground border-border hover:border-[rgba(212,175,55,0.3)] hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface AmountProps {
  label?:    string;
  value:     string;
  onChange:  (text: string) => void;
  invalid?:  boolean;
  disabled?: boolean;
}

export function AmountField({ label = "Importe cobrado", value, onChange, invalid, disabled }: AmountProps) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{label}</span>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-9 pl-3 pr-8 rounded-md bg-secondary border text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37] ${
            invalid ? "border-red-500" : "border-border"
          }`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
      </div>
      {invalid && <span className="mt-1 block text-xs text-red-400">Escribe un importe válido (por ejemplo 12,50)</span>}
    </label>
  );
}
