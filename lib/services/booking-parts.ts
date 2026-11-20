import { api } from "@/lib/api";
import type { BookingStatus } from "@/types/bookings";
import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";
import type { PartPriceKind } from "@/lib/services/accounts";

/**
 * Cobro de una reserva por partes (módulo Cuentas, M1): la «hoja de papel» del
 * club. Cada escritura devuelve la vista completa. Los importes, en céntimos.
 */

export type PartKind = "NORMAL" | "MEMBER" | "SPECIAL" | "CUSTOM";
export type PartStatus = "PENDING" | "PAID" | "DEBT" | "INVITED";

export interface BookingPart {
  id:                string;
  position:          number;
  kind:              PartKind;
  partPriceId:       string | null;
  partPriceName:     string | null;
  priceCents:        number;
  reason:            string | null;
  status:            PartStatus;
  clubCustomerId:    string | null;
  customerName:      string | null;
  /** Nombre libre de quien no es cliente. */
  label:             string | null;
  /** El cliente está en un grupo activo de la escuela. */
  isStudent:         boolean;
  isMember:          boolean;
  paymentMethod:     CounterPaymentMethod | null;
  bizumPartnerId:    string | null;
  bizumPartnerName:  string | null;
  paidAt:            string | null;
  paidByName:        string | null;
  refundedAt:        string | null;
  refundAmountCents: number | null;
  debtId:            string | null;
  debtStatus:        string | null;
}

export interface BookingPartsTotals {
  partsCents:     number;
  /** Precio menos la suma de las partes no invitadas (mínimo 0). */
  discountCents:  number;
  /** Lo cobrado menos lo devuelto. */
  collectedCents: number;
  pendingCents:   number;
  debtCents:      number;
  invitedCents:   number;
}

export interface PartPriceOption {
  partPriceId: string;
  name:        string;
  kind:        PartPriceKind;
  perCourt:    boolean;
  /** El de la franja de esta reserva; con `perCourt`, el de la pista entera. */
  priceCents:  number;
}

export interface BookingPartsView {
  bookingId:    string;
  priceCents:   number;
  courtType:    "DOUBLES" | "SINGLES";
  defaultCount: number;
  status:       BookingStatus;
  /** ISO */
  startsAt:     string;
  parts:        BookingPart[];
  totals:       BookingPartsTotals;
  priceOptions: PartPriceOption[];
  member:       { discountPercent: number; offered: boolean };
}

export interface UpdatePartPayload {
  kind?:           PartKind;
  partPriceId?:    string;
  priceCents?:     number;
  reason?:         string;
  clubCustomerId?: string | null;
  label?:          string | null;
}

export interface PayPartsPayload {
  /** Sin él, cobra todas las partes pendientes. */
  partIds?:        string[];
  method:          CounterPaymentMethod;
  /** Solo con Bizum: un socio activo, o null para «Club». */
  bizumPartnerId?: string | null;
}

export const bookingPartsQK = {
  view: (clubId: string, bookingId: string) => ["booking-parts", clubId, bookingId] as const,
};

const base = (clubId: string, bookingId: string) => `/admin/clubs/${clubId}/bookings/${bookingId}/parts`;

export const bookingPartsService = {
  view:  (clubId: string, bookingId: string) =>
    api.get<BookingPartsView>(base(clubId, bookingId)).then((r) => r.data),
  split: (clubId: string, bookingId: string, count?: number) =>
    api.post<BookingPartsView>(`${base(clubId, bookingId)}/split`, count ? { count } : {}).then((r) => r.data),
  /** Vuelve a cobrar entera (solo con todas las partes pendientes). */
  removeAll: (clubId: string, bookingId: string) =>
    api.delete<BookingPartsView>(base(clubId, bookingId)).then((r) => r.data),
  update: (clubId: string, bookingId: string, partId: string, data: UpdatePartPayload) =>
    api.patch<BookingPartsView>(`${base(clubId, bookingId)}/${partId}`, data).then((r) => r.data),
  pay: (clubId: string, bookingId: string, data: PayPartsPayload) =>
    api.post<BookingPartsView>(`${base(clubId, bookingId)}/pay`, data).then((r) => r.data),
  invite: (clubId: string, bookingId: string, partId: string, reason: string) =>
    api.post<BookingPartsView>(`${base(clubId, bookingId)}/${partId}/invite`, { reason }).then((r) => r.data),
  debt: (clubId: string, bookingId: string, partId: string, who: { clubCustomerId?: string; personName?: string }) =>
    api.post<BookingPartsView>(`${base(clubId, bookingId)}/${partId}/debt`, who).then((r) => r.data),
  undo: (clubId: string, bookingId: string, partId: string) =>
    api.post<BookingPartsView>(`${base(clubId, bookingId)}/${partId}/undo`).then((r) => r.data),
  refund: (clubId: string, bookingId: string, partId: string, amountCents: number) =>
    api.post<BookingPartsView>(`${base(clubId, bookingId)}/${partId}/refund`, { amountCents }).then((r) => r.data),
};
