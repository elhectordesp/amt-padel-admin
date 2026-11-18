/**
 * Importes de la escuela que se escriben en euros: la cuota mensual de un
 * grupo y la tarifa de clase privada de un entrenador. Se comprueban con las
 * reglas del back (que es quien manda) y salen en céntimos.
 */

import { eurosToCents } from "@/lib/utils/payment-methods";

/** Tope de un importe de la escuela (100.000 €): un cero de más no pasa. */
export const SCHOOL_MAX_PRICE_CENTS = 10_000_000;

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

/** Céntimos a euros para un campo de texto («45,00»); sin importe, vacío. */
export function centsToFieldText(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

/** Un importe opcional escrito en euros, en céntimos: vacío es «sin importe» (null). */
function checkOptionalAmount(text: string, what: string, example: string): Checked<number | null> {
  if (text.trim() === "") return { ok: true, value: null };
  const cents = eurosToCents(text);
  if (cents === null) return { ok: false, message: `Escribe ${what} válida (por ejemplo ${example})` };
  if (cents < 1) return { ok: false, message: `${capital(what)} tiene que ser mayor que 0, o vacía si no hay` };
  if (cents > SCHOOL_MAX_PRICE_CENTS) return { ok: false, message: `${capital(what)} no puede pasar de 100.000 €` };
  return { ok: true, value: cents };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** La tarifa del entrenador (euros escritos) en céntimos; vacío, sin tarifa (null). */
export function checkRate(text: string): Checked<number | null> {
  return checkOptionalAmount(text, "una tarifa", "40 o 40,50");
}

/** La cuota mensual de un grupo (euros escritos) en céntimos; vacía, sin cuota (null). */
export function checkMonthlyFee(text: string): Checked<number | null> {
  return checkOptionalAmount(text, "una cuota", "45 o 45,50");
}
