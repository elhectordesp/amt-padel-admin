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

/**
 * El valor de un `<input type="datetime-local">` (YYYY-MM-DDTHH:mm) para un
 * instante, en la hora LOCAL del navegador. `toISOString().slice(0, 16)` da la
 * hora UTC: en Madrid el campo enseñaba 1-2 h menos de las guardadas.
 */
export function toLocalDateTimeInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${localDayKey(d)}T${hh}:${mm}`;
}

/**
 * El instante (ISO con zona) de lo escrito en un `datetime-local`, leído en la
 * hora local del navegador. Así se manda al back: sin zona, el back lo leía en
 * la hora del servidor (UTC en producción) y el cierre de inscripciones
 * quedaba 1-2 h más tarde de lo escrito. Vacío o no válido: undefined.
 */
export function localDateTimeToIso(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
