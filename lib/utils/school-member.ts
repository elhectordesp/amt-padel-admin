/**
 * El alumno dentro de un grupo de la escuela (F8-C3): cómo paga, su descuento y
 * su baja temporal. El formulario con las mismas reglas que el back (que es
 * quien manda) y los textos con los que se enseña. Los importes van en céntimos.
 */

import { eurosToCents } from "@/lib/utils/payment-methods";
import { formatCents } from "@/lib/utils/booking-price";
import { isRealDay } from "@/lib/utils/school";
import { SCHOOL_MAX_PRICE_CENTS, centsToFieldText, type Checked } from "@/lib/utils/school-money";
import { formatDayKey } from "@/lib/utils/time-zone";
import type { SchoolGroupMember, SchoolMemberBilling, UpdateSchoolMemberPayload } from "@/types/school";

/** Lo mismo que el back acepta de un motivo. */
export const MEMBER_REASON_MAX = 120;

export const BILLING_LABEL: Record<SchoolMemberBilling, string> = {
  MONTHLY: "Cuota mensual",
  VOUCHER: "Bono de clases",
};

/** El formulario del alumno tal como se escribe (todo texto). */
export interface MemberFormValues {
  billing:        SchoolMemberBilling;
  /** En euros, como se escribe («10», «7,50»); vacío: sin descuento. */
  discount:       string;
  discountReason: string;
  /** Si está de baja temporal. */
  paused:         boolean;
  /** «AAAA-MM-DD» */
  pausedFrom:     string;
  /** «AAAA-MM-DD»; vacío: sin fecha de vuelta. */
  pausedUntil:    string;
  pauseReason:    string;
}

/**
 * Si el alumno tiene una baja temporal que cuenta: empezada o por empezar y
 * sin volver todavía (`today`, «AAAA-MM-DD» en la zona del club). Al quitar una
 * baja en curso el back la cierra hoy en vez de borrarla (para prorratear la
 * cuota desde la vuelta): esa ya no es una baja.
 */
export function isPauseActive(m: Pick<SchoolGroupMember, "pausedFrom" | "pausedUntil">, today: string): boolean {
  return m.pausedFrom !== null && (m.pausedUntil === null || today < m.pausedUntil);
}

export function memberFormOf(m: SchoolGroupMember, today: string): MemberFormValues {
  const paused = isPauseActive(m, today);
  return {
    billing: m.billing,
    discount: m.discountCents ? centsToFieldText(m.discountCents) : "",
    discountReason: m.discountReason ?? "",
    paused,
    pausedFrom: paused ? (m.pausedFrom ?? "") : "",
    pausedUntil: paused ? (m.pausedUntil ?? "") : "",
    pauseReason: paused ? (m.pauseReason ?? "") : "",
  };
}

/**
 * Lo que cambia respecto al alumno, listo para mandar (solo los campos que
 * cambian), o lo que falta. El descuento va de 0 a la cuota del grupo y, si es
 * mayor que 0, con motivo; la vuelta no es anterior al inicio de la baja.
 */
export function checkMemberForm(
  form: MemberFormValues,
  member: SchoolGroupMember,
  groupFeeCents: number | null,
  today: string,
): Checked<UpdateSchoolMemberPayload> {
  const fail = (message: string): Checked<UpdateSchoolMemberPayload> => ({ ok: false, message });
  const payload: UpdateSchoolMemberPayload = {};

  if (form.billing !== member.billing) payload.billing = form.billing;

  // Descuento: solo cuenta quien paga cuota
  const discountText = form.billing === "VOUCHER" ? "" : form.discount.trim();
  let discountCents: number | null = null;
  if (discountText !== "") {
    const cents = eurosToCents(discountText);
    if (cents === null) return fail("Escribe un descuento válido (por ejemplo 10 o 7,50)");
    if (cents > SCHOOL_MAX_PRICE_CENTS) return fail("El descuento no puede pasar de 100.000 €");
    if (cents > 0) {
      if (groupFeeCents === null) return fail("El grupo no tiene cuota: no admite descuento");
      if (cents > groupFeeCents) return fail(`El descuento no puede ser mayor que la cuota (${formatCents(groupFeeCents)})`);
      discountCents = cents;
    }
  }
  const discountReason = form.discountReason.trim();
  if (discountCents !== null && discountReason === "") return fail("El descuento necesita un motivo");
  if (discountReason.length > MEMBER_REASON_MAX) return fail(`El motivo no puede pasar de ${MEMBER_REASON_MAX} caracteres`);
  if (discountCents !== (member.discountCents ?? null)) payload.discountCents = discountCents;
  const wantedReason = discountCents === null ? null : discountReason;
  if (discountCents !== null && wantedReason !== (member.discountReason ?? null)) payload.discountReason = wantedReason;

  // Baja temporal
  const pauseReason = form.pauseReason.trim();
  if (pauseReason.length > MEMBER_REASON_MAX) return fail(`El motivo no puede pasar de ${MEMBER_REASON_MAX} caracteres`);
  if (!form.paused) {
    if (isPauseActive(member, today)) payload.pausedFrom = null;
  } else {
    if (!isRealDay(form.pausedFrom)) return fail("Elige el día en que empieza la baja");
    if (form.pausedUntil !== "" && !isRealDay(form.pausedUntil)) return fail("Elige un día de vuelta que exista");
    if (form.pausedUntil !== "" && form.pausedUntil < form.pausedFrom) {
      return fail("La vuelta no puede ser anterior al inicio de la baja");
    }
    if (form.pausedFrom !== member.pausedFrom) payload.pausedFrom = form.pausedFrom;
    const until = form.pausedUntil === "" ? null : form.pausedUntil;
    if (until !== member.pausedUntil) payload.pausedUntil = until;
    const reason = pauseReason === "" ? null : pauseReason;
    if (reason !== (member.pauseReason ?? null)) payload.pauseReason = reason;
  }

  return { ok: true, value: payload };
}

const SHORT_DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/**
 * «De baja hasta el 15 ene» o «De baja (sin fecha de vuelta)»; null si no está
 * de baja temporal (o ya volvió).
 */
export function pauseLabel(m: Pick<SchoolGroupMember, "pausedFrom" | "pausedUntil">, today: string): string | null {
  if (!isPauseActive(m, today)) return null;
  return m.pausedUntil ? `De baja hasta el ${formatDayKey(m.pausedUntil, SHORT_DAY)}` : "De baja (sin fecha de vuelta)";
}

/** «Paga con bono (quedan 3)»; null si paga cuota. */
export function voucherBillingLabel(m: Pick<SchoolGroupMember, "billing" | "voucherRemaining">): string | null {
  if (m.billing !== "VOUCHER") return null;
  if (m.voucherRemaining === null || m.voucherRemaining === undefined) return "Paga con bono";
  return `Paga con bono (quedan ${m.voucherRemaining})`;
}

/** «− 10,00 € (Hermanos)»; null sin descuento. */
export function discountLabel(m: Pick<SchoolGroupMember, "discountCents" | "discountReason">): string | null {
  if (!m.discountCents) return null;
  return `− ${formatCents(m.discountCents)}${m.discountReason ? ` (${m.discountReason})` : ""}`;
}
