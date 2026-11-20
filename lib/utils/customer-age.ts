/**
 * Edad de un cliente del club a partir de su fecha de nacimiento (día de
 * calendario, AAAA-MM-DD). Solo para avisar en los formularios antes de
 * guardar: quien manda es el servidor, que cuenta «hoy» en la zona del club.
 */

/** Menos de esta edad es menor de edad. */
export const ADULT_AGE = 18;
/** Menos de esta edad, sus datos necesitan el consentimiento del tutor (LOPDGDD art. 7). */
export const GUARDIAN_CONSENT_AGE = 14;

/** Años cumplidos el día `today` por quien nació el `birthDay` (los dos AAAA-MM-DD). */
export function ageOn(birthDay: string, today: string): number {
  const [by, bm, bd] = birthDay.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const hadBirthday = tm > bm || (tm === bm && td >= bd);
  return ty - by - (hadBirthday ? 0 : 1);
}
