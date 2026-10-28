/**
 * Precios de reservas en un campo de texto: se escriben en euros y el back
 * los guarda en céntimos.
 */

/** Céntimos de lo escrito en euros («25», «12.5», «12,50»); null si no es un precio. */
export function eurosToCents(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Lo que se enseña en el campo para un precio guardado («25», «12.5»). */
export function centsToEurosText(cents: number): string {
  return String(cents / 100);
}
