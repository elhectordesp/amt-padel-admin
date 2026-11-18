/**
 * Recuperaciones y bandeja de la escuela: lo que no es pantalla. Los textos,
 * cuándo un aviso gana la recuperación (la misma regla que el back, que es
 * quien manda), qué créditos valen para una clase y el formulario de los
 * ajustes.
 */

import type {
  SchoolConfig,
  SchoolCredit,
  SchoolCreditOrigin,
  SchoolCreditStatus,
  SchoolRequest,
  SchoolRequestKind,
} from "@/types/school-recovery";
import { formatInTimeZone } from "@/lib/utils/time-zone";

export const SCHOOL_NOTICE_HOURS_MAX = 720;
export const SCHOOL_VALID_DAYS_MAX = 730;
export const SCHOOL_REQUEST_MESSAGE_MAX = 1000;
export const SCHOOL_CREDIT_NOTE_MAX = 200;

const HOUR_MS = 3_600_000;

export const CREDIT_ORIGIN_LABEL: Record<SchoolCreditOrigin, string> = {
  ABSENCE: "Ausencia avisada",
  CLUB_CANCELLED: "Clase cancelada por el club",
  MANUAL: "Concedida a mano",
};

export const CREDIT_STATUS_LABEL: Record<SchoolCreditStatus, string> = {
  available: "Disponible",
  used: "Usada",
  expired: "Caducada",
  voided: "Anulada",
};

export const REQUEST_KIND_LABEL: Record<SchoolRequestKind, string> = {
  JOIN_GROUP: "Alta en un grupo",
  ABSENCE: "Ausencia",
  PRIVATE_CLASS: "Clase particular",
  OTHER: "Otra",
};

/** Si avisar a `noticedAt` de una clase que empieza a `startsAt` gana la recuperación. */
export function earnsRecovery(startsAt: string | Date, noticedAt: Date, noticeHours: number): boolean {
  return new Date(startsAt).getTime() - noticedAt.getTime() >= noticeHours * HOUR_MS;
}

/** «2 días y 3 h», «5 h 30 min», «20 min»: lo que falta entre el aviso y la clase. */
export function marginText(ms: number): string {
  if (ms <= 0) return "ya empezada";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days > 0) {
    const d = `${days} ${days === 1 ? "día" : "días"}`;
    return hours > 0 ? `${d} y ${hours} h` : d;
  }
  if (hours > 0) return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
  return `${rest} min`;
}

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const DATETIME_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

/** «lun, 23 nov»: el día de una clase en la zona del club. */
export function classDayText(startsAt: string, tz: string): string {
  return formatInTimeZone(startsAt, tz, DAY_FMT);
}

/** «22 ene 2027»: cuándo caduca un crédito (en la zona del club). */
export function expiryText(expiresAt: string, tz: string): string {
  return formatInTimeZone(expiresAt, tz, DATE_FMT);
}

/** «21 nov, 10:00»: cuándo avisó el alumno o se resolvió algo. */
export function dateTimeText(value: string, tz: string): string {
  return formatInTimeZone(value, tz, DATETIME_FMT);
}

/** De dónde viene un crédito y hasta cuándo vale, en una línea. */
export function creditText(credit: SchoolCredit, tz: string): string {
  const source = credit.sourceSession
    ? `${CREDIT_ORIGIN_LABEL[credit.origin]} · ${credit.sourceSession.groupName}, ${classDayText(credit.sourceSession.startsAt, tz)}`
    : CREDIT_ORIGIN_LABEL[credit.origin];
  return `${source} · vale hasta el ${expiryText(credit.expiresAt, tz)}`;
}

/**
 * Los créditos que valen para apuntar a una clase que empieza a `startsAt`:
 * disponibles, que no caducan antes de esa clase y de alguien que no esté ya
 * en su lista. Primero los que antes caducan.
 */
export function creditChoices(
  credits: readonly SchoolCredit[],
  startsAt: string,
  inClass: ReadonlySet<string>,
): SchoolCredit[] {
  const at = new Date(startsAt).getTime();
  return credits
    .filter((c) => c.status === "available" && new Date(c.expiresAt).getTime() >= at && !inClass.has(c.clubCustomerId))
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
}

/** Quién es el de una solicitud: el cliente del club o el nombre que se apuntó. */
export function requestWho(r: Pick<SchoolRequest, "customerName" | "contactName">): string {
  return r.customerName ?? r.contactName ?? "Sin nombre";
}

// ── Ajustes del club ────────────────────────────────────────────────────────

export interface ConfigFormValues {
  recoveryNoticeHours: string;
  recoveryValidDays: string;
}

export function configFormOf(config: SchoolConfig): ConfigFormValues {
  return {
    recoveryNoticeHours: String(config.recoveryNoticeHours),
    recoveryValidDays: String(config.recoveryValidDays),
  };
}

export type CheckedConfigForm = { ok: true; value: SchoolConfig } | { ok: false; message: string };

/** Valida los ajustes con las reglas del back y los deja listos para mandar. */
export function checkConfigForm(form: ConfigFormValues): CheckedConfigForm {
  const hours = Number(form.recoveryNoticeHours);
  const days = Number(form.recoveryValidDays);
  if (form.recoveryNoticeHours.trim() === "" || !Number.isInteger(hours) || hours < 0 || hours > SCHOOL_NOTICE_HOURS_MAX) {
    return { ok: false, message: `La antelación tiene que ser un número de horas entre 0 y ${SCHOOL_NOTICE_HOURS_MAX}` };
  }
  if (form.recoveryValidDays.trim() === "" || !Number.isInteger(days) || days < 1 || days > SCHOOL_VALID_DAYS_MAX) {
    return { ok: false, message: `La validez tiene que ser un número de días entre 1 y ${SCHOOL_VALID_DAYS_MAX}` };
  }
  return { ok: true, value: { recoveryNoticeHours: hours, recoveryValidDays: days } };
}

/** Lo que pasó con los créditos al cancelar una clase, para el aviso (vacío si no pasó nada). */
export function cancelRecoveriesText(r: { granted: number; returned: number }): string {
  const parts: string[] = [];
  if (r.granted > 0) parts.push(`${r.granted} ${r.granted === 1 ? "alumno gana" : "alumnos ganan"} una recuperación`);
  if (r.returned > 0) {
    parts.push(
      `${r.returned} ${r.returned === 1 ? "recuperación devuelta" : "recuperaciones devueltas"} a quien se había apuntado`,
    );
  }
  return parts.join(" · ");
}
