import { api } from "@/lib/api";
import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";
import type { Booking } from "@/types/bookings";

/**
 * Bonos de reservas del club: el catálogo de lo que vende, los bonos vendidos
 * a cada cliente (se cobran a mano) y el gasto de sus sesiones al cobrar
 * reservas o clases privadas de la escuela. Una sesión es una reserva de pista
 * entera (bono de pista) o una clase privada (bono de clases privadas). Los
 * importes van en céntimos.
 */

/** Cómo está un bono hoy: con sesiones, sin ellas, pasado de fecha o cancelado. */
export type VoucherStatus = "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "CANCELLED";

/** Para qué se gasta un bono: reservas de pista o clases privadas de la escuela. */
export type VoucherKind = "COURT" | "PRIVATE_CLASS";

/** Un tipo del catálogo del club. Cambiarlo no toca los bonos ya vendidos. */
export interface ClubVoucherType {
  id:         string;
  clubId:     string;
  name:       string;
  kind:       VoucherKind;
  /** 1-100: cada sesión es una reserva de pista entera o una clase privada. */
  sessions:   number;
  priceCents: number;
  /** Días de validez desde la venta; null: sin caducidad. */
  validDays:  number | null;
  active:     boolean;
  createdAt:  string;
  updatedAt:  string;
}

export interface ClubVoucherTypePayload {
  name:       string;
  kind:       VoucherKind;
  sessions:   number;
  priceCents: number;
  validDays?: number | null;
}

export interface UpdateClubVoucherTypePayload extends Partial<ClubVoucherTypePayload> {
  active?: boolean;
}

/** Una sesión gastada: la reserva o la clase privada a la que se descontó (una de las dos). */
export interface ClubVoucherUse {
  id:             string;
  /** La reserva; null si fue una clase privada. */
  bookingId:      string | null;
  /** La clase privada; null si fue una reserva. */
  privateClassId: string | null;
  /** Cuándo se descontó (ISO). */
  usedAt:         string;
  /** Inicio de la reserva o de la clase (ISO). */
  startsAt:       string | null;
  /** La pista; null si la clase privada se quedó sin ella. */
  courtName:      string | null;
}

/** Un bono vendido a un cliente, con su saldo y su estado ya calculados por el back. */
export interface ClubVoucher {
  id:                string;
  clubId:            string;
  /** null si el tipo se borró del catálogo: el bono conserva sus datos. */
  typeId:            string | null;
  clubCustomerId:    string;
  name:              string;
  kind:              VoucherKind;
  sessions:          number;
  priceCents:        number;
  /** Método con el que se cobró (los del mostrador); null: pendiente de cobro. */
  paymentMethod:     string | null;
  paidAt:            string | null;
  /** Último instante de validez (fin del día local del club); null: no caduca. */
  expiresAt:         string | null;
  cancelledAt:       string | null;
  /** Lo devuelto al cancelar (a mano); null: nada. */
  refundAmountCents: number | null;
  cancelNotes:       string | null;
  soldById:          string;
  createdAt:         string;
  paid:              boolean;
  usedSessions:      number;
  remainingSessions: number;
  status:            VoucherStatus;
  uses:              ClubVoucherUse[];
}

export interface SellVoucherPayload {
  typeId: string;
  /** Cobrado en el momento con este método; sin él, queda pendiente de cobro. */
  method?: CounterPaymentMethod;
}

export interface CancelVoucherPayload {
  /** Lo devuelto al cliente; sin él, no se devuelve nada. */
  refundAmountCents?: number;
  notes?:             string;
}

export const clubVouchersQK = {
  all:      (clubId: string) => ["club-vouchers", clubId] as const,
  types:    (clubId: string) => ["club-vouchers", clubId, "types"] as const,
  customer: (clubId: string, customerId: string) => ["club-vouchers", clubId, "customer", customerId] as const,
  usable:   (clubId: string, bookingId: string) => ["club-vouchers", clubId, "usable", bookingId] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}`;

export const clubVouchersService = {
  types: {
    list: (clubId: string) =>
      api.get<ClubVoucherType[]>(`${base(clubId)}/voucher-types`).then((r) => r.data),
    create: (clubId: string, payload: ClubVoucherTypePayload) =>
      api.post<ClubVoucherType>(`${base(clubId)}/voucher-types`, payload).then((r) => r.data),
    update: (clubId: string, typeId: string, payload: UpdateClubVoucherTypePayload) =>
      api.patch<ClubVoucherType>(`${base(clubId)}/voucher-types/${typeId}`, payload).then((r) => r.data),
    remove: (clubId: string, typeId: string) =>
      api.delete(`${base(clubId)}/voucher-types/${typeId}`).then(() => undefined),
  },

  /** Los bonos de un cliente, del más reciente al más antiguo. */
  customer: {
    list: (clubId: string, customerId: string) =>
      api.get<ClubVoucher[]>(`${base(clubId)}/customers/${customerId}/vouchers`).then((r) => r.data),
    sell: (clubId: string, customerId: string, payload: SellVoucherPayload) =>
      api.post<ClubVoucher>(`${base(clubId)}/customers/${customerId}/vouchers`, payload).then((r) => r.data),
  },

  /** Marca el bono como cobrado con un método del mostrador; PENDING le quita el cobro. */
  setPayment: (clubId: string, voucherId: string, method: CounterPaymentMethod | "PENDING") =>
    api.patch<ClubVoucher>(`${base(clubId)}/vouchers/${voucherId}/payment`, { method }).then((r) => r.data),

  /** Cancela el bono: devolución manual. Las sesiones ya gastadas se quedan. */
  cancel: (clubId: string, voucherId: string, payload: CancelVoucherPayload) =>
    api.post<ClubVoucher>(`${base(clubId)}/vouchers/${voucherId}/cancel`, payload).then((r) => r.data),

  /** Pagar una reserva con bono. */
  booking: {
    /** Los bonos de su cliente con los que se puede pagar (con saldo, sin cancelar y vigentes a su fecha). */
    usable: (clubId: string, bookingId: string) =>
      api.get<ClubVoucher[]>(`${base(clubId)}/bookings/${bookingId}/vouchers`).then((r) => r.data),
    use: (clubId: string, bookingId: string, voucherId: string) =>
      api.post<Booking>(`${base(clubId)}/bookings/${bookingId}/voucher`, { voucherId }).then((r) => r.data),
    /** Quita el bono: la sesión vuelve al bono y la reserva queda pendiente de pago. */
    remove: (clubId: string, bookingId: string) =>
      api.delete<Booking>(`${base(clubId)}/bookings/${bookingId}/voucher`).then((r) => r.data),
  },
};
