/**
 * Ajustes de las cuentas del club: lo que se escribe en los campos (días de
 * aviso separados por comas, comisión en %) y lo que guarda el back (lista de
 * días, puntos básicos). Los mismos límites que valida el back.
 */

export const DEBT_MAX_DAYS = 365;
export const CARD_FEE_MAX_PERCENT = 10;

/** «5, 7 9» → [5, 7, 9] (ordenados y sin repetidos); null si algo no es un día de 1 a 365. */
export function parseWarnDays(text: string): number[] | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const days: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 1 || n > DEBT_MAX_DAYS) return null;
    if (!days.includes(n)) days.push(n);
  }
  return days.sort((a, b) => a - b);
}

export function warnDaysText(days: number[]): string {
  return days.join(", ");
}

/** «1,5» → 150 puntos básicos; null si no es un porcentaje de 0 a 10 con hasta dos decimales. */
export function feePercentToBps(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(clean)) return null;
  const percent = Number(clean);
  return percent > CARD_FEE_MAX_PERCENT ? null : Math.round(percent * 100);
}

/** 150 → «1,5». */
export function bpsToFeeText(bps: number): string {
  return String(bps / 100).replace(".", ",");
}
