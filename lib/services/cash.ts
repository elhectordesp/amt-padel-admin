import { api } from "@/lib/api";

/**
 * Caja del día y deudas del club (B9). Los importes van en céntimos. El método
 * de cada movimiento es del catálogo único (CASH, CARD, BIZUM, TRANSFER,
 * ONLINE, OTHER) o, en reservas antiguas, CASH_AT_VENUE / PAID_MANUAL. Una
 * reserva o una clase privada pagadas con bono llevan VOUCHER y suman 0: el
 * dinero entró con la venta del bono. Las cuotas de la escuela y las clases
 * privadas cobradas también salen aquí (y las sin cobrar, en las deudas).
 */

export interface CashMovement {
  /**
   * VOUCHER: la venta de un bono (el día de su cobro) o, en negativo, su devolución.
   * SCHOOL_FEE: una cuota de la escuela. PRIVATE_CLASS: un alumno de una clase privada
   * (con bono, método VOUCHER e importe 0).
   */
  source:      "BOOKING" | "REGISTRATION" | "VOUCHER" | "SCHOOL_FEE" | "PRIVATE_CLASS";
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
  source:      "BOOKING" | "REGISTRATION" | "SCHOOL_FEE" | "PRIVATE_CLASS";
  /** La reserva, la inscripción, la cuota o, en una clase privada, el alumno de la clase. */
  refId:       string;
  concept:     string;
  /** Inicio de la reserva, de la clase privada o del torneo, o el día 1 del mes de la cuota (ISO). */
  date:        string;
  amountCents: number;
  /** Solo inscripciones: de qué jugador es la deuda. */
  slot?:       "titular" | "partner";
  playerId?:   string;
  /** Solo clases privadas: la clase del alumno. */
  privateClassId?: string;
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
