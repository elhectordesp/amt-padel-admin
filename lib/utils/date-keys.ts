/**
 * Helpers de conversión Date ↔ YYYY-MM-DD respetando la hora local del
 * navegador (no UTC).
 *
 * Necesario porque `Date.toISOString().slice(0, 10)` devuelve el día UTC,
 * que está desfasado cuando el navegador tiene offset positivo respecto
 * a UTC (p.ej. Madrid +2h en verano: medianoche local = 22:00 UTC del
 * día anterior → toISOString daría el día anterior).
 */

/** YYYY-MM-DD en la zona horaria LOCAL del navegador. */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
