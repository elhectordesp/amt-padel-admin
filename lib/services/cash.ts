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
   * (con bono, método VOUCHER e importe 0). BOOKING_PART: la parte de una reserva
   * cobrada por partes (módulo Cuentas); `refId` es la parte y `bookingId` su reserva.
   * SALE: una venta de la tienda (o, en negativo, su devolución); `refId` es la venta y
   * `bookingId`, si la hay, la reserva en que se vendió.
   */
  source:      "BOOKING" | "BOOKING_PART" | "REGISTRATION" | "VOUCHER" | "SCHOOL_FEE" | "PRIVATE_CLASS" | "SALE";
  refId:       string;
  /** Cuándo se cobró (ISO). */
  at:          string;
  concept:     string;
  person:      string;
  method:      string;
  amountCents: number;
  /** Solo BOOKING_PART y SALE: la reserva de la parte o de la venta, para abrirla. */
  bookingId?:  string;
  /** Solo en un Bizum con el módulo Cuentas: el nombre del socio al que llegó, o «Club». */
  bizumReceiver?: string;
}

export interface CashOfDay {
  /** AAAA-MM-DD, en la zona del club. */
  date:           string;
  timezone:       string;
  movements:      CashMovement[];
  totalsByMethod: Record<string, number>;
  /** Solo con el módulo Cuentas: lo cobrado por Bizum según a qué móvil llegó («Club» o el socio). */
  bizumByReceiver?: Record<string, number>;
  totalCents:     number;
}

export interface DebtItem {
  source:      "BOOKING" | "BOOKING_PART" | "REGISTRATION" | "VOUCHER" | "SCHOOL_FEE" | "PRIVATE_CLASS" | "SALE";
  /** La reserva, la parte de una reserva, la inscripción, la cuota o, en una clase privada, el alumno de la clase. */
  refId:       string;
  /** Solo partes de una reserva y ventas de la tienda: la reserva a la que se cobran. */
  bookingId?:  string;
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
