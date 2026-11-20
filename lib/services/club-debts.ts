import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cashQK } from "@/lib/services/cash";
import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";

/**
 * Deudas del club (F8, M2): lo que una persona debe al club, de una parte de
 * reserva dejada a deber, de una venta o apuntada a mano. Todo responde 403
 * ACCOUNTS_DISABLED con el módulo Cuentas apagado. Cobrar, apuntar y editar son
 * de la caja («cash»); perdonar y reabrir, de propietario y gestor («accounts»).
 * Los importes van en céntimos y los días («AAAA-MM-DD») son del calendario del club.
 */

export type DebtStatus = "OPEN" | "PAID" | "FORGIVEN" | "LOST";
export type DebtOrigin = "BOOKING_PART" | "SALE" | "MANUAL";
export type DebtStatusFilter = DebtStatus | "ALL";

export interface ClubDebt {
  id:               string;
  origin:           DebtOrigin;
  concept:          string;
  amountCents:      number;
  /** Día de la pista o de la venta (AAAA-MM-DD): desde él cuenta el plazo. */
  debtDate:         string;
  status:           DebtStatus;
  /** Ni caduca ni avisa. */
  longTerm:         boolean;
  notes:            string | null;
  /** El día de hoy contando el de la deuda como 1. */
  dayNumber:        number;
  /** Último día para cobrarla; null sin plazo o de largo plazo. */
  expiresOn:        string | null;
  warnToday:        boolean;
  lastDay:          boolean;
  paymentMethod:    string | null;
  bizumPartnerName: string | null;
  paidAt:           string | null;
  paidByName:       string | null;
  closedAt:         string | null;
  bookingId:        string | null;
  saleId:           string | null;
  createdByName:    string;
}

/** Lo que devuelve apuntar una deuda: si nació ya vencida, se apunta de largo plazo. */
export interface CreatedDebt extends ClubDebt {
  /** El back la ha marcado de largo plazo porque ya había pasado su plazo. */
  longTermAuto: boolean;
  /** El plazo del club (días) que se había pasado; null sin plazo. */
  expiryDays:   number | null;
}

/** Las deudas que pasarían a perdidas hoy con un plazo nuevo. */
export interface ExpiryPreview {
  count:      number;
  totalCents: number;
}

export interface DebtPersonGroup {
  key:            string;
  name:           string;
  clubCustomerId: string | null;
  /** Lo que sigue abierto. */
  openCents:      number;
  debts:          ClubDebt[];
}

export interface DebtWarning {
  id:          string;
  name:        string;
  amountCents: number;
  dayNumber:   number;
  lastDay:     boolean;
  concept:     string;
}

export interface CreateDebtPayload {
  /** Un cliente del club o, si no lo es, un nombre: uno de los dos. */
  clubCustomerId?: string;
  personName?:     string;
  amountCents:     number;
  concept:         string;
  /** AAAA-MM-DD, nunca futuro; sin él, hoy. */
  debtDate?:       string;
  notes?:          string;
  longTerm?:       boolean;
}

export interface PayDebtsPayload {
  debtIds:         string[];
  method:          CounterPaymentMethod;
  /** Solo con Bizum: el socio al que llegó; null, la cuenta del club. */
  bizumPartnerId?: string | null;
}

export interface UpdateDebtPayload {
  longTerm?: boolean;
  /** null quita la nota. */
  notes?:    string | null;
  concept?:  string;
}

export const clubDebtsQK = {
  all:      (clubId: string) => ["club-debts", clubId] as const,
  list:     (clubId: string, status: DebtStatusFilter, customerId?: string) =>
              ["club-debts", clubId, "list", status, customerId ?? null] as const,
  warnings: (clubId: string) => ["club-debts", clubId, "warnings"] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/accounts/debts`;

export const clubDebtsService = {
  list: (clubId: string, status: DebtStatusFilter, customerId?: string) =>
    api
      .get<{ people: DebtPersonGroup[] }>(base(clubId), { params: { status, ...(customerId ? { customerId } : {}) } })
      .then((r) => r.data.people),
  warnings: (clubId: string) =>
    api.get<DebtWarning[]>(`${base(clubId)}/warnings`).then((r) => r.data),
  create: (clubId: string, input: CreateDebtPayload) =>
    api.post<CreatedDebt>(base(clubId), input).then((r) => r.data),
  /** Cuántas abiertas sin largo plazo se perderían hoy con ese plazo (área «settings»). */
  expiryPreview: (clubId: string, days: number) =>
    api.get<ExpiryPreview>(`${base(clubId)}/expiry-preview`, { params: { days } }).then((r) => r.data),
  pay: (clubId: string, input: PayDebtsPayload) =>
    api
      .post<{ paid: number; totalCents: number; debts: ClubDebt[] }>(`${base(clubId)}/pay`, input)
      .then((r) => r.data),
  undoPay: (clubId: string, id: string) =>
    api.post<ClubDebt>(`${base(clubId)}/${id}/undo-pay`).then((r) => r.data),
  update: (clubId: string, id: string, input: UpdateDebtPayload) =>
    api.patch<ClubDebt>(`${base(clubId)}/${id}`, input).then((r) => r.data),
  forgive: (clubId: string, id: string, reason: string) =>
    api.post<ClubDebt>(`${base(clubId)}/${id}/forgive`, { reason }).then((r) => r.data),
  reopen: (clubId: string, id: string) =>
    api.post<ClubDebt>(`${base(clubId)}/${id}/reopen`).then((r) => r.data),
};

/** Tras cualquier cambio en una deuda: sus listas y la caja (cobros y «Pendiente de cobro»). */
export function invalidateClubDebts(qc: QueryClient, clubId: string) {
  void qc.invalidateQueries({ queryKey: clubDebtsQK.all(clubId) });
  void qc.invalidateQueries({ queryKey: cashQK.all(clubId) });
}
