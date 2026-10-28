/**
 * Precios de reservas: en un campo de texto se escriben en euros y el back
 * los guarda en céntimos; para leerlos, con coma decimal.
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

// Como los importes de Finanzas: coma decimal y siempre dos decimales
const EUR = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Un precio para leer: «30,00 €» (antes «30.00 €»). */
export function formatCents(cents: number): string {
  return `${EUR.format(cents / 100)} €`;
}
