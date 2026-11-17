/**
 * Lo que el panel dice de un bono de reservas: etiquetas, validez y los
 * formularios del catálogo y de la devolución, comprobados antes de mandarlos
 * al back (que los vuelve a comprobar). Los importes van en céntimos.
 */

import { centsToEurosText, eurosToCents, formatCents } from "@/lib/utils/booking-price";
import { eurosToCents as refundEurosToCents, methodLabel } from "@/lib/utils/payment-methods";
import { formatInTimeZone } from "@/lib/utils/time-zone";
import type {
  ClubVoucher,
  ClubVoucherType,
  ClubVoucherTypePayload,
  VoucherStatus,
} from "@/lib/services/club-vouchers";

/** Lo mismo que el back acepta de un tipo. */
export const VOUCHER_MAX_SESSIONS = 100;
export const VOUCHER_MAX_VALID_DAYS = 3650;

export const VOUCHER_STATUS_LABEL: Record<VoucherStatus, string> = {
  ACTIVE:    "Activo",
  EXHAUSTED: "Agotado",
  EXPIRED:   "Caducado",
  CANCELLED: "Cancelado",
};

/** «7 de 10 sesiones» (las que quedan, de las que tiene). */
export function sessionsLabel(v: Pick<ClubVoucher, "remainingSessions" | "sessions">): string {
  return `${v.remainingSessions} de ${v.sessions} ${v.sessions === 1 ? "sesión" : "sesiones"}`;
}

/** «30 días» o «Sin caducidad». */
export function validityLabel(validDays: number | null): string {
  if (validDays === null) return "Sin caducidad";
  return `${validDays} ${validDays === 1 ? "día" : "días"}`;
}

/** «Pendiente de cobro» o «Cobrado · Efectivo». */
export function voucherPaymentLabel(v: Pick<ClubVoucher, "paid" | "paymentMethod">): string {
  return v.paid ? `Cobrado · ${methodLabel(v.paymentMethod)}` : "Pendiente de cobro";
}

/** El día en que caduca, en la zona del club; «Sin caducidad» si no caduca. */
export function expiryLabel(expiresAt: string | null, timeZone: string): string {
  if (expiresAt === null) return "Sin caducidad";
  return `Caduca el ${formatInTimeZone(expiresAt, timeZone, { day: "numeric", month: "numeric", year: "numeric" })}`;
}

/** Un tipo para elegirlo al vender: «Bono 10 · 10 sesiones · 120,00 €». */
export function typeOptionLabel(t: Pick<ClubVoucherType, "name" | "sessions" | "priceCents">): string {
  return `${t.name} · ${t.sessions} ${t.sessions === 1 ? "sesión" : "sesiones"} · ${formatCents(t.priceCents)}`;
}

/** El formulario de un tipo tal como se escribe (todo texto). */
export interface TypeFormValues {
  name:       string;
  sessions:   string;
  /** En euros, como se escribe («120», «12,50»). */
  price:      string;
  /** Vacío: sin caducidad. */
  validDays:  string;
}

export const EMPTY_TYPE_FORM: TypeFormValues = { name: "", sessions: "", price: "", validDays: "" };

export function typeFormOf(t: ClubVoucherType): TypeFormValues {
  return {
    name:      t.name,
    sessions:  String(t.sessions),
    price:     centsToEurosText(t.priceCents),
    validDays: t.validDays === null ? "" : String(t.validDays),
  };
}

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

/** El tipo listo para mandar, o qué falta. El precio se escribe en euros; los días vacíos, sin caducidad. */
export function checkTypeForm(f: TypeFormValues): Checked<ClubVoucherTypePayload> {
  const name = f.name.trim();
  if (!name) return { ok: false, message: "Pon un nombre al bono" };
  const sessions = Number(f.sessions);
  if (f.sessions.trim() === "" || !Number.isInteger(sessions) || sessions < 1 || sessions > VOUCHER_MAX_SESSIONS)
    return { ok: false, message: `Las sesiones son un número entero entre 1 y ${VOUCHER_MAX_SESSIONS}` };
  const priceCents = eurosToCents(f.price);
  if (priceCents === null) return { ok: false, message: "Escribe un precio válido (por ejemplo 120 o 120,50)" };
  let validDays: number | null = null;
  if (f.validDays.trim() !== "") {
    validDays = Number(f.validDays);
    if (!Number.isInteger(validDays) || validDays < 1 || validDays > VOUCHER_MAX_VALID_DAYS)
      return { ok: false, message: `Los días de validez son un número entero entre 1 y ${VOUCHER_MAX_VALID_DAYS}, o vacío si no caduca` };
  }
  return { ok: true, value: { name, sessions, priceCents, validDays } };
}

/**
 * Lo que se devuelve al cancelar un bono, de lo escrito en euros. Vacío: nada.
 * No puede pasar de lo que costó el bono.
 */
export function checkRefund(text: string, priceCents: number): Checked<number> {
  if (text.trim() === "") return { ok: true, value: 0 };
  const cents = refundEurosToCents(text);
  if (cents === null) return { ok: false, message: "Escribe un importe válido (por ejemplo 12,50)" };
  if (cents > priceCents)
    return { ok: false, message: `No se puede devolver más de lo que costó el bono (${formatCents(priceCents)})` };
  return { ok: true, value: cents };
}

/** Si el bono admite todavía cobrarlo, gastarlo o cancelarlo (no está cancelado). */
export function isVoucherOpen(v: Pick<ClubVoucher, "status">): boolean {
  return v.status !== "CANCELLED";
}
