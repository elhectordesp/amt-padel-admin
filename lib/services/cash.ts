import { api } from "@/lib/api";

/**
 * Caja del día y deudas del club (B9). Los importes van en céntimos. El método
 * de cada movimiento es del catálogo único (CASH, CARD, BIZUM, TRANSFER,
 * ONLINE, OTHER) o, en reservas antiguas, CASH_AT_VENUE / PAID_MANUAL.
 */

export interface CashMovement {
  source:      "BOOKING" | "REGISTRATION";
  refId:       string;
  /** Cuándo se cobró (ISO). */
  at:          string;
  concept:     string;
  person:      string;
  method:      string;
  amountCents: number;
}

export interface CashOfDay {
  /** AAAA-MM-DD, en la zona del club. */
  date:           string;
  timezone:       string;
  movements:      CashMovement[];
  totalsByMethod: Record<string, number>;
  totalCents:     number;
}

export interface DebtItem {
  source:      "BOOKING" | "REGISTRATION";
  refId:       string;
  concept:     string;
  /** Inicio de la reserva o del torneo (ISO). */
  date:        string;
  amountCents: number;
  /** Solo inscripciones: de qué jugador es la deuda. */
  slot?:       "titular" | "partner";
  playerId?:   string;
}

export interface DebtPerson {
  key:        string;
  name:       string;
  userId:     string | null;
  customerId: string | null;
  totalCents: number;
  items:      DebtItem[];
}

export interface Debts {
  people:     DebtPerson[];
  totalCents: number;
}

export const cashQK = {
  all:   (clubId: string) => ["club-cash", clubId] as const,
  day:   (clubId: string, date: string) => ["club-cash", clubId, "day", date] as const,
  debts: (clubId: string) => ["club-cash", clubId, "debts"] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}`;

export const cashService = {
  day: (clubId: string, date: string) =>
    api.get<CashOfDay>(`${base(clubId)}/cash`, { params: { date } }).then((r) => r.data),
  debts: (clubId: string) =>
    api.get<Debts>(`${base(clubId)}/debts`).then((r) => r.data),
};
